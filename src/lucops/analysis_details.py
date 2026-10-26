"""Privacy-conscious API projection of quality issues from one pipeline run."""

from collections.abc import Iterable, Mapping
from typing import TypedDict

from .pipeline import RecordValidationResult

MAX_ISSUE_DETAILS = 200


class IssueDetail(TypedDict):
    record_index: int
    field: str
    rule: str
    description: str


class AnalysisDetails(TypedDict):
    items: list[IssueDetail]
    returned_issues: int
    total_issues: int
    limit: int
    truncated: bool
    record_index_base: int


def build_analysis_details(
    results: Iterable[RecordValidationResult],
    total_issues: int,
    rule_names: Mapping[str, str],
) -> AnalysisDetails:
    """Expose bounded issue metadata, never the issue's original field value."""
    items: list[IssueDetail] = []
    for result in results:
        for issue in result.issues:
            if len(items) >= MAX_ISSUE_DETAILS:
                break

            if issue.message == "Field is required.":
                rule = "campo obrigatório"
                description = "Campo obrigatório ausente."
            elif issue.message == "Duplicate value.":
                rule = "valor único"
                description = "Identificador duplicado no CSV."
            elif issue.message.startswith("Rule failed"):
                rule = rule_names.get(issue.field, "regra de validação")
                description = (
                    "Não foi possível avaliar a regra de validação."
                    if issue.message.startswith("Rule failed:")
                    else "Valor não atende à regra de validação."
                )
            else:
                # Unknown issue messages can contain raw input or exception text.
                rule = "regra de validação"
                description = "Inconsistência identificada na validação."

            items.append(
                {
                    "record_index": result.record_index,
                    "field": issue.field,
                    "rule": rule,
                    "description": description,
                }
            )
        if len(items) >= MAX_ISSUE_DETAILS:
            break

    return {
        "items": items,
        "returned_issues": len(items),
        "total_issues": total_issues,
        "limit": MAX_ISSUE_DETAILS,
        "truncated": total_issues > len(items),
        "record_index_base": 1,
    }
