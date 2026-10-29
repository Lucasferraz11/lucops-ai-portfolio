import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInvestigation } from './investigations'
import { investigationFixture } from '../test/investigationFixture'

const file = new File(['id_transacao,cliente_id,valor\nT1,C1,-10'], 'lote.csv')
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('cliente de investigações', () => {
  it('envia somente arquivo, índice base 1 e simulated explicitamente', async () => {
    const result = investigationFixture()
    const fetchMock = vi.fn().mockResolvedValue(Response.json(result))
    vi.stubGlobal('fetch', fetchMock)
    expect(await createInvestigation(file, 1)).toEqual(result)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/investigations')
    expect(options.method).toBe('POST')
    expect(options.headers).toBeUndefined()
    const form = options.body as FormData
    expect([...form.keys()]).toEqual(['file', 'record_index', 'provider'])
    expect(form.get('file')).toBe(file)
    expect(form.get('record_index')).toBe('1')
    expect(form.get('provider')).toBe('simulated')
  })

  it.each([0, -1, 1.5, NaN])('rejeita índice inválido %s sem requisição', async (index) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(createInvestigation(file, index)).rejects.toMatchObject({ status: 422 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['unavailable', 'evaluated'] as const)('aceita estado de ML válido: %s', async (status) => {
    const result = investigationFixture(1, status)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(result)))
    expect((await createInvestigation(file, 1)).context.ml).toEqual(result.context.ml)
  })

  it.each([400, 404, 422, 500, 502, 503])('trata HTTP %i sem detalhes sensíveis ou fallback', async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ detail: '/private/key-secret' }, { status }))
    vi.stubGlobal('fetch', fetchMock)
    const pending = createInvestigation(file, 1)
    await expect(pending).rejects.toMatchObject({ status })
    await expect(pending).rejects.not.toThrow('key-secret')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(['record', 'reference', 'confirmed', 'mode', 'dataset', 'prediction', 'actions', 'missing-fields'])('rejeita resposta incompatível: %s', async (kind) => {
    const result = investigationFixture()
    let payload: unknown = result
    if (kind === 'record') result.context.record_index = 2
    if (kind === 'reference') result.hypotheses[0].evidence_ids = ['inexistente']
    if (kind === 'confirmed') payload = { ...result, hypotheses: [{ ...result.hypotheses[0], status: 'confirmed' }] }
    if (kind === 'mode') result.mode = 'openai'
    if (kind === 'dataset') result.verified_evidence[0].source.dataset_id = `sha256:${'b'.repeat(64)}`
    if (kind === 'prediction') result.context.ml.is_anomaly = false
    if (kind === 'actions') payload = { ...result, actions_executed: true }
    if (kind === 'missing-fields') payload = { mode: 'simulated', context: {} }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)))
    await expect(createInvestigation(file, 1)).rejects.toMatchObject({ kind: 'response' })
  })

  it('distingue falha de rede de resposta JSON inválida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(createInvestigation(file, 1)).rejects.toMatchObject({ kind: 'network' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('invalid', { status: 200 })))
    await expect(createInvestigation(file, 1)).rejects.toMatchObject({ kind: 'response' })
  })

  it.each(['timeout', 'cancelamento'])('reutiliza timeout e cancelamento: %s', async (mode) => {
    vi.useFakeTimers()
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')))
    })))
    const pending = createInvestigation(file, 1, controller.signal)
    const assertion = expect(pending).rejects.toMatchObject(mode === 'timeout' ? { kind: 'timeout' } : { name: 'AbortError' })
    if (mode === 'timeout') await vi.advanceTimersByTimeAsync(30_000)
    else controller.abort()
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })
})
