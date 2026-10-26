import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createAnalysis, getHealth } from './api'

const csv = new File(['id_transacao,cliente_id,valor\nA,C,10\n'], 'lote.csv', { type: 'text/csv' })
const result = {
  quality_status: 'SEM INCONSISTÊNCIAS',
  summary: { total_records: 1, valid_records: 1, invalid_records: 0, total_issues: 0, valid_percentage: 100 },
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('cliente da FastAPI', () => {
  it('consulta /health e envia o CSV no campo multipart file', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', service: 'LucOps AI' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getHealth()).toEqual({ status: 'ok', service: 'LucOps AI' })
    expect(await createAnalysis(csv)).toEqual(result)
    expect(fetchMock.mock.calls[0][0]).toBe('/health')
    expect(fetchMock.mock.calls[1][0]).toBe('/analyses')
    const options = fetchMock.mock.calls[1][1] as RequestInit
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect((options.body as FormData).get('file')).toBe(csv)
    expect((options.body as FormData).get('include_details')).toBe('true')
    expect(options.headers).toBeUndefined()
  })

  it('preserva os detalhes opcionais da mesma resposta e aceita o contrato antigo', async () => {
    const withDetails = {
      ...result,
      details: { items: [], returned_issues: 0, total_issues: 0, limit: 200, truncated: false, record_index_base: 1 },
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(withDetails), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await createAnalysis(csv)).toEqual(withDetails)
    expect(await createAnalysis(csv)).toEqual(result)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejeita detalhes incompatíveis em vez de tratá-los como lista vazia', async () => {
    const malformed = {
      ...result,
      details: { items: [], returned_issues: 0, total_issues: 2, limit: 200, truncated: false, record_index_base: 1 },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(malformed), { status: 200 })))
    await expect(createAnalysis(csv)).rejects.toMatchObject({ kind: 'response', message: 'A API retornou um resultado de análise incompatível.' })
  })

  it('apresenta o detalhe do CSV inválido e preserva o status HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'CSV inválido: coluna ausente' }), { status: 400 })))
    await expect(createAnalysis(csv)).rejects.toMatchObject({ message: 'CSV inválido: coluna ausente', status: 400 })
  })

  it('trata erro HTTP sem exibir detalhes internos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'segredo interno' }), { status: 503 })))
    await expect(createAnalysis(csv)).rejects.toMatchObject({ message: 'A análise falhou (HTTP 503). Tente novamente.', status: 503 })
  })

  it('preserva o status quando o erro HTTP não contém JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 500 })))
    await expect(createAnalysis(csv)).rejects.toMatchObject({ message: 'A análise falhou (HTTP 500). Tente novamente.', status: 500 })
  })

  it('distingue HTTP 500 real de falha do proxy local', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createAnalysis(csv)).rejects.toMatchObject({ status: 500, kind: 'http' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const proxyFetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 500, headers: { 'Content-Type': 'text/plain' } }))
      .mockResolvedValueOnce(new Response('', { status: 500, headers: { 'Content-Type': 'text/plain' } }))
    vi.stubGlobal('fetch', proxyFetch)
    await expect(createAnalysis(csv)).rejects.toMatchObject({ status: 500, kind: 'proxy', message: 'O proxy local não conseguiu confirmar a conexão com a API.' })
    expect(proxyFetch.mock.calls[1][0]).toBe('/health')
  })

  it('não confunde um HTTP 500 vazio com proxy indisponível quando /health responde', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 500, headers: { 'Content-Type': 'text/plain' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'ok', service: 'LucOps AI' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createAnalysis(csv)).rejects.toMatchObject({ status: 500, kind: 'http' })
  })

  it('distingue API indisponível de resposta incompatível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(createAnalysis(csv)).rejects.toThrow('Falha de rede ao acessar a API')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ summary: {} }), { status: 200 })))
    await expect(createAnalysis(csv)).rejects.toThrow('resultado de análise incompatível')
  })

  it('trata validação HTTP 422 com mensagem compreensível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [] }), { status: 422 })))
    await expect(createAnalysis(csv)).rejects.toMatchObject({ message: 'Arquivo ou parâmetros de envio inválidos.', status: 422 })
  })

  it('preserva o erro de cancelamento para impedir atualização obsoleta', async () => {
    const aborted = new DOMException('aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted))
    await expect(createAnalysis(csv)).rejects.toBe(aborted)
    expect(new ApiError('erro').name).toBe('ApiError')
  })

  it('distingue timeout de falha de rede', async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })))
      const result = createAnalysis(csv)
      const assertion = expect(result).rejects.toMatchObject({ kind: 'timeout', message: 'A API demorou demais para responder. Tente novamente.' })
      await vi.advanceTimersByTimeAsync(30_000)
      await assertion
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('mantém o prazo até o corpo terminar e limpa recursos após sucesso', async () => {
    vi.useFakeTimers()
    const external = new AbortController()
    const add = vi.spyOn(external.signal, 'addEventListener')
    const remove = vi.spyOn(external.signal, 'removeEventListener')
    const response = new Response(JSON.stringify(result), { status: 200 })
    vi.spyOn(response, 'text').mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve(JSON.stringify(result)), 100)
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    const pending = createAnalysis(csv, external.signal)
    await vi.advanceTimersByTimeAsync(99)
    expect(remove).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toEqual(result)
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('interrompe o corpo pendente após receber os cabeçalhos, usando o mesmo prazo', async () => {
    vi.useFakeTimers()
    const external = new AbortController()
    const remove = vi.spyOn(external.signal, 'removeEventListener')
    let networkSignal: AbortSignal | undefined
    const response = new Response('', { status: 200 })
    const readBody = vi.spyOn(response, 'text').mockImplementation(() => new Promise((_resolve, reject) => {
      networkSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => {
      networkSignal = options.signal as AbortSignal
      return Promise.resolve(response)
    }))
    const pending = createAnalysis(csv, external.signal)
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(29_999)
    expect(readBody).toHaveBeenCalledOnce()
    expect(networkSignal?.aborted).toBe(false)
    expect(remove).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await assertion
    expect(networkSignal?.aborted).toBe(true)
    expect(remove).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['fetch', 'body'])('preserva cancelamento externo durante %s e limpa recursos', async (phase) => {
    vi.useFakeTimers()
    const external = new AbortController()
    const remove = vi.spyOn(external.signal, 'removeEventListener')
    const aborted = new DOMException('cancelled', 'AbortError')
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => {
      const pending = () => new Promise<string>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(aborted), { once: true })
      })
      if (phase === 'fetch') return pending()
      const response = new Response('', { status: 200 })
      vi.spyOn(response, 'text').mockImplementation(pending)
      return Promise.resolve(response)
    }))
    const pending = createAnalysis(csv, external.signal)
    const assertion = expect(pending).rejects.toBe(aborted)
    await vi.advanceTimersByTimeAsync(0)
    external.abort()
    await assertion
    expect(remove).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['network', 'body', 'json', 'http'])('limpa temporizador e listener após erro de %s', async (phase) => {
    vi.useFakeTimers()
    const external = new AbortController()
    const remove = vi.spyOn(external.signal, 'removeEventListener')
    const response = new Response(phase === 'json' ? 'invalid' : JSON.stringify({ detail: 'erro' }), { status: phase === 'http' ? 503 : 200 })
    if (phase === 'body') vi.spyOn(response, 'text').mockRejectedValue(new Error('read failed'))
    vi.stubGlobal('fetch', phase === 'network'
      ? vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      : vi.fn().mockResolvedValue(response))
    await expect(createAnalysis(csv, external.signal)).rejects.toBeInstanceOf(ApiError)
    expect(remove).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
})
