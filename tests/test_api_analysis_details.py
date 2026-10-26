from fastapi.testclient import TestClient

from lucops import application
from lucops.api import app

client = TestClient(app)


def post_analysis(csv_content: bytes, include_details: str | None = "true"):
    data = {} if include_details is None else {"include_details": include_details}
    return client.post(
        "/analyses",
        data=data,
        files={"file": ("transacoes.csv", csv_content, "text/csv")},
    )


def test_clean_csv_returns_empty_details_and_correct_summary():
    response = post_analysis(b"id_transacao,cliente_id,valor\nT1,C1,10.00\n")

    assert response.status_code == 200
    assert response.json()["summary"] == {
        "total_records": 1,
        "valid_records": 1,
        "invalid_records": 0,
        "total_issues": 0,
        "valid_percentage": 100.0,
    }
    assert response.json()["details"] == {
        "items": [],
        "returned_issues": 0,
        "total_issues": 0,
        "limit": 200,
        "truncated": False,
        "record_index_base": 1,
    }


def test_details_are_one_based_and_preserve_multiple_issues_per_record():
    response = post_analysis(
        b"id_transacao,cliente_id,valor\nT1,C1,10.00\nT1,,-2.00\n,C3,5.00\n"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["summary"] == {
        "total_records": 3,
        "valid_records": 1,
        "invalid_records": 2,
        "total_issues": 4,
        "valid_percentage": 33.33,
    }
    assert body["details"]["returned_issues"] == 4
    assert body["details"]["truncated"] is False
    assert body["details"]["items"] == [
        {
            "record_index": 2,
            "field": "cliente_id",
            "rule": "campo obrigatório",
            "description": "Campo obrigatório ausente.",
        },
        {
            "record_index": 2,
            "field": "valor",
            "rule": "is_positive_amount",
            "description": "Valor não atende à regra de validação.",
        },
        {
            "record_index": 2,
            "field": "id_transacao",
            "rule": "valor único",
            "description": "Identificador duplicado no CSV.",
        },
        {
            "record_index": 3,
            "field": "id_transacao",
            "rule": "campo obrigatório",
            "description": "Campo obrigatório ausente.",
        },
    ]


def test_details_do_not_expose_raw_values_or_personal_ids():
    response = post_analysis(
        b"id_transacao,cliente_id,valor\n"
        b"SECRET-ID,PERSONAL-123,-99999.00\n"
        b"SECRET-ID,PERSONAL-456,4.00\n"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["total_issues"] == 2
    assert "SECRET-ID" not in response.text
    assert "PERSONAL-123" not in response.text
    assert "PERSONAL-456" not in response.text
    assert "-99999.00" not in response.text
    assert all(
        set(issue) == {"record_index", "field", "rule", "description"}
        for issue in body["details"]["items"]
    )


def test_detail_limit_reports_truncation_without_changing_aggregates():
    rows = b"".join(f"T{index},C{index},-1\n".encode() for index in range(201))
    response = post_analysis(b"id_transacao,cliente_id,valor\n" + rows)

    assert response.status_code == 200
    body = response.json()
    assert body["summary"] == {
        "total_records": 201,
        "valid_records": 0,
        "invalid_records": 201,
        "total_issues": 201,
        "valid_percentage": 0.0,
    }
    assert body["details"]["returned_issues"] == 200
    assert body["details"]["total_issues"] == 201
    assert body["details"]["limit"] == 200
    assert body["details"]["truncated"] is True
    assert body["details"]["items"][-1]["record_index"] == 200


def test_default_and_false_keep_the_previous_response_contract():
    content = b"id_transacao,cliente_id,valor\nT1,C1,10.00\n"
    default_response = post_analysis(content, include_details=None)
    false_response = post_analysis(content, include_details="false")

    assert default_response.status_code == false_response.status_code == 200
    assert default_response.json() == false_response.json()
    assert set(default_response.json()) == {"quality_status", "summary"}


def test_separate_uploads_do_not_mix_issue_details():
    first = post_analysis(b"id_transacao,cliente_id,valor\nT1,C1,-1\n")
    second = post_analysis(b"id_transacao,cliente_id,valor\nT2,C2,5\n")

    assert first.status_code == second.status_code == 200
    assert first.json()["details"]["total_issues"] == 1
    assert second.json()["details"]["total_issues"] == 0
    assert second.json()["details"]["items"] == []


def test_optional_details_do_not_run_the_pipeline_twice(monkeypatch):
    original = application.run_pipeline
    calls = []

    def count_pipeline_calls(*args, **kwargs):
        calls.append(None)
        return original(*args, **kwargs)

    monkeypatch.setattr(application, "run_pipeline", count_pipeline_calls)
    response = post_analysis(b"id_transacao,cliente_id,valor\nT1,C1,-1\n")

    assert response.status_code == 200
    assert len(calls) == 1
    assert (
        response.json()["details"]["total_issues"]
        == response.json()["summary"]["total_issues"]
    )


def test_invalid_csv_and_invalid_request_keep_existing_http_errors():
    invalid_csv = post_analysis(b"id_transacao,valor\nT1,10.00\n")
    malformed_csv = post_analysis(b"id_transacao,cliente_id,valor\nT1,C1,10,extra\n")
    invalid_parameter = post_analysis(
        b"id_transacao,cliente_id,valor\nT1,C1,10.00\n",
        include_details="invalid",
    )
    missing_file = client.post("/analyses", data={"include_details": "true"})

    assert invalid_csv.status_code == 400
    assert malformed_csv.status_code == 400
    assert invalid_parameter.status_code == 422
    assert missing_file.status_code == 422
