import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from lucops import api
from lucops.api_limits import CSVLimits, CSVProtectionMiddleware, configure_api

HEADER = b"id_transacao,cliente_id,valor\n"
ONE = HEADER + b"T1,C1,10\n"
PATHS = ["/analyses", "/anomaly-analyses", "/investigations"]


def make_client(monkeypatch, *, size=5242880, rows=10000, concurrent=2, origins=""):
    for name, value in {
        "LUCOPS_MAX_CSV_BYTES": size,
        "LUCOPS_MAX_CSV_RECORDS": rows,
        "LUCOPS_MAX_CONCURRENT_ANALYSES": concurrent,
        "LUCOPS_CORS_ORIGINS": origins,
    }.items():
        monkeypatch.setenv(name, str(value))
    monkeypatch.delenv("LUCOPS_MODEL_PATH", raising=False)
    application = FastAPI()
    application.include_router(api.app.router)
    configure_api(application)
    return TestClient(application)


def post(client, path, content):
    return client.post(
        path, data={"record_index": "1"}, files={"file": ("input.csv", content)}
    )


@pytest.mark.parametrize("path", PATHS)
def test_csv_byte_limit_applies_before_processing(monkeypatch, path):
    client = make_client(monkeypatch, size=len(ONE))
    assert post(client, path, ONE).status_code in {200, 503}
    response = post(client, path, ONE + b"\n")
    assert response.status_code == 413
    assert response.json() == {
        "detail": "O CSV excede os limites de tamanho ou quantidade de registros."
    }


@pytest.mark.parametrize("path", PATHS)
def test_record_limit_applies_to_every_upload(monkeypatch, path):
    client = make_client(monkeypatch, rows=1)
    assert post(client, path, ONE).status_code in {200, 503}
    response = post(client, path, ONE + b"T2,C2,20\n")
    assert response.status_code == 413
    assert "T2" not in response.text


def test_multiline_values_count_as_one_record(monkeypatch):
    client = make_client(monkeypatch, rows=1)
    response = post(client, "/analyses", HEADER + b'T1,"C1\nC2",10\n')
    assert response.status_code == 200
    assert response.json()["summary"]["total_records"] == 1


def test_utf8_errors_have_safe_messages(monkeypatch):
    response = post(make_client(monkeypatch), "/analyses", HEADER + b"T1,\xff,10\n")
    assert response.status_code == 400
    assert response.json() == {"detail": "CSV inválido."}


@pytest.mark.parametrize("path", PATHS)
def test_admission_limit_preserves_health_cors_and_releases_slot(monkeypatch, path):
    entered, release = Event(), Event()
    original = api.analyze_csv

    def slow_analysis(**kwargs):
        entered.set()
        assert release.wait(15)
        return original(**kwargs)

    monkeypatch.setattr(api, "analyze_csv", slow_analysis)
    client = make_client(
        monkeypatch, concurrent=1, origins="https://dashboard.example.test"
    )
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(post, client, "/analyses", ONE)
        try:
            assert entered.wait(15)
            assert client.get("/health").json() == {
                "status": "ok",
                "service": "LucOps AI",
            }
            busy = client.post(
                path,
                headers={"Origin": "https://dashboard.example.test"},
                data={"record_index": "1"},
                files={"file": ("input.csv", ONE)},
            )
            assert busy.status_code == 429
            assert busy.headers["retry-after"] == "5"
            assert (
                busy.headers["access-control-allow-origin"]
                == "https://dashboard.example.test"
            )
        finally:
            release.set()
        assert future.result(timeout=15).status_code == 200
    assert post(client, "/analyses", ONE).status_code == 200


def test_parser_error_releases_admission_slot(monkeypatch):
    client = make_client(monkeypatch, concurrent=1)
    assert post(client, "/analyses", b"wrong\nrow\n").status_code == 400
    assert post(client, "/analyses", ONE).status_code == 200


@pytest.mark.parametrize(
    "origin,allowed",
    [
        ("https://dashboard.example.test", True),
        ("https://untrusted.example.test", False),
    ],
)
def test_explicit_cors_allowlist(monkeypatch, origin, allowed):
    client = make_client(monkeypatch, origins="https://dashboard.example.test")
    response = client.options(
        "/analyses",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
    )
    assert response.status_code == (200 if allowed else 400)
    assert ("access-control-allow-origin" in response.headers) == allowed
    assert response.headers.get("access-control-allow-credentials") is None


def test_cors_is_disabled_by_default_and_covers_limit_errors(monkeypatch):
    client = make_client(monkeypatch, size=1)
    assert (
        "access-control-allow-origin"
        not in client.get(
            "/health", headers={"Origin": "https://untrusted.example.test"}
        ).headers
    )
    client = make_client(monkeypatch, size=1, origins="https://dashboard.example.test")
    response = client.post(
        "/analyses",
        headers={"Origin": "https://dashboard.example.test"},
        files={"file": ("input.csv", ONE)},
    )
    assert response.status_code == 413
    assert (
        response.headers["access-control-allow-origin"]
        == "https://dashboard.example.test"
    )


@pytest.mark.parametrize(
    "origin",
    [
        "*",
        "https://*.example.test",
        "null",
        "https://user:secret@example.test",
        "https://example.test/path",
    ],
)
def test_invalid_cors_configuration_fails_closed(monkeypatch, origin):
    monkeypatch.setenv("LUCOPS_CORS_ORIGINS", origin)
    with pytest.raises(ValueError, match="LUCOPS_CORS_ORIGINS"):
        configure_api(FastAPI())


@pytest.mark.parametrize(
    "name",
    [
        "LUCOPS_MAX_CSV_BYTES",
        "LUCOPS_MAX_CSV_RECORDS",
        "LUCOPS_MAX_CONCURRENT_ANALYSES",
    ],
)
@pytest.mark.parametrize("value", ["0", "-1", "invalid"])
def test_invalid_limits_fail_closed_without_exposing_values(monkeypatch, name, value):
    monkeypatch.setenv(name, value)
    with pytest.raises(ValueError) as error:
        CSVLimits.from_env()
    assert str(error.value) == f"{name} must be a positive integer."


@pytest.mark.parametrize("declared", [False, True])
def test_raw_body_limit_precedes_multipart_and_stops_reading(declared):
    async def scenario():
        called, messages, receives = [], [], []
        chunks = iter([b"x" * 65536] * 8)

        async def downstream(scope, receive, send):
            called.append(True)

        async def receive():
            receives.append(True)
            return {"type": "http.request", "body": next(chunks), "more_body": True}

        async def send(message):
            messages.append(message)

        middleware = CSVProtectionMiddleware(downstream, CSVLimits(max_bytes=1))
        headers = [(b"content-length", b"1000000")] if declared else []
        await middleware(
            {"type": "http", "method": "POST", "path": "/analyses", "headers": headers},
            receive,
            send,
        )
        assert not called
        assert messages[0]["status"] == 413
        assert len(receives) == (0 if declared else 5)
        assert json.loads(messages[1]["body"])["detail"].startswith("O CSV excede")
        assert middleware.slots.acquire(blocking=False)

    asyncio.run(scenario())
