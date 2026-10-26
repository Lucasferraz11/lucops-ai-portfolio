import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '../routes'
import { AnalysisProvider } from '../state/AnalysisContext'

const result = {
  quality_status: 'COM INCONSISTÊNCIAS',
  summary: { total_records: 3, valid_records: 1, invalid_records: 2, total_issues: 4, valid_percentage: 33.33 },
}

function mount() {
  const analysisFetch = globalThis.fetch
  vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) =>
    url === '/health'
      ? Promise.resolve(new Response(JSON.stringify({ status: 'ok', service: 'LucOps AI' }), { status: 200 }))
      : analysisFetch(url, options),
  ))
  return render(<MemoryRouter initialEntries={['/']}><AnalysisProvider><AppRoutes /></AnalysisProvider></MemoryRouter>)
}

function choose(name = 'lote.csv') {
  const file = new File(['id_transacao,cliente_id,valor\nA,C,10\n'], name, { type: 'text/csv' })
  fireEvent.change(screen.getByLabelText('Arquivo CSV'), { target: { files: [file] } })
  return file
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Visão Geral integrada', () => {
  it('seleciona CSV, envia e atualiza somente os indicadores existentes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    expect(screen.getByRole('button', { name: 'Analisar qualidade' }).hasAttribute('disabled')).toBe(true)
    choose()
    expect(screen.getByTestId('selected-file').textContent).toBe('lote.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Análise de qualidade concluída para lote.csv.')
    expect(screen.getByLabelText('Registros analisados: 3')).toBeTruthy()
    expect(screen.getByLabelText('Qualidade dos dados: 33,33%')).toBeTruthy()
    expect(screen.getByLabelText('Inconsistências encontradas: 4')).toBeTruthy()
    expect(screen.getByLabelText('Anomalias sinalizadas: Não analisado')).toBeTruthy()
    expect(screen.getByText('1 válidos · 2 inválidos')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Distribuição do lote: 1 válidos e 2 inválidos' })).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aceita arrastar e soltar um CSV', () => {
    mount()
    const zone = screen.getByText('Arraste um arquivo CSV para cá').parentElement!
    const file = new File(['a'], 'arrastado.csv', { type: 'text/csv' })
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    expect(screen.getByTestId('selected-file').textContent).toBe('arrastado.csv')
    expect(screen.getByRole('button', { name: 'Analisar qualidade' }).hasAttribute('disabled')).toBe(false)
  })

  it('mostra o erro de CSV inválido sem resultados de qualidade', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: 'CSV inválido: coluna ausente' }), { status: 400 })))
    mount()
    choose()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    expect((await screen.findByRole('alert')).textContent).toContain('CSV inválido: coluna ausente')
    expect(screen.getByLabelText('Registros analisados: —')).toBeTruthy()
  })

  it('mostra erro de API indisponível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    mount()
    choose()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Falha de rede ao acessar a API')
  })

  it('preserva o último resultado ao falhar a reanálise e recupera na tentativa seguinte', async () => {
    const updated = {
      quality_status: 'SEM INCONSISTÊNCIAS',
      summary: { total_records: 3, valid_records: 3, invalid_records: 0, total_issues: 0, valid_percentage: 100 },
    }
    let rejectUpdate!: (reason: Error) => void
    const pending = new Promise<Response>((_resolve, reject) => { rejectUpdate = reject })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 }))
      .mockReturnValueOnce(pending)
      .mockResolvedValueOnce(new Response(JSON.stringify(updated), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    choose()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByText('Análise disponível nesta sessão')
    expect(screen.getByText('Análise disponível')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    expect(screen.getByText('Atualizando análise. O resultado anterior permanece visível até a conclusão.')).toBeTruthy()
    expect(screen.getByLabelText('Registros analisados: 3')).toBeTruthy()
    rejectUpdate(new TypeError('Failed to fetch'))
    expect((await screen.findByRole('alert')).textContent).toContain('Os resultados exibidos pertencem à última análise concluída deste arquivo.')
    expect(screen.getByText('Última atualização falhou')).toBeTruthy()
    expect(screen.getByText('Resultado anterior disponível')).toBeTruthy()
    expect(screen.getByLabelText('Inconsistências encontradas: 4')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByText('Análise disponível nesta sessão')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('Qualidade dos dados: 100,00%')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('preserva indicadores quando o backend retorna HTTP 500 de verdade', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 }))
      .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } }))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    choose()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    expect((await screen.findByRole('alert')).textContent).toContain('HTTP 500')
    expect(screen.getByLabelText('Registros analisados: 3')).toBeTruthy()
    expect(screen.queryByText('Internal Server Error')).toBeNull()
  })

  it('limpa resultados ao substituir o arquivo e ignora respostas atrasadas', async () => {
    let finish!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => { finish = resolve })
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 })).mockReturnValueOnce(pending)
    vi.stubGlobal('fetch', fetchMock)
    mount()
    choose('primeiro.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    choose('segundo.csv')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByLabelText('Registros analisados: —')).toBeTruthy()
    expect(screen.getAllByText('Nenhum lote analisado').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    choose('terceiro.csv')
    finish(new Response(JSON.stringify(result), { status: 200 }))
    await waitFor(() => expect(screen.getByTestId('selected-file').textContent).toBe('terceiro.csv'))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByLabelText('Registros analisados: —')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Analisar qualidade' }).hasAttribute('disabled')).toBe(false)
  })

  it('bloqueia envios duplicados enquanto a requisição está pendente', async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(() => {}))
    vi.stubGlobal('fetch', fetchMock)
    mount()
    choose()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    expect(screen.getByRole('button', { name: 'Analisando...' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Analisando...' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('mantém o resultado na sessão ao navegar e rejeita arquivo não CSV', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(result), { status: 200 })))
    mount()
    choose()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))
    expect(screen.getByLabelText('Registros válidos: 1')).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Visão Geral' }))
    expect(screen.getByLabelText('Registros analisados: 3')).toBeTruthy()
    choose('arquivo.txt')
    expect((screen.getByRole('alert')).textContent).toContain('.csv')
    expect(screen.getByLabelText('Registros analisados: —')).toBeTruthy()
  })
})
