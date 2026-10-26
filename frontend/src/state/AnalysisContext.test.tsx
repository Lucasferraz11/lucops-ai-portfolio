import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../routes'
import { AnalysisProvider } from './AnalysisContext'

const healthy = () => new Response(JSON.stringify({ status: 'ok', service: 'LucOps AI' }), { status: 200 })
const analyzed = () => new Response(JSON.stringify({
  quality_status: 'SEM INCONSISTÊNCIAS',
  summary: { total_records: 1, valid_records: 1, invalid_records: 0, total_issues: 0, valid_percentage: 100 },
}), { status: 200 })

function mount() {
  return render(<MemoryRouter initialEntries={['/']}><AnalysisProvider><AppRoutes /></AnalysisProvider></MemoryRouter>)
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('monitor de conexão e sessão', () => {
  it('transita entre verificando, conectada, indisponível e recuperada sem perder a análise', async () => {
    let completeInitial!: (response: Response) => void
    const initial = new Promise<Response>((resolve) => { completeInitial = resolve })
    let available = true
    const fetchMock = vi.fn((url: string) => {
      if (url === '/analyses') return Promise.resolve(analyzed())
      if (fetchMock.mock.calls.length === 1) return initial
      return Promise.resolve(available ? healthy() : new Response('', { status: 500 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    let tick!: () => void
    const nativeSetInterval = globalThis.setInterval
    const nativeClearInterval = globalThis.clearInterval
    const interval = vi.spyOn(globalThis, 'setInterval').mockImplementation((callback, delay) => {
      if (delay === 30_000) {
        tick = callback as () => void
        return 123 as unknown as ReturnType<typeof setInterval>
      }
      return nativeSetInterval(callback, delay)
    })
    const clear = vi.spyOn(globalThis, 'clearInterval').mockImplementation((id) => {
      if (id !== (123 as unknown as ReturnType<typeof setInterval>)) nativeClearInterval(id)
    })
    const view = mount()
    expect(screen.getByTestId('api-connection').textContent).toBe('Verificando conexão')
    expect(screen.getByText('Consultando o servidor')).toBeTruthy()
    await act(async () => { completeInitial(healthy()) })
    await waitFor(() => expect(screen.getByTestId('api-connection').textContent).toBe('API conectada'))
    expect(screen.getByText('Servidor disponível para análises')).toBeTruthy()

    const file = new File(['id_transacao,cliente_id,valor\nA,C,10\n'], 'sessao.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText('Arquivo CSV'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByText('Análise disponível nesta sessão')

    available = false
    await act(async () => { tick() })
    await waitFor(() => expect(screen.getByTestId('api-connection').textContent).toBe('API indisponível'))
    expect(screen.getByText('Não foi possível acessar o servidor')).toBeTruthy()
    expect(screen.getByLabelText('Registros analisados: 1')).toBeTruthy()
    expect(screen.getByText('Análise disponível nesta sessão')).toBeTruthy()

    available = true
    await act(async () => { tick() })
    await waitFor(() => expect(screen.getByTestId('api-connection').textContent).toBe('API conectada'))
    view.unmount()
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 30_000)
    expect(clear).toHaveBeenCalledWith(123)
  })

  it('mostra indisponibilidade antes da primeira análise', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    mount()
    await waitFor(() => expect(screen.getByTestId('api-connection').textContent).toBe('API indisponível'))
    expect(screen.getAllByText('Nenhum lote analisado').length).toBeGreaterThan(0)
  })

  it('evita health checks concorrentes e cancela a requisição ao desmontar', () => {
    const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    vi.stubGlobal('fetch', fetchMock)
    let tick!: () => void
    vi.spyOn(globalThis, 'setInterval').mockImplementation((callback) => {
      tick = callback as () => void
      return 456 as unknown as ReturnType<typeof setInterval>
    })
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {})
    const view = mount()
    act(() => { tick(); tick() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const signal = (fetchMock.mock.calls[0][1] as RequestInit).signal
    view.unmount()
    expect(signal?.aborted).toBe(true)
  })
})
