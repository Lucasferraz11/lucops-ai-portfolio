import { ApiError, request } from './api'

export interface InvestigationEvidence {
  evidence_id: string
  kind: 'transaction' | 'quality' | 'ml'
  source: { dataset_id: string; record_index: number | null; function: string; field: string }
  description: string
  value: string | number | boolean | null
  expected: string | null
}

export interface InvestigationResult {
  schema_version: '1'
  mode: 'simulated' | 'openai'
  provider: string
  context: {
    schema_version: '1'
    dataset_id: string
    record_index: number
    transaction: { reference: string; original_value: string }
    inconsistencies: { field: string; message: string; observed_value: string | null; expected: string | null; evidence_id: string }[]
    ml: {
      status: 'evaluated' | 'ineligible' | 'unavailable'
      model_version: string | null
      anomaly_score: number | null
      is_anomaly: boolean | null
      reasons: string[]
      evidence_ids: string[]
    }
    evidence: InvestigationEvidence[]
    limitations: string[]
  }
  verified_evidence: InvestigationEvidence[]
  hypotheses: { description: string; evidence_ids: string[]; status: 'unconfirmed' }[]
  recommendations: { action: string; evidence_ids: string[] }[]
  limitations: string[]
  insufficient_evidence: string[]
  actions_executed: false
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
function positiveIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}
function nullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}
function evidence(value: unknown, datasetId: string): value is InvestigationEvidence {
  if (!object(value) || !object(value.source)) return false
  return typeof value.evidence_id === 'string' && value.evidence_id.startsWith(`${datasetId}:`) &&
    ['transaction', 'quality', 'ml'].includes(String(value.kind)) &&
    value.source.dataset_id === datasetId && (value.source.record_index === null || positiveIndex(value.source.record_index)) &&
    typeof value.source.function === 'string' && typeof value.source.field === 'string' &&
    typeof value.description === 'string' && nullableString(value.expected) &&
    (value.value === null || typeof value.value === 'string' || typeof value.value === 'boolean' ||
      (typeof value.value === 'number' && Number.isFinite(value.value)))
}

function isInvestigation(value: unknown, recordIndex: number): value is InvestigationResult {
  if (!object(value) || !object(value.context)) return false
  const c = value.context
  if (value.schema_version !== '1' || c.schema_version !== '1' ||
    !['simulated', 'openai'].includes(String(value.mode)) || typeof value.provider !== 'string' || !value.provider.trim() ||
    typeof c.dataset_id !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(c.dataset_id) || c.record_index !== recordIndex ||
    !object(c.transaction) || c.transaction.reference !== `${c.dataset_id}:record:${recordIndex}` ||
    typeof c.transaction.original_value !== 'string' || !object(c.ml) ||
    !strings(c.limitations) || !strings(value.limitations) || !strings(value.insufficient_evidence) || value.actions_executed !== false ||
    !Array.isArray(value.verified_evidence) || !Array.isArray(c.evidence) || !Array.isArray(c.inconsistencies) ||
    !Array.isArray(value.hypotheses) || !Array.isArray(value.recommendations)) return false
  const datasetId = c.dataset_id
  if (!value.verified_evidence.every((e) => evidence(e, datasetId))) return false
  const ids = new Set(value.verified_evidence.map((e) => e.evidence_id))
  const refs = (list: unknown, required = false) => strings(list) && (!required || list.length > 0) &&
    new Set(list).size === list.length && list.every((id) => ids.has(id))
  const ml = c.ml
  if (ids.size !== value.verified_evidence.length ||
    !c.evidence.every((e) => evidence(e, datasetId) && ids.has(e.evidence_id)) ||
    !c.inconsistencies.every((issue) => object(issue) && typeof issue.field === 'string' && typeof issue.message === 'string' &&
      nullableString(issue.observed_value) && nullableString(issue.expected) && typeof issue.evidence_id === 'string' && ids.has(issue.evidence_id)) ||
    !refs(ml.evidence_ids) || !strings(ml.reasons)) return false
  if (ml.status === 'evaluated') {
    if (typeof ml.model_version !== 'string' || !ml.model_version.trim() || typeof ml.anomaly_score !== 'number' ||
      !Number.isFinite(ml.anomaly_score) || typeof ml.is_anomaly !== 'boolean' || ml.is_anomaly !== (ml.anomaly_score > 0) || ml.reasons.length !== 0) return false
  } else if (!['ineligible', 'unavailable'].includes(String(ml.status)) || ml.model_version !== null ||
    ml.anomaly_score !== null || ml.is_anomaly !== null || ml.reasons.length === 0) return false
  return value.hypotheses.every((h) => object(h) && typeof h.description === 'string' && h.description.trim() &&
    h.status === 'unconfirmed' && refs(h.evidence_ids, true)) &&
    value.recommendations.every((r) => object(r) && typeof r.action === 'string' && r.action.trim() && refs(r.evidence_ids, true))
}

export async function createInvestigation(file: File, recordIndex: number, signal?: AbortSignal): Promise<InvestigationResult> {
  if (!positiveIndex(recordIndex)) throw new ApiError('Informe um índice inteiro a partir de 1.', 422)
  const form = new FormData()
  form.append('file', file)
  form.append('record_index', String(recordIndex))
  // This first React integration deliberately offers no paid-provider control.
  form.append('provider', 'simulated')
  let result: unknown
  try {
    result = await request('/investigations', { method: 'POST', body: form, signal })
  } catch (cause) {
    if (cause instanceof ApiError && cause.kind === 'http' && cause.status) {
      const messages: Record<number, string> = {
        400: 'CSV inválido para investigação. Confira a estrutura e as colunas obrigatórias.',
        404: 'O registro informado não existe neste CSV.',
        422: 'Arquivo ou índice de registro inválido para investigação.',
        500: 'O servidor não conseguiu concluir a investigação.',
        502: 'O servidor rejeitou uma resposta incompatível do provedor de investigação.',
        503: 'Provedor de investigação indisponível. Tente novamente mais tarde.',
      }
      if (messages[cause.status]) throw new ApiError(messages[cause.status], cause.status)
    }
    throw cause
  }
  if (!isInvestigation(result, recordIndex) || result.mode !== 'simulated') {
    throw new ApiError('A API retornou uma investigação incompatível com a solicitação.', undefined, 'response')
  }
  return result
}
