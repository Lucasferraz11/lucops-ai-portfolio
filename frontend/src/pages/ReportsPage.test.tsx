import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../routes'
import { AnalysisProvider, useAnalysis } from '../state/AnalysisContext'
import type { AnalysisResponse, AnomalyAnalysisResponse } from '../services/api'
import { investigationFixture } from '../test/investigationFixture'
import type { InvestigationResult } from '../services/investigations'
import { exportReportPdf } from '../reports/pdf'

vi.mock('../reports/pdf', () => ({ exportReportPdf: vi.fn() }))
beforeEach(() => vi.mocked(exportReportPdf).mockReset())

const quality: AnalysisResponse = {
  quality_status: 'COM INCONSISTÊNCIAS',
  summary: { total_records: 5, valid_records: 4, invalid_records: 1, total_issues: 2, valid_percentage: 80 },
}
const ml: AnomalyAnalysisResponse = {
  model_version: 'modelo-local-v1', evaluated_records: 4, skipped_records: 1, anomalies_detected: 1,
  results: [2, 3, 4, 5].map((index) => ({
    record_index: index, transaction_id: `T${index}`, original_value: '100',
    anomaly_score: index === 5 ? 0.12 : -0.1, is_anomaly: index === 5,
  })),
  ineligible: [{ record_index: 1, transaction_id: '', original_value: '-10', issues: [{ field: 'valor', message: 'Rule failed.', value: '-10', expected: 'positive' }] }],
}

function SessionControls() {
  const { selectFile, analyze, analyzeAnomalies, investigate, selectInvestigationIndex } = useAnalysis()
  return <>
    <button onClick={() => selectFile(new File(['csv sintético'], 'lote.csv'))}>Selecionar lote de teste</button>
    <button onClick={() => selectFile(new File(['outro csv'], 'novo.csv'))}>Substituir lote de teste</button>
    <button onClick={() => selectFile(null)}>Remover lote de teste</button>
    <button onClick={() => void analyze()}>Executar qualidade de teste</button>
    <button onClick={() => void analyzeAnomalies()}>Executar ML de teste</button>
    <button onClick={() => void investigate()}>Executar investigação de teste</button>
    <button onClick={() => selectInvestigationIndex('5')}>Selecionar índice 5 de teste</button>
    <button onClick={() => selectInvestigationIndex('1')}>Selecionar índice 1 de teste</button>
  </>
}

function mount(options: { quality?: AnalysisResponse; ml?: AnomalyAnalysisResponse; failOnRetry?: boolean; unavailableML?: boolean; investigation?: InvestigationResult } = {}) {
  const calls = new Map<string, number>()
  const fetchMock = vi.fn((url: string) => {
    if (url === '/health') return Promise.resolve(Response.json({ status: 'ok', service: 'LucOps AI' }))
    calls.set(url, (calls.get(url) ?? 0) + 1)
    if ((options.failOnRetry && calls.get(url)! > 1) || (options.unavailableML && url === '/anomaly-analyses')) {
      return Promise.resolve(Response.json({ detail: 'internal details must stay hidden' }, { status: 503 }))
    }
    if (url === '/analyses') return Promise.resolve(Response.json(options.quality ?? quality))
    if (url === '/anomaly-analyses') return Promise.resolve(Response.json(options.ml ?? ml))
    if (url === '/investigations') return Promise.resolve(Response.json(options.investigation ?? investigationFixture(5, 'evaluated')))
    return Promise.reject(new Error('Unexpected endpoint'))
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<MemoryRouter initialEntries={['/relatorios']}><AnalysisProvider><SessionControls /><AppRoutes /></AnalysisProvider></MemoryRouter>)
  return { fetchMock, calls }
}

async function perform(name: string) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })) })
}
const qualitySection = () => screen.getByRole('region', { name: 'Qualidade dos dados no relatório' })
const mlSection = () => screen.getByRole('region', { name: 'Machine Learning no relatório' })
const agentSection = () => screen.getByRole('region', { name: 'Investigação no relatório' })
function field(section: HTMLElement, label: string) {
  return within(section).getByText(label).nextElementSibling?.textContent
}
async function allAnalyses() {
  await perform('Executar qualidade de teste')
  await perform('Executar ML de teste')
  await perform('Selecionar índice 5 de teste')
  await perform('Executar investigação de teste')
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Relatórios da sessão', () => {
  it('orienta sem CSV e não executa análises ou apresenta métricas ilustrativas', async () => {
    const { calls } = mount()
    await act(async () => {})
    expect(screen.getByRole('heading', { name: 'Relatórios', level: 1 })).toBeTruthy()
    expect(screen.getByText('Nenhum CSV selecionado')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir para Visão Geral →' }).getAttribute('href')).toBe('/')
    expect(screen.queryByRole('region', { name: 'Indicadores consolidados' })).toBeNull()
    expect(calls.size).toBe(0)
    expect(screen.queryByText(/48\.520|84\.920|BATCH-Q3|Exportar em PDF/)).toBeNull()
  })

  it('identifica o CSV sem análises e mantém os três estados como não executados', async () => {
    const { calls } = mount()
    await perform('Selecionar lote de teste')
    expect(screen.getByRole('heading', { name: 'lote.csv' })).toBeTruthy()
    expect(screen.getByText(/Não há armazenamento do relatório no servidor/)).toBeTruthy()
    expect(screen.getByLabelText('Registros analisados: Não analisado')).toBeTruthy()
    expect(screen.getByLabelText('Anomalias sinalizadas: Não analisado')).toBeTruthy()
    expect(screen.getByLabelText('Registro investigado: Não executada')).toBeTruthy()
    expect(within(qualitySection()).getByText('Análise de qualidade não executada nesta sessão.')).toBeTruthy()
    expect(within(mlSection()).getByText('Análise de ML não executada nesta sessão.')).toBeTruthy()
    expect(within(agentSection()).getByText('Investigação não executada para a seleção atual.')).toBeTruthy()
    expect(calls.size).toBe(0)
    expect(screen.getByRole('button', { name: 'Exportar PDF' })).toBeTruthy()
  })

  it('consolida somente a qualidade com os agregados reais e formatação pt-BR', async () => {
    const { calls } = mount()
    await perform('Selecionar lote de teste')
    await perform('Executar qualidade de teste')
    expect(screen.getByLabelText('Registros analisados: 5')).toBeTruthy()
    expect(screen.getByLabelText('Qualidade dos dados: 80,00%')).toBeTruthy()
    expect(field(qualitySection(), 'Total de registros')).toBe('5')
    expect(field(qualitySection(), 'Registros válidos')).toBe('4')
    expect(field(qualitySection(), 'Registros inválidos')).toBe('1')
    expect(field(qualitySection(), 'Total de inconsistências')).toBe('2')
    expect(within(qualitySection()).getByText('COM INCONSISTÊNCIAS')).toBeTruthy()
    expect(screen.getByLabelText('Anomalias sinalizadas: Não analisado')).toBeTruthy()
    expect(calls.get('/anomaly-analyses')).toBeUndefined()
    expect(calls.get('/investigations')).toBeUndefined()
  })

  it('apresenta qualidade e ML independentes e exclui ignorados do percentual de anômalos', async () => {
    mount()
    await perform('Selecionar lote de teste')
    await perform('Executar qualidade de teste')
    await perform('Executar ML de teste')
    expect(field(mlSection(), 'Versão do modelo')).toBe('modelo-local-v1')
    expect(field(mlSection(), 'Registros avaliados')).toBe('4')
    expect(field(mlSection(), 'Registros ignorados')).toBe('1')
    expect(field(mlSection(), 'Anomalias detectadas')).toBe('1')
    expect(field(mlSection(), 'Percentual de anômalos')).toBe('25,00%')
    expect(field(qualitySection(), 'Total de inconsistências')).toBe('2')
    expect(screen.getByLabelText('Registro investigado: Não executada')).toBeTruthy()
  })

  it('mostra ML executado sem presumir que a qualidade foi analisada', async () => {
    mount()
    await perform('Selecionar lote de teste')
    await perform('Executar ML de teste')
    expect(screen.getByLabelText('Registros analisados: Não analisado')).toBeTruthy()
    expect(screen.getByLabelText('Anomalias sinalizadas: 1')).toBeTruthy()
    expect(within(qualitySection()).getByText('Análise de qualidade não executada nesta sessão.')).toBeTruthy()
  })

  it('resume uma investigação sem duplicar seu estado ou confundi-la com análise do lote', async () => {
    const { fetchMock, calls } = mount()
    await perform('Selecionar lote de teste')
    await perform('Selecionar índice 5 de teste')
    await perform('Executar investigação de teste')
    const result = investigationFixture(5, 'evaluated')
    expect(screen.getByLabelText('Registro investigado: #5')).toBeTruthy()
    expect(within(agentSection()).getByText('Modo simulado · sem LLM real')).toBeTruthy()
    expect(within(agentSection()).getByText(/O ML sinalizou um alerta estatístico/)).toBeTruthy()
    expect(field(agentSection(), 'Evidências verificadas')).toBe(String(result.verified_evidence.length))
    expect(field(agentSection(), 'Hipóteses não confirmadas')).toBe(String(result.hypotheses.length))
    expect(field(agentSection(), 'Recomendações')).toBe(String(result.recommendations.length))
    expect(within(agentSection()).getByText(result.insufficient_evidence[0])).toBeTruthy()
    expect(field(agentSection(), 'Conjunto de dados (SHA-256)')).toBe(result.context.dataset_id)
    expect(field(agentSection(), 'Referência do registro')).toBe(result.context.transaction.reference)
    expect(field(agentSection(), 'Provedor retornado')).toBe('deterministic-rules-v1')
    expect(field(agentSection(), 'Modo técnico')).toBe('simulated')
    expect(screen.getByLabelText('Anomalias sinalizadas: Não analisado')).toBeTruthy()
    expect(calls.get('/analyses')).toBeUndefined()
    expect(calls.get('/anomaly-analyses')).toBeUndefined()
    const request = fetchMock.mock.calls.find(([url]) => url === '/investigations')!
    expect(request).toBeTruthy()
  })

  it('diferencia zero anomalias de ML não executado', async () => {
    mount({ ml: { ...ml, anomalies_detected: 0, results: ml.results.map((item) => ({ ...item, anomaly_score: -0.1, is_anomaly: false })) } })
    await perform('Selecionar lote de teste')
    expect(screen.getByLabelText('Anomalias sinalizadas: Não analisado')).toBeTruthy()
    await perform('Executar ML de teste')
    expect(screen.getByLabelText('Anomalias sinalizadas: 0')).toBeTruthy()
    expect(field(mlSection(), 'Percentual de anômalos')).toBe('0,00%')
  })

  it('não inventa percentual quando nenhum registro foi avaliado', async () => {
    mount({ ml: {
      model_version: 'modelo-local-v1', evaluated_records: 0, skipped_records: 1, anomalies_detected: 0,
      results: [], ineligible: ml.ineligible,
    } })
    await perform('Selecionar lote de teste')
    await perform('Executar ML de teste')
    expect(field(mlSection(), 'Registros avaliados')).toBe('0')
    expect(field(mlSection(), 'Registros ignorados')).toBe('1')
    expect(field(mlSection(), 'Percentual de anômalos')).toBe('—')
    expect(within(mlSection()).getByText(/Nenhum registro avaliado/)).toBeTruthy()
  })

  it('preserva SEM DADOS e o percentual ausente de qualidade', async () => {
    mount({ quality: { quality_status: 'SEM DADOS', summary: { total_records: 0, valid_records: 0, invalid_records: 0, total_issues: 0, valid_percentage: null } } })
    await perform('Selecionar lote de teste')
    await perform('Executar qualidade de teste')
    expect(screen.getByLabelText('Registros analisados: 0')).toBeTruthy()
    expect(screen.getByLabelText('Qualidade dos dados: —')).toBeTruthy()
    expect(field(qualitySection(), 'Percentual de qualidade')).toBe('—')
    expect(within(qualitySection()).getByText('SEM DADOS')).toBeTruthy()
  })

  it('limpa qualidade, ML e investigação ao substituir o CSV e ao removê-lo', async () => {
    mount()
    await perform('Selecionar lote de teste')
    await allAnalyses()
    expect(screen.getByLabelText('Registro investigado: #5')).toBeTruthy()
    await perform('Substituir lote de teste')
    expect(screen.getByRole('heading', { name: 'novo.csv' })).toBeTruthy()
    expect(screen.queryByText('lote.csv')).toBeNull()
    expect(screen.getByLabelText('Registros analisados: Não analisado')).toBeTruthy()
    expect(screen.getByLabelText('Anomalias sinalizadas: Não analisado')).toBeTruthy()
    expect(screen.getByLabelText('Registro investigado: Não executada')).toBeTruthy()
    expect(screen.queryByText('modelo-local-v1')).toBeNull()
    expect(screen.queryByText('deterministic-rules-v1')).toBeNull()
    await perform('Remover lote de teste')
    expect(screen.getByText('Nenhum CSV selecionado')).toBeTruthy()
  })

  it('trocar o índice limpa somente a investigação e mantém qualidade e ML', async () => {
    mount()
    await perform('Selecionar lote de teste')
    await allAnalyses()
    await perform('Selecionar índice 1 de teste')
    expect(screen.getByLabelText('Registro investigado: Não executada')).toBeTruthy()
    expect(screen.queryByText('deterministic-rules-v1')).toBeNull()
    expect(screen.getByLabelText('Registros analisados: 5')).toBeTruthy()
    expect(screen.getByLabelText('Anomalias sinalizadas: 1')).toBeTruthy()
  })

  it('identifica resultados anteriores após falhas de atualização sem substituí-los por zero', async () => {
    mount({ failOnRetry: true })
    await perform('Selecionar lote de teste')
    await allAnalyses()
    await perform('Executar qualidade de teste')
    await perform('Executar ML de teste')
    await perform('Executar investigação de teste')
    expect(screen.getByLabelText('Registros analisados: 5')).toBeTruthy()
    expect(screen.getByLabelText('Anomalias sinalizadas: 1')).toBeTruthy()
    expect(screen.getByLabelText('Registro investigado: #5')).toBeTruthy()
    expect(within(qualitySection()).getByRole('status').textContent).toContain('última análise concluída')
    expect(within(mlSection()).getByRole('status').textContent).toContain('última análise concluída')
    expect(within(agentSection()).getByRole('status').textContent).toContain('última investigação concluída')
    expect(screen.queryByText('internal details must stay hidden')).toBeNull()
  })

  it('mostra ML indisponível sem concluir que existem zero anomalias', async () => {
    mount({ unavailableML: true })
    await perform('Selecionar lote de teste')
    await perform('Executar ML de teste')
    expect(screen.getByLabelText('Anomalias sinalizadas: Indisponível')).toBeTruthy()
    expect(within(mlSection()).getByText(/Sem resultado de ML confirmado/)).toBeTruthy()
    expect(screen.queryByLabelText('Anomalias sinalizadas: 0')).toBeNull()
    expect(screen.queryByText('internal details must stay hidden')).toBeNull()
  })

  it('preserva os resultados na navegação e não dispara novas análises ao voltar para Relatórios', async () => {
    const { calls } = mount()
    await perform('Selecionar lote de teste')
    await allAnalyses()
    const before = [...calls.entries()]
    fireEvent.click(screen.getByRole('link', { name: 'Consultar qualidade dos dados →' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Qualidade dos Dados' })).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Relatórios' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Relatórios' })).toBeTruthy()
    expect(screen.getByLabelText('Registro investigado: #5')).toBeTruthy()
    expect(screen.getByLabelText('Registros analisados: 5')).toBeTruthy()
    expect([...calls.entries()]).toEqual(before)
  })
})

function resultWithLimitations(count: number) {
  const result = investigationFixture(5, 'evaluated')
  const items = Array.from({ length: count }, (_, index) => `Limitação ${index + 1}: texto original do servidor, sem alteração.`)
  result.context.limitations = items.slice(0, 1)
  result.context.ml.reasons = []
  result.limitations = items.slice(1, -1)
  result.insufficient_evidence = count > 1 ? items.slice(-1) : []
  return { result, items }
}

describe('apresentação resumida das limitações', () => {
  it('mostra quatro itens, expande todos sem modificar os textos e permite recolher com controle acessível', async () => {
    const { result, items } = resultWithLimitations(8)
    items[7] = '<script>conteúdo não confiável</script> é apenas texto.'
    result.insufficient_evidence = [items[7]]
    const original = JSON.stringify(result)
    mount({ investigation: result })
    await perform('Selecionar lote de teste')
    await perform('Selecionar índice 5 de teste')
    await perform('Executar investigação de teste')
    const list = within(agentSection()).getByRole('list', { name: 'Limitações da investigação' })
    const button = screen.getByRole('button', { name: 'Ver todas as limitações' })
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(items.slice(0, 4))
    expect(screen.queryByText(items[4])).toBeNull()
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('aria-controls')).toBe(list.id)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(list.getAttribute('tabindex')).toBeNull()
    button.focus()
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: 'Mostrar menos' })).toBe(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(button)
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(items)
    expect(list.querySelector('script')).toBeNull()
    expect(list.getAttribute('tabindex')).toBe('0')
    expect(document.getElementById(list.getAttribute('aria-describedby')!)?.textContent).toContain('Role para consultar')
    expect(list.classList.contains('overflow-y-auto')).toBe(true)
    expect(list.classList.contains('max-h-96')).toBe(true)
    expect(screen.getByText('Evidências e interpretações disponíveis').parentElement?.parentElement?.classList.contains('items-start')).toBe(true)
    fireEvent.click(button)
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(items.slice(0, 4))
    expect(button.textContent).toBe('Ver todas as limitações')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(list.getAttribute('tabindex')).toBeNull()
    expect(JSON.stringify(result)).toBe(original)
    expect(screen.getByLabelText('Registro investigado: #5')).toBeTruthy()
    expect(field(agentSection(), 'Evidências verificadas')).toBe(String(result.verified_evidence.length))
  })

  it.each([0, 1, 4])('preserva %i limitações sem oferecer expansão desnecessária', async (count) => {
    const { result, items } = resultWithLimitations(count)
    mount({ investigation: result })
    await perform('Selecionar lote de teste')
    await perform('Selecionar índice 5 de teste')
    await perform('Executar investigação de teste')
    const list = within(agentSection()).queryByRole('list', { name: 'Limitações da investigação' })
    if (count === 0) {
      expect(list).toBeNull()
      expect(screen.getByText('Nenhuma limitação foi informada na resposta. Isso não comprova ausência de limitações.')).toBeTruthy()
    } else {
      expect(within(list!).getAllByRole('listitem').map((item) => item.textContent)).toEqual(items)
    }
    expect(screen.queryByRole('button', { name: 'Ver todas as limitações' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mostrar menos' })).toBeNull()
  })

  it.each(['índice', 'CSV'])('descarta a expansão ao trocar %s e inicia a próxima investigação com quatro itens', async (selection) => {
    const { result } = resultWithLimitations(8)
    mount({ investigation: result })
    await perform('Selecionar lote de teste')
    await perform('Selecionar índice 5 de teste')
    await perform('Executar investigação de teste')
    await perform('Ver todas as limitações')
    await perform(selection === 'índice' ? 'Selecionar índice 1 de teste' : 'Substituir lote de teste')
    expect(screen.queryByRole('list', { name: 'Limitações da investigação' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mostrar menos' })).toBeNull()
    await perform('Selecionar índice 5 de teste')
    await perform('Executar investigação de teste')
    expect(within(screen.getByRole('list', { name: 'Limitações da investigação' })).getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Ver todas as limitações' }).getAttribute('aria-expanded')).toBe('false')
  })
})

describe('exportação explícita do relatório', () => {
  it('exporta a sessão completa sem executar análises novamente ou enviar dados adicionais', async () => {
    const { calls } = mount()
    await perform('Selecionar lote de teste')
    await allAnalyses()
    const before = [...calls.entries()]
    vi.mocked(exportReportPdf).mockResolvedValue(undefined)
    await perform('Exportar PDF')
    expect(exportReportPdf).toHaveBeenCalledTimes(1)
    const data = vi.mocked(exportReportPdf).mock.calls[0][0]
    expect(data.selectedFile?.name).toBe('lote.csv')
    expect(data.analysis?.summary).toEqual(quality.summary)
    expect(data.anomaly.result).toEqual(ml)
    expect(data.investigation.result?.context.record_index).toBe(5)
    expect([...calls.entries()]).toEqual(before)
    expect(screen.getByRole('status').textContent).toContain('Download do PDF iniciado')
  })

  it('permite exportar somente os resultados disponíveis e mantém ausências como null', async () => {
    mount()
    await perform('Selecionar lote de teste')
    await perform('Executar qualidade de teste')
    vi.mocked(exportReportPdf).mockResolvedValue(undefined)
    await perform('Exportar PDF')
    const data = vi.mocked(exportReportPdf).mock.calls[0][0]
    expect(data.analysis?.summary.total_records).toBe(5)
    expect(data.anomaly.result).toBeNull()
    expect(data.investigation.result).toBeNull()
  })

  it('exporta CSV sem análises somente por ação explícita', async () => {
    const { calls } = mount()
    expect(screen.queryByRole('button', { name: 'Exportar PDF' })).toBeNull()
    await perform('Selecionar lote de teste')
    expect(exportReportPdf).not.toHaveBeenCalled()
    vi.mocked(exportReportPdf).mockResolvedValue(undefined)
    await perform('Exportar PDF')
    expect(vi.mocked(exportReportPdf).mock.calls[0][0].analysis).toBeNull()
    expect(calls.size).toBe(0)
  })

  it('bloqueia clique duplicado durante a geração', async () => {
    let finish!: () => void
    vi.mocked(exportReportPdf).mockReturnValue(new Promise<void>((resolve) => { finish = resolve }))
    mount()
    await perform('Selecionar lote de teste')
    await perform('Exportar PDF')
    const button = screen.getByRole('button', { name: 'Gerando PDF…' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(button)
    expect(exportReportPdf).toHaveBeenCalledTimes(1)
    await act(async () => { finish() })
    expect(screen.getByRole('button', { name: 'Exportar PDF' }).hasAttribute('disabled')).toBe(false)
  })

  it('mostra erro compreensível sem expor detalhes internos e permite nova tentativa', async () => {
    vi.mocked(exportReportPdf).mockRejectedValueOnce(new Error('secret file content')).mockResolvedValueOnce(undefined)
    mount()
    await perform('Selecionar lote de teste')
    await perform('Exportar PDF')
    expect(screen.getByRole('alert').textContent).toBe('Não foi possível gerar ou baixar o PDF. Tente novamente.')
    expect(screen.queryByText('secret file content')).toBeNull()
    await perform('Exportar PDF')
    expect(exportReportPdf).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Download do PDF iniciado')
  })

  it('limpa mensagens e usa somente os dados do novo CSV, ignorando uma falha antiga', async () => {
    let rejectOld!: (reason: Error) => void
    vi.mocked(exportReportPdf).mockReturnValueOnce(new Promise<void>((_resolve, reject) => { rejectOld = reject })).mockResolvedValueOnce(undefined)
    mount()
    await perform('Selecionar lote de teste')
    await allAnalyses()
    await perform('Exportar PDF')
    await perform('Substituir lote de teste')
    expect(screen.queryByText(/Gerando o PDF/)).toBeNull()
    await act(async () => { rejectOld(new Error('old failure')) })
    expect(screen.queryByRole('alert')).toBeNull()
    await perform('Exportar PDF')
    const current = vi.mocked(exportReportPdf).mock.calls[1][0]
    expect(current.selectedFile?.name).toBe('novo.csv')
    expect(current.analysis).toBeNull()
    expect(current.anomaly.result).toBeNull()
    expect(current.investigation.result).toBeNull()
  })
  it('não inicia um download antigo se o CSV mudar antes de carregar o gerador', async () => {
    vi.mocked(exportReportPdf).mockResolvedValue(undefined)
    mount()
    await perform('Selecionar lote de teste')
    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }))
    fireEvent.click(screen.getByRole('button', { name: 'Substituir lote de teste' }))
    await act(async () => {})
    expect(exportReportPdf).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'novo.csv' })).toBeTruthy()
    expect(screen.queryByText(/Download do PDF iniciado/)).toBeNull()
  })

})
