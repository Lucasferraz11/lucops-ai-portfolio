import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAnomalyAnalysis, type AnomalyAnalysisResponse } from './api'

const file = new File(['id_transacao,cliente_id,valor\nA,C,1000000'], 'lote.csv')
const result: AnomalyAnalysisResponse = {
  model_version: 'test-v1', evaluated_records: 1, skipped_records: 1, anomalies_detected: 1,
  results: [{ record_index: 1, transaction_id: 'A', original_value: '1000000', anomaly_score: 0.12, is_anomaly: true }],
  ineligible: [{ record_index: 2, transaction_id: '', original_value: '-1', issues: [
    { field: 'valor', message: 'Rule failed.', value: '-1', expected: 'rule check passed' },
  ] }],
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('cliente de anomalias', () => {
  it('envia somente file e preserva índices, score, classificação e inelegibilidade', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(result))
    vi.stubGlobal('fetch', fetchMock)
    expect(await createAnomalyAnalysis(file)).toEqual(result)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/anomaly-analyses')
    expect(options.method).toBe('POST')
    expect(options.headers).toBeUndefined()
    expect([...(options.body as FormData).keys()]).toEqual(['file'])
    expect((options.body as FormData).get('file')).toBe(file)
  })

  it('aceita resposta vazia e zero anomalias sem transformar ausência em execução', async () => {
    const empty = { model_version: 'v1', evaluated_records: 0, skipped_records: 0, anomalies_detected: 0, results: [], ineligible: [] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(empty)))
    expect(await createAnomalyAnalysis(file)).toEqual(empty)
  })

  it.each([
    { ...result, evaluated_records: 4 },
    { ...result, skipped_records: 0 },
    { ...result, anomalies_detected: 0 },
    { ...result, results: [{ ...result.results[0], record_index: 0 }] },
    { ...result, results: [{ ...result.results[0], anomaly_score: '0.12' }] },
    { ...result, results: [{ ...result.results[0], is_anomaly: 'true' }] },
    { ...result, ineligible: [{ ...result.ineligible[0], issues: [{}] }] },
    { results: [], ineligible: [] },
  ])('rejeita contrato incompatível %#', async (invalid) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(invalid)))
    await expect(createAnomalyAnalysis(file)).rejects.toMatchObject({ kind: 'response' })
  })

  it.each([400, 422, 503, 500])('preserva HTTP %i sem expor configuração interna', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: status === 400 ? 'CSV inválido: coluna ausente' : '/private/model.joblib' }, { status })))
    const pending = createAnomalyAnalysis(file)
    await expect(pending).rejects.toMatchObject({ status, kind: 'http' })
    await expect(pending).rejects.not.toThrow('/private/')
  })

  it('trata falha de rede sem resultado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(createAnomalyAnalysis(file)).rejects.toMatchObject({ kind: 'network' })
  })

  it.each(['timeout', 'cancelamento'])('reutiliza prazo e cancelamento: %s', async (mode) => {
    vi.useFakeTimers()
    const external = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')))
    })))
    const pending = createAnomalyAnalysis(file, external.signal)
    const assertion = expect(pending).rejects.toMatchObject(mode === 'timeout' ? { kind: 'timeout' } : { name: 'AbortError' })
    if (mode === 'timeout') await vi.advanceTimersByTimeAsync(30_000)
    else external.abort()
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })
})


describe('consistencia dos resultados de ML', () => {
  it.each([
    { ...result, results: [{ ...result.results[0], anomaly_score: 0, is_anomaly: false }], anomalies_detected: 0 },
    { ...result, results: [{ ...result.results[0], anomaly_score: -0.2, is_anomaly: false }], anomalies_detected: 0 },
    { ...result, evaluated_records: 2, skipped_records: 0, anomalies_detected: 1, ineligible: [], results: [
      { ...result.results[0], record_index: 2 },
      { ...result.results[0], record_index: 1, anomaly_score: -2, is_anomaly: false },
    ] },
    { ...result, evaluated_records: 0, skipped_records: 1, anomalies_detected: 0, results: [], ineligible: [
      { ...result.ineligible[0], record_index: 1 },
    ] },
  ])('aceita zero, score sem limite arbitrario e IDs repetidos com indices distintos %#', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)))
    expect(await createAnomalyAnalysis(file)).toEqual(payload)
  })

  it.each([
    ...['evaluated_records', 'skipped_records', 'anomalies_detected'].flatMap((field) =>
      [-1, 0.5, Number.MAX_SAFE_INTEGER + 1].map((value) => ({ ...result, [field]: value }))),
    { ...result, results: [{ ...result.results[0], record_index: 1.5 }] },
    { ...result, ineligible: [{ ...result.ineligible[0], record_index: 0 }] },
    { ...result, ineligible: [{ ...result.ineligible[0], record_index: 1.5 }] },
    { ...result, ineligible: [{ ...result.ineligible[0], record_index: 1 }] },
    { ...result, evaluated_records: 2, anomalies_detected: 2, results: [result.results[0], result.results[0]] },
    { ...result, skipped_records: 2, ineligible: [result.ineligible[0], result.ineligible[0]] },
    { ...result, results: [{ ...result.results[0], anomaly_score: 0 }] },
    { ...result, results: [{ ...result.results[0], anomaly_score: -0.1 }] },
    { ...result, results: [{ ...result.results[0], is_anomaly: false }], anomalies_detected: 0 },
    { ...result, ineligible: [{ ...result.ineligible[0], issues: [] }] },
    { ...result, model_version: '   ' },
  ])('rejeita contagens, indices ou classificacoes incoerentes %#', async (payload) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)))
    await expect(createAnomalyAnalysis(file)).rejects.toMatchObject({ kind: 'response' })
  })

  it.each(['evaluated_records', 'skipped_records', 'anomalies_detected', 'score', 'index'])(
    'rejeita numero nao finito em %s', async (field) => {
      const payload = field === 'score'
        ? { ...result, results: [{ ...result.results[0], anomaly_score: 'OVERFLOW' }] }
        : field === 'index'
          ? { ...result, results: [{ ...result.results[0], record_index: 'OVERFLOW' }] }
          : { ...result, [field]: 'OVERFLOW' }
      const body = JSON.stringify(payload).replace('"OVERFLOW"', '1e400')
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })))
      await expect(createAnomalyAnalysis(file)).rejects.toMatchObject({ kind: 'response' })
    },
  )
})
