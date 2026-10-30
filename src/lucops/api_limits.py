"""Bounded CSV uploads and per-process admission control for the HTTP API."""

import csv
import os
from dataclasses import dataclass
from pathlib import Path
from tempfile import SpooledTemporaryFile
from threading import BoundedSemaphore
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, UploadFile
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

_CHUNK_BYTES = 64 * 1024
_MULTIPART_OVERHEAD = 256 * 1024
_LIMIT_MESSAGE = "O CSV excede os limites de tamanho ou quantidade de registros."


def _positive_setting(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise ValueError(f"{name} must be a positive integer.") from exc
    if value < 1:
        raise ValueError(f"{name} must be a positive integer.")
    return value


@dataclass(frozen=True)
class CSVLimits:
    max_bytes: int = 5 * 1024 * 1024
    max_records: int = 10_000
    max_concurrent: int = 2

    @classmethod
    def from_env(cls) -> "CSVLimits":
        return cls(
            _positive_setting("LUCOPS_MAX_CSV_BYTES", 5 * 1024 * 1024),
            _positive_setting("LUCOPS_MAX_CSV_RECORDS", 10_000),
            _positive_setting("LUCOPS_MAX_CONCURRENT_ANALYSES", 2),
        )


def cors_origins() -> list[str]:
    origins = []
    for item in os.getenv("LUCOPS_CORS_ORIGINS", "").split(","):
        origin = item.strip().rstrip("/")
        if not origin:
            continue
        parsed = urlsplit(origin)
        if (
            "*" in origin
            or parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("LUCOPS_CORS_ORIGINS must contain explicit HTTP origins.")
        # Accessing port also rejects malformed port declarations.
        try:
            _ = parsed.port
        except ValueError as exc:
            raise ValueError("LUCOPS_CORS_ORIGINS contains an invalid port.") from exc
        origins.append(origin)
    return list(dict.fromkeys(origins))


class CSVProtectionMiddleware:
    """Bound the raw multipart body before parsing, with bounded disk spooling.

    Slots cover upload, parsing and processing. Health and CORS preflight remain
    available. The semaphore is deliberately per process, not a distributed quota.
    """

    def __init__(self, app: ASGIApp, limits: CSVLimits):
        self.app = app
        self.body_limit = limits.max_bytes + _MULTIPART_OVERHEAD
        self.slots = BoundedSemaphore(limits.max_concurrent)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope["method"] != "POST"
            or scope["path"]
            not in {"/analyses", "/anomaly-analyses", "/investigations"}
        ):
            await self.app(scope, receive, send)
            return
        if not self.slots.acquire(blocking=False):
            await JSONResponse(
                {"detail": "Servidor ocupado. Tente novamente em alguns instantes."},
                status_code=429,
                headers={"Retry-After": "5"},
            )(scope, receive, send)
            return
        try:
            headers = dict(scope["headers"])
            if b"content-length" in headers:
                try:
                    declared = int(headers[b"content-length"])
                    if declared < 0:
                        raise ValueError
                except ValueError:
                    await JSONResponse(
                        {"detail": "Requisição inválida."}, status_code=400
                    )(scope, receive, send)
                    return
                if declared > self.body_limit:
                    await self._too_large(scope, receive, send)
                    return
            # Never accumulate an unbounded multipart body or parse it before
            # checking its actual size, including requests without Content-Length.
            with SpooledTemporaryFile(max_size=_CHUNK_BYTES) as body:
                total = 0
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    chunk = message.get("body", b"")
                    total += len(chunk)
                    if total > self.body_limit:
                        await self._too_large(scope, receive, send)
                        return
                    body.write(chunk)
                    if not message.get("more_body", False):
                        break
                body.seek(0)

                async def replay() -> dict:
                    chunk = body.read(_CHUNK_BYTES)
                    return {
                        "type": "http.request",
                        "body": chunk,
                        "more_body": body.tell() < total,
                    }

                await self.app(scope, replay, send)
        finally:
            self.slots.release()

    @staticmethod
    async def _too_large(scope: Scope, receive: Receive, send: Send) -> None:
        await JSONResponse({"detail": _LIMIT_MESSAGE}, status_code=413)(
            scope, receive, send
        )


def configure_api(app: FastAPI) -> None:
    limits = CSVLimits.from_env()
    app.state.csv_limits = limits
    app.add_middleware(CSVProtectionMiddleware, limits=limits)
    # Outermost: admission and body-limit errors also receive CORS headers.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )


def save_csv_upload(upload: UploadFile, destination: Path, limits: CSVLimits) -> None:
    """Copy a bounded CSV, then count logical records without retaining rows."""
    total = 0
    with destination.open("wb") as output:
        while chunk := upload.file.read(
            min(_CHUNK_BYTES, limits.max_bytes - total + 1)
        ):
            total += len(chunk)
            if total > limits.max_bytes:
                raise HTTPException(status_code=413, detail=_LIMIT_MESSAGE)
            output.write(chunk)
    try:
        with destination.open(encoding="utf-8-sig", newline="") as source:
            for index, _ in enumerate(csv.DictReader(source), start=1):
                if index > limits.max_records:
                    raise HTTPException(status_code=413, detail=_LIMIT_MESSAGE)
    except (csv.Error, UnicodeError) as exc:
        raise HTTPException(status_code=400, detail="CSV inválido.") from exc
