import csv

import pytest
from fastapi.testclient import TestClient

from lucops.api import app

client = TestClient(app)


def test_health_check_returns_200():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "LucOps AI",
    }


def test_create_analysis_returns_quality_summary():
    csv_content = (
        b"id_transacao,cliente_id,valor\n"
        b"T001,C001,150.00\n"
        b"T002,C002,-20.00\n"
        b"T001,C003,350.00\n"
    )

    response = client.post(
        "/analyses",
        files={
            "file": (
                "transacoes.csv",
                csv_content,
                "text/csv",
            )
        },
    )

    assert response.status_code == 200

    assert response.json() == {
        "quality_status": "COM INCONSISTÊNCIAS",
        "summary": {
            "total_records": 3,
            "valid_records": 1,
            "invalid_records": 2,
            "total_issues": 2,
            "valid_percentage": 33.33,
        },
    }


def test_create_analysis_rejects_missing_columns():
    csv_content = b"id_transacao,valor\nT001,150.00\n"

    response = client.post(
        "/analyses",
        files={
            "file": (
                "transacoes.csv",
                csv_content,
                "text/csv",
            )
        },
    )

    assert response.status_code == 400

    assert response.json() == {
        "detail": ("CSV inválido: Missing required CSV columns: cliente_id")
    }


@pytest.mark.parametrize("include_details", ["false", "true"])
def test_create_analysis_rejects_duplicate_headers_safely(include_details):
    content = b"id_transacao,cliente_id,valor,valor\nT1,C1,-10,100\n"
    response = client.post(
        "/analyses",
        data={"include_details": include_details},
        files={"file": ("input.csv", content)},
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "CSV inválido: CSV contains duplicate column names."
    }


@pytest.mark.parametrize("include_details", ["false", "true"])
def test_create_analysis_handles_real_parser_error(include_details):
    content = (
        "id_transacao,cliente_id,valor\n"
        + "PRIVATE_MARKER_"
        + "x" * csv.field_size_limit()
        + ",C1,10\n"
    ).encode()
    response = client.post(
        "/analyses",
        data={"include_details": include_details},
        files={"file": ("input.csv", content)},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "CSV inválido."}


def test_create_analysis_does_not_expose_parser_exception_and_removes_upload(
    monkeypatch,
):
    uploads = []

    def fail_analysis(**kwargs):
        uploads.append(kwargs["file_path"])
        assert uploads[-1].exists()
        raise csv.Error("PRIVATE_MARKER /private/server/path")

    monkeypatch.setattr("lucops.api.analyze_csv", fail_analysis)
    response = client.post(
        "/analyses",
        files={"file": ("input.csv", b"id_transacao,cliente_id,valor\nT1,C1,10\n")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "CSV inválido."}
    assert len(uploads) == 1
    assert not uploads[0].parent.exists()
