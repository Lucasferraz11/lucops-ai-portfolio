export type QualityStatus = 'SEM DADOS' | 'COM INCONSISTÊNCIAS' | 'SEM INCONSISTÊNCIAS'

export interface QualitySummary {
  total_records: number
  valid_records: number
  invalid_records: number
  total_issues: number
  valid_percentage: number | null
}

export interface AnalysisIssue {
  record_index: number
  field: string
  rule: string
  description: string
}

export interface AnalysisDetails {
  items: AnalysisIssue[]
  returned_issues: number
  total_issues: number
  limit: number
  truncated: boolean
  record_index_base: 1
}

export interface AnalysisResponse {
  quality_status: QualityStatus
  summary: QualitySummary
  details?: AnalysisDetails
}

export interface HealthResponse {
  status: 'ok'
  service: 'LucOps AI'
}

export interface AnomalyResult {
  record_index: number
  transaction_id: string
  original_value: string
  anomaly_score: number
  is_anomaly: boolean
}

export interface IneligibleTransaction {
  record_index: number
  transaction_id: string
  original_value: string
  issues: { field: string; message: string; value: unknown; expected: unknown }[]
}

export interface AnomalyAnalysisResponse {
  model_version: string
  evaluated_records: number
  skipped_records: number
  anomalies_detected: number
  results: AnomalyResult[]
  ineligible: IneligibleTransaction[]
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const HEALTH_TIMEOUT_MS = 5_000
const ANALYSIS_TIMEOUT_MS = 30_000

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'proxy' | 'response'

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number, public readonly kind: ApiErrorKind = 'http') {
    super(message)
    this.name = 'ApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isAnalysisDetails(value: unknown, totalIssues: number): value is AnalysisDetails {
  if (!isRecord(value) || !Array.isArray(value.items)) return false
  return (
    value.items.every((item) => isRecord(item) &&
      isNonnegativeInteger(item.record_index) && item.record_index >= 1 &&
      typeof item.field === 'string' && typeof item.rule === 'string' && typeof item.description === 'string') &&
    isNonnegativeInteger(value.returned_issues) &&
    value.returned_issues === value.items.length &&
    isNonnegativeInteger(value.total_issues) &&
    value.total_issues === totalIssues &&
    isNonnegativeInteger(value.limit) && value.limit > 0 &&
    value.returned_issues <= value.limit && value.returned_issues <= value.total_issues &&
    typeof value.truncated === 'boolean' &&
    value.truncated === (value.returned_issues < value.total_issues) &&
    value.record_index_base === 1
  )
}

function isAnalysisResponse(value: unknown): value is AnalysisResponse {
  if (!isRecord(value) || !isRecord(value.summary)) return false
  const summary = value.summary
  return (
    (value.quality_status === 'SEM DADOS' || value.quality_status === 'COM INCONSISTÊNCIAS' || value.quality_status === 'SEM INCONSISTÊNCIAS') &&
    typeof summary.total_records === 'number' &&
    typeof summary.valid_records === 'number' &&
    typeof summary.invalid_records === 'number' &&
    typeof summary.total_issues === 'number' &&
    (typeof summary.valid_percentage === 'number' || summary.valid_percentage === null) &&
    (!('details' in value) || isAnalysisDetails(value.details, summary.total_issues as number))
  )
}

function isAnomalyAnalysisResponse(value: unknown): value is AnomalyAnalysisResponse {
  if (!isRecord(value) || !Array.isArray(value.results) || !Array.isArray(value.ineligible)) return false
  const hasIdentity = (item: unknown): item is Record<string, unknown> => isRecord(item) &&
    isNonnegativeInteger(item.record_index) && item.record_index >= 1 &&
    typeof item.transaction_id === 'string' && typeof item.original_value === 'string'
  return typeof value.model_version === 'string' && value.model_version.length > 0 &&
    isNonnegativeInteger(value.evaluated_records) && value.evaluated_records === value.results.length &&
    isNonnegativeInteger(value.skipped_records) && value.skipped_records === value.ineligible.length &&
    value.results.every((item) => hasIdentity(item) && typeof item.anomaly_score === 'number' &&
      Number.isFinite(item.anomaly_score) && typeof item.is_anomaly === 'boolean') &&
    value.ineligible.every((item) => hasIdentity(item) && Array.isArray(item.issues) && item.issues.every(
      (issue) => isRecord(issue) && typeof issue.field === 'string' && typeof issue.message === 'string' &&
        'value' in issue && 'expected' in issue,
    )) &&
    isNonnegativeInteger(value.anomalies_detected) &&
    value.anomalies_detected === value.results.filter((item) => item.is_anomaly === true).length
}

export async function request(path: '/health' | '/analyses' | '/anomaly-analyses' | '/investigations', options?: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  options?.signal?.addEventListener('abort', onAbort, { once: true })
  if (options?.signal?.aborted) controller.abort()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, path === '/health' ? HEALTH_TIMEOUT_MS : ANALYSIS_TIMEOUT_MS)
  try {
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal })
    } catch (error) {
      if (options?.signal?.aborted) throw error
      if (timedOut) throw new ApiError('A API demorou demais para responder. Tente novamente.', undefined, 'timeout')
      if (isRecord(error) && error.name === 'AbortError') throw error
      throw new ApiError('Falha de rede ao acessar a API. Verifique a conexão e o servidor.', undefined, 'network')
    }

    let body: string
    try {
      body = await response.text()
    } catch (error) {
      if (options?.signal?.aborted) throw error
      if (timedOut) throw new ApiError('A API demorou demais para responder. Tente novamente.', undefined, 'timeout')
      throw new ApiError('Não foi possível ler a resposta da API.', response.status, 'response')
    }

    // Vite 6 returns an empty text/plain HTTP 500 when its local proxy cannot reach the target.
    // A second health check distinguishes this signature from a working backend returning 500.
    if (path !== '/health' && response.status === 500 && !body &&
        response.headers.get('content-type')?.startsWith('text/plain') && import.meta.env.DEV && !baseUrl) {
      try {
        await getHealth(controller.signal)
      } catch (error) {
        if (options?.signal?.aborted) throw error
        if (timedOut) throw new ApiError('A API demorou demais para responder. Tente novamente.', undefined, 'timeout')
        throw new ApiError('O proxy local não conseguiu confirmar a conexão com a API.', 500, 'proxy')
      }
    }

    let payload: unknown
    try {
      payload = JSON.parse(body)
    } catch {
      if (!response.ok) throw new ApiError(`A análise falhou (HTTP ${response.status}). Tente novamente.`, response.status)
      throw new ApiError('A API retornou uma resposta inválida.', response.status, 'response')
    }

    if (!response.ok) {
      const detail = isRecord(payload) ? payload.detail : undefined
      const message = response.status === 400 && typeof detail === 'string'
        ? detail
        : response.status === 422
          ? 'Arquivo ou parâmetros de envio inválidos.'
          : `A análise falhou (HTTP ${response.status}). Tente novamente.`
      throw new ApiError(message, response.status)
    }

    return payload
  } finally {
    clearTimeout(timer)
    options?.signal?.removeEventListener('abort', onAbort)
  }
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const result = await request('/health', { signal })
  if (!isRecord(result) || result.status !== 'ok' || result.service !== 'LucOps AI') {
    throw new ApiError('A API retornou uma resposta de saúde inválida.', undefined, 'response')
  }
  return result as unknown as HealthResponse
}

export async function createAnalysis(file: File, signal?: AbortSignal): Promise<AnalysisResponse> {
  const form = new FormData()
  form.append('file', file)
  form.append('include_details', 'true')
  const result = await request('/analyses', { method: 'POST', body: form, signal })
  if (!isAnalysisResponse(result)) {
    throw new ApiError('A API retornou um resultado de análise incompatível.', undefined, 'response')
  }
  return result
}

export async function createAnomalyAnalysis(file: File, signal?: AbortSignal): Promise<AnomalyAnalysisResponse> {
  const form = new FormData()
  form.append('file', file)
  let result: unknown
  try {
    result = await request('/anomaly-analyses', { method: 'POST', body: form, signal })
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 503) {
      throw new ApiError('Modelo de ML indisponível no servidor. Solicite ao administrador a configuração de um modelo compatível.', 503)
    }
    throw cause
  }
  if (!isAnomalyAnalysisResponse(result)) {
    throw new ApiError('A API retornou um resultado de anomalias incompatível.', undefined, 'response')
  }
  return result
}
