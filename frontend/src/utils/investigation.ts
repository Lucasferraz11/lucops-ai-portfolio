import type { InvestigationEvidence, InvestigationResult } from '../services/investigations'

export function investigationSummary(result: InvestigationResult): string {
  const issues = result.context.inconsistencies
  const duplicate = result.verified_evidence.some((e) => e.source.function === 'lucops.agents.tools.find_duplicates' && e.source.field === 'id_transacao')
  const ml = result.context.ml
  const facts = issues.length
    ? `As regras identificaram ${issues.length} inconsistência(s) neste registro.`
    : 'As regras de qualidade não identificaram inconsistências neste registro.'
  const statistical = ml.status === 'evaluated'
    ? ml.is_anomaly ? 'O ML sinalizou um alerta estatístico que requer revisão contextual.' : 'O ML não sinalizou alerta estatístico neste registro.'
    : ml.status === 'ineligible' ? 'O registro é inelegível para ML e não recebeu pontuação.' : 'A avaliação de ML está indisponível; isso não demonstra ausência de anomalias.'
  return `${facts}${duplicate ? ' A ferramenta de investigação encontrou outro registro com o mesmo identificador no CSV.' : ''} ${statistical}`
}

export function evidenceDescription(item: InvestigationEvidence): string {
  if (item.source.function === 'lucops.ingestion.load_csv' && item.source.field === 'valor') {
    if (item.value === null || item.value === '') return 'Valor não informado no registro do CSV.'
    return item.value === '[redacted]' ? 'Valor ocultado pelo servidor por proteção de dados.' : 'Valor informado no registro do CSV.'
  }
  return ({
    'Field is required.': 'Campo obrigatório não preenchido.',
    'Rule failed.': 'O valor não atende à regra de qualidade.',
    'Duplicate value.': 'Identificador repetido neste CSV.',
  } as Record<string, string>)[item.description] ?? item.description
}

export function displayEvidenceValue(value: InvestigationEvidence['value']): string {
  if (value === '[redacted]') return 'Ocultado pelo servidor'
  if (value === null || value === '') return 'Não informado'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return String(value)
}
