import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../routes'
import { AnalysisProvider, useAnalysis } from '../state/AnalysisContext'
import { investigationFixture } from '../test/investigationFixture'

const quality = { quality_status: 'COM INCONSISTÊNCIAS', summary: { total_records: 2, valid_records: 1, invalid_records: 1, total_issues: 1, valid_percentage: 50 } }
const ml = { model_version: 'test-v1', evaluated_records: 1, skipped_records: 1, anomalies_detected: 1,
  results: [{ record_index: 2, transaction_id: 'B', original_value: '1000000', anomaly_score: 0.1, is_anomaly: true }],
  ineligible: [{ record_index: 1, transaction_id: 'A', original_value: '-10', issues: [{ field: 'valor', message: 'Rule failed.', value: '-10', expected: 'rule check passed' }] }],
}

function SessionControls() {
  const { selectFile, investigate } = useAnalysis()
  return <>
    <button onClick={() => selectFile(new File(['csv'], 'outro.csv'))}>Trocar CSV de teste</button>
    <button onClick={() => selectFile(null)}>Remover CSV de teste</button>
    <button onClick={() => { void investigate(); void investigate() }}>Solicitar investigação duas vezes</button>
  </>
}

function mount(investigate: (url: string, options?: RequestInit) => Promise<Response>, path = '/') {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === '/health') return Promise.resolve(Response.json({ status: 'ok', service: 'LucOps AI' }))
    if (url === '/analyses') return Promise.resolve(Response.json(quality))
    if (url === '/anomaly-analyses') return Promise.resolve(Response.json(ml))
    return investigate(url, options)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { ...render(<MemoryRouter initialEntries={[path]}><AnalysisProvider><SessionControls /><AppRoutes /></AnalysisProvider></MemoryRouter>), fetchMock }
}

function choose() {
  const file = new File(['id_transacao,cliente_id,valor\nA,C,-10\nB,C,1000000'], 'lote.csv')
  fireEvent.change(screen.getByLabelText('Arquivo CSV'), { target: { files: [file] } })
  return file
}
function navigate() { fireEvent.click(screen.getByRole('link', { name: 'Investigações com IA' })) }
function execute() { fireEvent.click(screen.getByRole('button', { name: 'Investigar com IA' })) }

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Investigações com IA integradas', () => {
  it('orienta sem CSV e não chama agente automaticamente ao selecionar arquivo ou índice', () => {
    const investigate = vi.fn()
    mount(investigate, '/investigacoes')
    expect(screen.getByText('Nenhum CSV selecionado')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Investigar com IA' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Ir para Visão Geral →' }))
    choose()
    navigate()
    fireEvent.change(screen.getByLabelText('Índice do registro'), { target: { value: '2' } })
    expect(screen.getByText('Modo simulado · sem LLM real')).toBeTruthy()
    expect(screen.getByText('Nenhuma investigação executada para esta seleção.')).toBeTruthy()
    expect(screen.queryByRole('option', { name: /openai/i })).toBeNull()
    expect(investigate).not.toHaveBeenCalled()
  })

  it('investiga explicitamente o arquivo e índice da sessão e conserva o resultado na navegação', async () => {
    const investigate = vi.fn().mockResolvedValue(Response.json(investigationFixture(2)))
    mount(investigate)
    const file = choose()
    navigate()
    fireEvent.change(screen.getByLabelText('Índice do registro'), { target: { value: '2' } })
    execute()
    await screen.findByText('Investigação concluída')
    expect(screen.getByLabelText('Registro investigado: #2')).toBeTruthy()
    const form = (investigate.mock.calls[0][1] as RequestInit).body as FormData
    expect(form.get('file')).toBe(file)
    expect(form.get('record_index')).toBe('2')
    expect(form.get('provider')).toBe('simulated')
    expect(screen.getByText('Hipóteses não confirmadas')).toBeTruthy()
    expect(screen.getByText('Limitações e informações não comprovadas')).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Visão Geral' }))
    navigate()
    expect(screen.getByLabelText('Registro investigado: #2')).toBeTruthy()
    expect(investigate).toHaveBeenCalledTimes(1)
  })

  it('rejeita índice inválido sem enviar e mostra erro 404 para índice desconhecido do lote', async () => {
    const investigate = vi.fn().mockResolvedValue(Response.json({ detail: 'missing' }, { status: 404 }))
    mount(investigate)
    choose()
    navigate()
    const input = screen.getByLabelText('Índice do registro')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.submit(input.closest('form')!)
    expect(screen.getByRole('alert').textContent).toContain('índice inteiro existente')
    expect(investigate).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '99' } })
    execute()
    expect((await screen.findByRole('alert')).textContent).toContain('não existe neste CSV')
    expect(screen.queryByText('Investigação concluída')).toBeNull()
  })

  it('bloqueia envios duplicados enquanto a investigação está em andamento', () => {
    const investigate = vi.fn().mockReturnValue(new Promise<Response>(() => {}))
    mount(investigate)
    choose()
    navigate()
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar investigação duas vezes' }))
    expect(screen.getByRole('button', { name: 'Investigando…' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('em andamento')
    expect(investigate).toHaveBeenCalledTimes(1)
  })

  it.each([503, 'network'] as const)('preserva qualidade e ML em falha da investigação: %s', async (error) => {
    mount(() => error === 'network' ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(Response.json({ detail: 'secret' }, { status: error })))
    choose()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByText('Análise disponível nesta sessão')
    fireEvent.click(screen.getByRole('link', { name: 'Detecção de Anomalias' }))
    fireEvent.click(screen.getByRole('button', { name: 'Executar análise de anomalias' }))
    await screen.findByText('Análise de anomalias concluída')
    navigate()
    const select = screen.getByLabelText('Atalhos dos resultados disponíveis')
    fireEvent.change(select, { target: { value: '2' } })
    expect((screen.getByLabelText('Índice do registro') as HTMLInputElement).value).toBe('2')
    execute()
    expect((await screen.findByRole('alert')).textContent).toContain(error === 503 ? 'indisponível' : 'Falha de rede')
    expect(screen.queryByText('Investigação concluída')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Visão Geral' }))
    expect(screen.getByLabelText('Registros analisados: 2')).toBeTruthy()
    expect(screen.getByLabelText('Anomalias sinalizadas: 1')).toBeTruthy()
  })

  it.each(['arquivo', 'registro', 'remoção'])('cancela e ignora resposta antiga após mudança de %s', async (selection) => {
    let finish!: (response: Response) => void
    let signal: AbortSignal | undefined
    mount((_url, options) => { signal = options?.signal as AbortSignal; return new Promise((resolve) => { finish = resolve }) })
    choose()
    navigate()
    execute()
    if (selection === 'arquivo') fireEvent.click(screen.getByRole('button', { name: 'Trocar CSV de teste' }))
    if (selection === 'remoção') fireEvent.click(screen.getByRole('button', { name: 'Remover CSV de teste' }))
    if (selection === 'registro') fireEvent.change(screen.getByLabelText('Índice do registro'), { target: { value: '2' } })
    expect(signal?.aborted).toBe(true)
    await act(async () => { finish(Response.json(investigationFixture())) })
    expect(screen.queryByRole('region', { name: 'Resultado da investigação' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('uma resposta antiga não sobrescreve a investigação mais recente', async () => {
    let old!: (response: Response) => void
    const investigate = vi.fn().mockReturnValueOnce(new Promise<Response>((resolve) => { old = resolve }))
      .mockResolvedValueOnce(Response.json(investigationFixture(2)))
    mount(investigate)
    choose()
    navigate()
    execute()
    fireEvent.change(screen.getByLabelText('Índice do registro'), { target: { value: '2' } })
    execute()
    await screen.findByText('Investigação concluída')
    await act(async () => { old(Response.json(investigationFixture())) })
    expect(screen.getByLabelText('Registro investigado: #2')).toBeTruthy()
    expect(screen.queryByLabelText('Registro investigado: #1')).toBeNull()
  })

  it('preserva resultado anterior apenas na reanálise da mesma seleção', async () => {
    const investigate = vi.fn().mockResolvedValueOnce(Response.json(investigationFixture())).mockResolvedValueOnce(Response.json({ detail: 'internal' }, { status: 500 }))
    mount(investigate)
    choose()
    navigate()
    execute()
    await screen.findByText('Investigação concluída')
    execute()
    await screen.findByRole('alert')
    expect(screen.getByText('Última investigação concluída deste registro')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Índice do registro'), { target: { value: '2' } })
    expect(screen.queryByRole('region', { name: 'Resultado da investigação' })).toBeNull()
  })

  it('limita índices quando a contagem já foi confirmada no servidor', async () => {
    const investigate = vi.fn()
    mount(investigate)
    choose()
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByText('Análise disponível nesta sessão')
    navigate()
    const input = screen.getByLabelText('Índice do registro')
    expect(input.getAttribute('max')).toBe('2')
    expect(input.getAttribute('min')).toBe('1')
    expect(input.getAttribute('step')).toBe('1')
    expect(input.getAttribute('aria-describedby')).toBe('investigation-index-help')
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.submit(input.closest('form')!)
    expect(screen.getByRole('alert').textContent).toContain('índice inteiro existente')
    expect(investigate).not.toHaveBeenCalled()
  })

  it('cancela a investigação ao desmontar o contexto', () => {
    let signal: AbortSignal | undefined
    const view = mount((_url, options) => { signal = options?.signal as AbortSignal; return new Promise(() => {}) })
    choose()
    navigate()
    execute()
    view.unmount()
    expect(signal?.aborted).toBe(true)
  })
})
