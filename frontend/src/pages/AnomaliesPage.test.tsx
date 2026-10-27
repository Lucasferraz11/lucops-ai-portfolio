import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../routes'
import { AnalysisProvider, useAnalysis } from '../state/AnalysisContext'
import type { AnomalyAnalysisResponse } from '../services/api'

const result: AnomalyAnalysisResponse = {
  model_version: 'test-v1', evaluated_records: 2, skipped_records: 1, anomalies_detected: 1,
  results: [
    { record_index: 1, transaction_id: 'A', original_value: '10', anomaly_score: -0.2, is_anomaly: false },
    { record_index: 2, transaction_id: 'B', original_value: '1000000', anomaly_score: 0.1, is_anomaly: true },
  ],
  ineligible: [{ record_index: 3, transaction_id: '', original_value: '-1', issues: [{ field: 'valor', message: 'Rule failed.', value: '-1', expected: 'rule check passed' }] }],
}
const quality = {
  quality_status: 'COM INCONSISTÊNCIAS',
  summary: { total_records: 3, valid_records: 2, invalid_records: 1, total_issues: 1, valid_percentage: 66.67 },
}

// Session controls exercise the same provider used by the actual upload component.
function SessionControls() {
  const { selectFile, analyzeAnomalies, anomaly } = useAnalysis()
  return <>
    <button onClick={() => selectFile(new File(['id_transacao,cliente_id,valor\nA,C,10'], 'outro.csv'))}>Substituir CSV de teste</button>
    <button onClick={() => selectFile(null)}>Remover CSV de teste</button>
    <button onClick={() => { void analyzeAnomalies(); void analyzeAnomalies() }}>Solicitar ML duas vezes</button>
    <span data-testid="ml-status">{anomaly.status}</span>
  </>
}

function mount(anomalyFetch: (url: string, options?: RequestInit) => Promise<Response>, path = '/') {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (url === '/health') return Promise.resolve(Response.json({ status: 'ok', service: 'LucOps AI' }))
    if (url === '/analyses') return Promise.resolve(Response.json(quality))
    return anomalyFetch(url, options)
  })
  vi.stubGlobal('fetch', fetchMock)
  const view = render(<MemoryRouter initialEntries={[path]}><AnalysisProvider><SessionControls /><AppRoutes /></AnalysisProvider></MemoryRouter>)
  return { ...view, fetchMock }
}

function selectAndNavigate() {
  fireEvent.change(screen.getByLabelText('Arquivo CSV'), { target: { files: [new File(['csv'], 'lote.csv')] } })
  fireEvent.click(screen.getByRole('link', { name: 'Detecção de Anomalias' }))
}
function execute() { fireEvent.click(screen.getByRole('button', { name: 'Executar análise de anomalias' })) }

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Detecção de Anomalias integrada', () => {
  it('orienta sem CSV, bloqueia execução e não dispara ML no upload', async () => {
    const ml = vi.fn().mockResolvedValue(Response.json(result))
    mount(ml, '/anomalias')
    expect(screen.getByText('Nenhum CSV selecionado')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Executar análise de anomalias' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar ML duas vezes' }))
    fireEvent.click(screen.getByRole('link', { name: 'Ir para Visão Geral →' }))
    selectAndNavigate()
    expect(screen.getByText(/ML não analisado/)).toBeTruthy()
    expect(ml).not.toHaveBeenCalled()
  })

  it('executa explicitamente, exibe contagens reais e mantém resultado ao navegar', async () => {
    mount(() => Promise.resolve(Response.json(result)))
    selectAndNavigate()
    expect(screen.getByText('lote.csv')).toBeTruthy()
    execute()
    expect(await screen.findByText('Análise de anomalias concluída')).toBeTruthy()
    expect(screen.getByLabelText('Registros avaliados: 2')).toBeTruthy()
    expect(screen.getByLabelText('Registros ignorados: 1')).toBeTruthy()
    expect(screen.getByLabelText('Anomalias sinalizadas: 1')).toBeTruthy()
    expect(screen.getByLabelText('Percentual de anômalos: 50,00%')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Distribuição de ML: 1 normais e 1 anômalos' })).toBeTruthy()
    expect(screen.getByText(/Registros ignorados são inelegíveis/)).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Visão Geral' }))
    expect(screen.getByLabelText('Anomalias sinalizadas: 1')).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Detecção de Anomalias' }))
    expect(screen.getByText('Análise de anomalias concluída')).toBeTruthy()
  })

  it('distingue zero anomalias de ML não executado', async () => {
    const zero = { ...result, anomalies_detected: 0, results: result.results.map((r) => ({ ...r, anomaly_score: -0.1, is_anomaly: false })) }
    mount(() => Promise.resolve(Response.json(zero)))
    selectAndNavigate()
    execute()
    await screen.findByText('Análise de anomalias concluída')
    expect(screen.getByText('Nenhuma anomalia foi sinalizada entre os registros avaliados.')).toBeTruthy()
    expect(screen.getByLabelText('Percentual de anômalos: 0,00%')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Distribuição de ML: 2 normais e 0 anômalos' })).toBeTruthy()
    expect(screen.queryByText(/ML não analisado/)).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Visão Geral' }))
    expect(screen.getByLabelText('Anomalias sinalizadas: 0')).toBeTruthy()
  })

  it('não interpreta ausência de registros avaliados como ausência de anomalias', async () => {
    mount(() => Promise.resolve(Response.json({ ...result, evaluated_records: 0, anomalies_detected: 0, results: [] })))
    selectAndNavigate()
    execute()
    expect(await screen.findByText('Nenhum registro foi avaliado pelo modelo; não é possível concluir ausência de anomalias.')).toBeTruthy()
    expect(screen.queryByText('Nenhuma anomalia foi sinalizada entre os registros avaliados.')).toBeNull()
    expect(screen.getByLabelText('Percentual de anômalos: —')).toBeTruthy()
    expect(screen.queryByRole('img', { name: /Distribuição de ML/ })).toBeNull()
    expect(screen.getByText('Registro #3 · Inelegível')).toBeTruthy()
  })

  it('apresenta carregamento e impede solicitações concorrentes', async () => {
    const ml = vi.fn().mockReturnValue(new Promise<Response>(() => {}))
    mount(ml)
    selectAndNavigate()
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar ML duas vezes' }))
    expect(screen.getByRole('button', { name: 'Analisando anomalias…' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('em andamento')
    expect(ml).toHaveBeenCalledTimes(1)
  })

  it.each([400, 503, 'network'] as const)('não conclui em erro %s e preserva qualidade', async (failure) => {
    mount(() => failure === 'network' ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(Response.json({ detail: failure === 400 ? 'CSV inválido: coluna ausente' : 'internal/path' }, { status: failure })))
    fireEvent.change(screen.getByLabelText('Arquivo CSV'), { target: { files: [new File(['csv'], 'lote.csv')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByText('Análise disponível nesta sessão')
    fireEvent.click(screen.getByRole('link', { name: 'Detecção de Anomalias' }))
    execute()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(failure === 503 ? 'Modelo de ML indisponível' : failure === 400 ? 'CSV inválido' : 'Falha de rede')
    expect(alert.textContent).not.toContain('internal/path')
    expect(screen.getByTestId('ml-status').textContent).toBe(failure === 503 ? 'unavailable' : 'error')
    expect(screen.queryByText('Análise de anomalias concluída')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))
    expect(screen.getByLabelText('Registros válidos: 2')).toBeTruthy()
  })

  it.each(['Substituir CSV de teste', 'Remover CSV de teste'])('cancela ML e limpa estado ao %s, ignorando retorno antigo', async (action) => {
    let finish!: (value: Response) => void
    let signal: AbortSignal | undefined
    mount((_url, options) => { signal = options?.signal as AbortSignal; return new Promise((resolve) => { finish = resolve }) })
    selectAndNavigate()
    execute()
    fireEvent.click(screen.getByRole('button', { name: action }))
    expect(signal?.aborted).toBe(true)
    await act(async () => { finish(Response.json(result)) })
    expect(screen.queryByText('Análise de anomalias concluída')).toBeNull()
    expect(screen.getByTestId('ml-status').textContent).toBe('not-analyzed')
  })

  it('resposta antiga não sobrescreve uma análise mais recente', async () => {
    let old!: (value: Response) => void
    const ml = vi.fn().mockReturnValueOnce(new Promise<Response>((resolve) => { old = resolve }))
      .mockResolvedValueOnce(Response.json({ ...result, model_version: 'new-v2' }))
    mount(ml)
    selectAndNavigate()
    execute()
    fireEvent.click(screen.getByRole('button', { name: 'Substituir CSV de teste' }))
    execute()
    await screen.findByText('new-v2')
    await act(async () => { old(Response.json(result)) })
    expect(screen.getByText('new-v2')).toBeTruthy()
    expect(screen.queryByText('test-v1')).toBeNull()
    expect(screen.getByText('outro.csv')).toBeTruthy()
  })

  it('limpa resultado confirmado ao trocar CSV e mantém o anterior apenas em falha do mesmo CSV', async () => {
    const ml = vi.fn().mockResolvedValueOnce(Response.json(result)).mockRejectedValueOnce(new TypeError('offline'))
    mount(ml)
    selectAndNavigate()
    execute()
    await screen.findByText('Análise de anomalias concluída')
    execute()
    await screen.findByRole('alert')
    expect(screen.getByText('Última análise de anomalias concluída deste arquivo')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Substituir CSV de teste' }))
    expect(screen.queryByRole('region', { name: 'Resultado da análise de anomalias' })).toBeNull()
    expect(screen.getByText(/ML não analisado/)).toBeTruthy()
  })

  it('cancela a requisição de ML ao desmontar o provedor', async () => {
    let signal: AbortSignal | undefined
    const view = mount((_url, options) => { signal = options?.signal as AbortSignal; return new Promise(() => {}) })
    selectAndNavigate()
    execute()
    view.unmount()
    await waitFor(() => expect(signal?.aborted).toBe(true))
  })

  it('calcula 20% sobre cinco avaliados, excluindo ignorados, sem inventar métricas', async () => {
    const five = { ...result, evaluated_records: 5, results: [
      ...result.results,
      ...[4, 5, 6].map((index) => ({ ...result.results[0], record_index: index })),
    ] }
    mount(() => Promise.resolve(Response.json(five)))
    selectAndNavigate()
    execute()
    await screen.findByText('Análise de anomalias concluída')
    expect(screen.getByLabelText('Percentual de anômalos: 20,00%')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Distribuição de ML: 4 normais e 1 anômalos' })).toBeTruthy()
    expect(screen.queryByText(/LOF|Z-Score|Recalibrar|Anomalia Crítica|Últimas 24 horas/)).toBeNull()
  })

  it('limpa cards, gráfico, tabela e indicador da Visão Geral ao substituir o CSV', async () => {
    mount(() => Promise.resolve(Response.json(result)))
    selectAndNavigate()
    execute()
    await screen.findByText('Análise de anomalias concluída')
    expect(screen.getByRole('table')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver dados do registro #2' }))
    expect(screen.getByRole('region', { name: 'Dados técnicos do registro #2' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Substituir CSV de teste' }))
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Dados técnicos do registro #2' })).toBeNull()
    expect(screen.queryByLabelText('Registros avaliados: 2')).toBeNull()
    expect(screen.queryByRole('img', { name: /Distribuição de ML/ })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Visão Geral' }))
    expect(screen.getByLabelText('Anomalias sinalizadas: Não analisado')).toBeTruthy()
  })

  it('mantém a ausência de dados distinta de zero anomalias em registros avaliados', async () => {
    mount(() => Promise.resolve(Response.json({ ...result, evaluated_records: 0, skipped_records: 0, anomalies_detected: 0, results: [], ineligible: [] })))
    selectAndNavigate()
    execute()
    await screen.findByText('Análise de anomalias concluída')
    expect(screen.getByLabelText('Registros avaliados: 0')).toBeTruthy()
    expect(screen.getByLabelText('Percentual de anômalos: —')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('Nenhum registro foi ignorado nesta análise.')).toBeTruthy()
  })
})
