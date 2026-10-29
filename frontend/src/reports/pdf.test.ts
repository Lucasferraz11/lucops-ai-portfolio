// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { jsPDF } from 'jspdf'
import { buildReportSections, createReportPdf, exportReportPdf, reportFilename, selectExecutiveLimitations, type ReportSession } from './pdf'
import { investigationFixture } from '../test/investigationFixture'

const { savePdf } = vi.hoisted(() => ({ savePdf: vi.fn() }))
vi.mock('jspdf', async (importOriginal) => {
  const original = await importOriginal<typeof import('jspdf')>()
  return {
    ...original,
    jsPDF: class extends original.jsPDF {
      constructor(...args: ConstructorParameters<typeof original.jsPDF>) {
        super(...args)
        this.save = savePdf as typeof this.save
        this.circle = vi.fn(this.circle.bind(this))
        this.path = vi.fn(this.path.bind(this))
      }
    },
  }
})

const generatedAt = new Date('2026-10-29T15:04:05Z')
function session(): ReportSession {
  return {
    selectedFile: new File(['conteúdo não enviado'], 'teste_anomalias.csv'),
    analysis: { quality_status: 'SEM INCONSISTÊNCIAS', summary: { total_records: 5, valid_records: 5, invalid_records: 0, total_issues: 0, valid_percentage: 100 } },
    isAnalyzing: false, error: null,
    anomaly: { status: 'success', error: null, result: {
      model_version: 'modelo-local-v1', evaluated_records: 5, skipped_records: 0, anomalies_detected: 1,
      results: [], ineligible: [],
    } },
    investigation: { status: 'success', error: null, result: investigationFixture(5, 'evaluated') },
  }
}
function section(data: ReportSession, title: string) {
  return buildReportSections(data, generatedAt).find((item) => item.title === title)!
}
function printedPages(doc: jsPDF): string[] {
  const unicode = (doc.getFont().metadata as { toUnicode: Record<number, number> }).toUnicode
  const pages = doc.internal.pages as unknown as string[][]
  return pages.slice(1).map((commands) => commands.flatMap((command) =>
    [...command.matchAll(/<([0-9a-f]+)>\s*Tj/gi)].map((match) =>
      (match[1].match(/.{4}/g) ?? []).map((glyph) => String.fromCodePoint(unicode[parseInt(glyph, 16)])).join(''),
    ),
  ).join('\n'))
}
function contentText(doc: jsPDF) {
  return printedPages(doc).map((page) => page.split('\n').filter((line) => !/^LucOps AI(?: \| Relatório da sessão)?$|^Página \d+ de \d+$|^RELATÓRIO EXECUTIVO$/.test(line)).join('\n')).join('\n')
}

describe('relatório PDF executivo', () => {
  it('resume dados reais, geração e investigação sem alterar a sessão', () => {
    const data = session()
    const before = JSON.stringify(data)
    const sections = buildReportSections(data, generatedAt)
    const text = sections.flatMap((item) => item.paragraphs).join('\n')
    expect(text).toContain('teste_anomalias.csv')
    expect(text).toContain('29/10/2026')
    expect(text).toContain('12:04:05')
    expect(text).toContain('Resultados da sessão atual')
    expect(section(data, 'Resumo executivo').paragraphs[0]).toContain('5 registros, com 5 válidos e 0 inconsistências')
    expect(section(data, 'Resumo executivo').paragraphs[0]).toContain('sinalizou 1 anomalia')
    expect(section(data, 'Investigação').paragraphs.join(' ')).toContain('Registro #5 · 3 evidências verificadas')
    expect(text).toContain('sem LLM real')
    expect(text).toContain('Conclusão contextual')
    expect(text).not.toContain('deterministic-rules-v1')
    expect(text).not.toContain('modelo-local-v1')
    expect(JSON.stringify(data)).toBe(before)
  })

  it('gera cards e duas roscas vetoriais com as distribuições 5/0 e 4/1, em até duas páginas', () => {
    const data = session()
    expect(section(data, 'Qualidade dos Dados').distribution).toEqual({ labels: ['Válidos', 'Inválidos'], counts: [5, 0], total: 5, focus: 0 })
    expect(section(data, 'Machine Learning').distribution).toEqual({ labels: ['Normais', 'Anômalos'], counts: [4, 1], total: 5, focus: 1 })
    const doc = createReportPdf(data, generatedAt)
    const text = contentText(doc)
    expect(doc.getNumberOfPages()).toBeLessThanOrEqual(2)
    for (const value of ['Registros analisados', 'Qualidade dos dados', 'Inconsistências', 'Anomalias sinalizadas', '100,00%', '80,00%', '20,00%', 'Válidos', 'Inválidos', 'Normais', 'Anômalos', '4 · 80,00%', '1 · 20,00%', '5 · 100,00%', '0 · 0,00%']) {
      expect(text.replace(/\s+/g, ' ')).toContain(value)
    }
    // Quality: full green circle + white hole. ML: two filled sectors + white hole.
    expect(doc.circle).toHaveBeenCalledTimes(3)
    expect(doc.path).toHaveBeenCalledTimes(2)
    const path = vi.mocked(doc.path).mock.calls[0][0] as { op: string; c: number[] }[]
    const [cx, cy] = path[0].c
    const lastCurve = path.filter((op) => op.op === 'c').at(-1)!
    const end = -Math.PI / 2 + 4 / 5 * Math.PI * 2
    expect(lastCurve.c[4]).toBeCloseTo(cx + 15 * Math.cos(end), 5)
    expect(lastCurve.c[5]).toBeCloseTo(cy + 15 * Math.sin(end), 5)
    expect(text).not.toContain('Score completo')
  })

  it('mantém o relatório compacto com vinte evidências, sem listar conteúdo ou identificadores técnicos', () => {
    const data = session()
    const agent = data.investigation.result!
    agent.verified_evidence = Array.from({ length: 20 }, (_, index) => ({
      ...agent.verified_evidence[0], evidence_id: `${agent.context.transaction.reference}:e${index + 1}`,
      description: 'DESCRICAO-TECNICA-INDIVIDUAL '.repeat(30),
    }))
    agent.context.limitations.push(
      'Hashes identificam o CSV, mas não anonimizam os dados.',
      'O detector de ML usa apenas valor; pontuações não são probabilidades nem prova de fraude.',
    )
    const doc = createReportPdf(data, generatedAt)
    const text = contentText(doc)
    expect(doc.getNumberOfPages()).toBeLessThanOrEqual(2)
    expect(text).toContain('20 evidências verificadas')
    expect(text).not.toContain('DESCRICAO-TECNICA-INDIVIDUAL')
    expect(text).not.toContain('sha256:')
    expect(text).not.toContain('lucops.')
    expect(text).not.toContain('Score completo')
    expect(text).not.toContain(agent.context.transaction.reference)
    expect(text).not.toContain('JSON')
    expect(text).toContain('aplicação React')
  })

  it('exporta somente qualidade sem desenhar gráfico de ML ou inventar valores', () => {
    const data = session()
    data.anomaly = { status: 'not-analyzed', result: null, error: null }
    data.investigation = { status: 'not-executed', result: null, error: null }
    expect(section(data, 'Machine Learning').paragraphs).toEqual(['Análise de ML não executada nesta sessão.'])
    expect(section(data, 'Machine Learning').distribution).toBeUndefined()
    const doc = createReportPdf(data, generatedAt)
    expect(doc.circle).toHaveBeenCalledTimes(2)
    expect(doc.path).not.toHaveBeenCalled()
    expect(contentText(doc)).toContain('Não analisado')
    expect(contentText(doc)).not.toContain('Anomalias detectadas: 0')
  })

  it('usa somente o denominador de avaliados, excluindo ignorados do ML', () => {
    const data = session()
    data.anomaly.result!.evaluated_records = 4
    data.anomaly.result!.skipped_records = 1
    expect(section(data, 'Machine Learning').distribution?.counts).toEqual([3, 1])
    const text = contentText(createReportPdf(data, generatedAt))
    expect(text).toContain('3 · 75,00%')
    expect(text).toContain('1 · 25,00%')
    expect(text).toContain('4 avaliados · 1 ignorado')
  })

  it('representa zero anomalias por uma rosca inteiramente normal e percentual zero real', () => {
    const data = session()
    data.anomaly.result!.anomalies_detected = 0
    const doc = createReportPdf(data, generatedAt)
    expect(section(data, 'Machine Learning').distribution?.counts).toEqual([5, 0])
    expect(doc.circle).toHaveBeenCalledTimes(4)
    expect(doc.path).not.toHaveBeenCalled()
    expect(contentText(doc)).toContain('0 · 0,00%')
    expect(contentText(doc)).not.toContain('ML não executada')
  })

  it('não desenha distribuições vazias ou inexistentes', () => {
    const data = session()
    data.analysis = { quality_status: 'SEM DADOS', summary: { total_records: 0, valid_records: 0, invalid_records: 0, total_issues: 0, valid_percentage: null } }
    data.anomaly.result!.evaluated_records = 0
    data.anomaly.result!.anomalies_detected = 0
    expect(section(data, 'Qualidade dos Dados').distribution).toBeUndefined()
    expect(section(data, 'Machine Learning').distribution).toBeUndefined()
    const doc = createReportPdf(data, generatedAt)
    expect(doc.circle).not.toHaveBeenCalled()
    expect(doc.path).not.toHaveBeenCalled()
    expect(contentText(doc)).toContain('Sem registros avaliados')
    expect(contentText(doc)).toContain('Sem registros para calcular')
  })

  it.each(['loading', 'error'] as const)('identifica estado %s sem transformar ausências em resultados zero', (status) => {
    const data = session()
    data.analysis = null
    data.isAnalyzing = status === 'loading'
    data.error = status === 'error' ? 'internal secret' : null
    data.anomaly = { status, result: null, error: status === 'error' ? 'internal secret' : null }
    data.investigation = { status, result: null, error: status === 'error' ? 'internal secret' : null }
    const text = contentText(createReportPdf(data, generatedAt))
    expect(text).toContain(status === 'loading' ? 'em andamento' : 'última tentativa')
    expect(text).not.toContain('internal secret')
    expect(text).not.toContain('0,00%')
  })

  it('identifica resultados confirmados anteriores após falhas de atualização', () => {
    const data = session()
    data.error = 'internal secret'
    data.anomaly.status = 'unavailable'
    data.investigation.status = 'error'
    expect(section(data, 'Qualidade dos Dados').paragraphs.join(' ')).toContain('última análise concluída')
    expect(section(data, 'Machine Learning').paragraphs.join(' ')).toContain('última análise concluída')
    expect(section(data, 'Investigação').paragraphs.join(' ')).toContain('última investigação concluída')
    expect(contentText(createReportPdf(data, generatedAt))).toContain('100,00%')
  })

  it('resume apenas limitações conhecidas e preserva significados novos sem cortes', () => {
    const data = session()
    const agent = data.investigation.result!
    agent.context.limitations.push('Não há histórico de clientes, logs da origem ou causa comprovada.')
    agent.limitations.push('Há uma limitação de negócio exclusiva que exige conferência adicional.')
    const limitations = section(data, 'Limitações relevantes').paragraphs
    expect(limitations).toContain('Análise limitada ao CSV atual e ao registro selecionado.')
    expect(limitations).toContain('Sem histórico ou registros da origem para confirmar causas.')
    expect(limitations.filter((line) => line === 'Sem histórico ou registros da origem para confirmar causas.')).toHaveLength(1)
    expect(limitations).toContain('Há uma limitação de negócio exclusiva que exige conferência adicional.')
    expect(limitations.join(' ')).not.toContain('nenhum LLM')
  })

  it('retira referências técnicas de textos livres sem introduzir fatos', () => {
    const data = session()
    data.investigation.result!.recommendations.push({
      action: `Consulte a referência ${data.investigation.result!.context.dataset_id} na ferramenta lucops.agents.tools.get_ml_information.`,
      evidence_ids: [],
    })
    const text = section(data, 'Recomendações para revisão humana').paragraphs.join(' ')
    expect(text).not.toContain('sha256:')
    expect(text).not.toContain('lucops.agents')
    expect(text).toContain('Consulte a referência')
    expect(text).toContain('disponível na aplicação')
  })

  it('mantém recomendações e hipóteses não confirmadas sem divulgar valores ocultos', () => {
    const data = session()
    const agent = investigationFixture()
    agent.context.transaction.original_value = '[redacted]'
    agent.verified_evidence[0].value = '[redacted]'
    data.investigation.result = agent
    const text = contentText(createReportPdf(data, generatedAt)).replace(/\s/g, '')
    expect(text).toContain(agent.recommendations[0].action.replace(/\s/g, ''))
    expect(text).toContain(agent.hypotheses[0].description.replace(/\s/g, ''))
    expect(text).toContain('Possibilidadesnãoconfirmadas')
    expect(text).toContain('inelegível')
    expect(text).not.toContain('Valordisponibilizado')
  })

  it('gera PDF A4 real com acentos e tipografia incorporada', () => {
    const data = session()
    data.selectedFile = new File([''], 'Transações — São Paulo € α.csv')
    const doc = createReportPdf(data, generatedAt)
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 1)
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297, 1)
    expect(new TextDecoder().decode(new Uint8Array(doc.output('arraybuffer')).slice(0, 5))).toBe('%PDF-')
    expect(doc.output('blob').type).toBe('application/pdf')
    expect(doc.getFont().fontName).toBe('LucOpsNoto')
    expect(contentText(doc)).toContain('Transações — São Paulo € α.csv')
    expect(contentText(doc)).toContain('Relatório de Análise de Dados')
  })

  it('não divide recomendações que cabem em uma página e pagina textos excepcionalmente longos sem cortes', () => {
    const data = session()
    const agent = data.investigation.result!
    const actions = Array.from({ length: 12 }, (_, index) => `Revisão ${index}: ${'Compare com a origem antes de corrigir. '.repeat(7)} FIM-RECOMENDACAO-${index}`)
    agent.recommendations = actions.map((action) => ({ action, evidence_ids: [] }))
    agent.limitations.push('Limitação excepcional: ' + 'Texto relevante de negócio. '.repeat(180) + 'FIM-LIMITACAO-EXTENSA')
    const doc = createReportPdf(data, generatedAt)
    const pages = printedPages(doc)
    expect(pages.length).toBeGreaterThan(2)
    for (const action of actions) {
      expect(pages.some((page) => page.replace(/\s/g, '').includes(action.replace(/\s/g, '')))).toBe(true)
    }
    expect(contentText(doc).replace(/\s/g, '')).toContain(('Texto relevante de negócio. '.repeat(180) + 'FIM-LIMITACAO-EXTENSA').replace(/\s/g, ''))
    pages.forEach((page, index) => expect(page).toContain(`Página ${index + 1} de ${pages.length}`))
  })

  it('representa explicitamente caracteres sem glifo ou controles invisíveis', () => {
    const data = session()
    data.selectedFile = new File([''], 'relatório 🧪 \u202e.csv')
    const text = contentText(createReportPdf(data, generatedAt))
    expect(text).toContain('[U+1F9EA]')
    expect(text).toContain('[U+202E]')
    expect(text).toContain('notação Unicode')
  })

  it.each([
    ['teste_anomalias.csv', 'lucops-relatorio-teste_anomalias.pdf'],
    ['Transações financeiras.CSV', 'lucops-relatorio-transacoes-financeiras.pdf'],
    ['../../segredo.csv', 'lucops-relatorio-segredo.pdf'],
    ['arquivo.exe.csv', 'lucops-relatorio-arquivo-exe.pdf'],
    ['.csv', 'lucops-relatorio-arquivo.pdf'],
    ['漢字.csv', 'lucops-relatorio-arquivo.pdf'],
  ])('mantém nome de arquivo seguro para %s', (original, expected) => {
    expect(reportFilename(original)).toBe(expected)
    expect(reportFilename(original)).not.toMatch(/[\\/:]/)
  })

  it('limita somente o nome do download e rejeita ausência de CSV ou data inválida', () => {
    expect(reportFilename('a'.repeat(300) + '.csv').length).toBeLessThanOrEqual(91)
    const data = session()
    data.selectedFile = null
    expect(() => createReportPdf(data)).toThrow('Selecione um CSV')
    expect(() => buildReportSections(session(), new Date('invalid'))).toThrow('Data de geração inválida')
  })

  it('gera gráficos e documento sem chamadas externas', () => {
    const fetchMock = vi.fn(() => { throw new Error('No network allowed') })
    vi.stubGlobal('fetch', fetchMock)
    try {
      createReportPdf(session(), generatedAt)
      expect(fetchMock).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })

  it('inicia download local com nome seguro e aguarda o salvamento', async () => {
    savePdf.mockReset().mockResolvedValueOnce(undefined)
    await exportReportPdf(session())
    expect(savePdf).toHaveBeenCalledWith('lucops-relatorio-teste_anomalias.pdf', { returnPromise: true })
  })

  it('propaga falha de download para a interface tratar', async () => {
    savePdf.mockReset().mockRejectedValueOnce(new Error('Download failed'))
    await expect(exportReportPdf(session())).rejects.toThrow('Download failed')
  })
  it('não promove o ML de uma investigação individual a uma distribuição do lote', () => {
    const data = session()
    data.analysis = null
    data.anomaly = { status: 'not-analyzed', result: null, error: null }
    const doc = createReportPdf(data, generatedAt)
    expect(doc.circle).not.toHaveBeenCalled()
    expect(doc.path).not.toHaveBeenCalled()
    expect(contentText(doc)).toContain('Registro #5')
    expect(contentText(doc)).toContain('ML não executada')
    expect(contentText(doc)).toContain('Não analisado')
  })

  it('desenha a distribuição real de qualidade com registros inválidos', () => {
    const data = session()
    data.analysis = { quality_status: 'COM INCONSISTÊNCIAS', summary: { total_records: 5, valid_records: 4, invalid_records: 1, total_issues: 2, valid_percentage: 80 } }
    data.anomaly = { status: 'not-analyzed', result: null, error: null }
    const doc = createReportPdf(data, generatedAt)
    expect(doc.path).toHaveBeenCalledTimes(2)
    expect(doc.circle).toHaveBeenCalledTimes(1)
    expect(contentText(doc)).toContain('4 · 80,00%')
    expect(contentText(doc)).toContain('1 · 20,00%')
    expect(contentText(doc)).toContain('5 registros · 2 inconsistências')
  })

  it('representa todos os avaliados como anômalos sem erro de divisão ou setor vazio', () => {
    const data = session()
    data.anomaly.result!.anomalies_detected = 5
    const doc = createReportPdf(data, generatedAt)
    expect(doc.path).not.toHaveBeenCalled()
    expect(doc.circle).toHaveBeenCalledTimes(4)
    expect(section(data, 'Machine Learning').distribution?.counts).toEqual([0, 5])
    expect(contentText(doc)).toContain('5 · 100,00%')
    expect(contentText(doc)).not.toContain('NaN')
  })

  it('prioriza até cinco limitações de negócio sem alterar os textos armazenados', () => {
    const source = [
      'IDs são comparados exatamente, incluindo espaços e maiúsculas.',
      'Média arredondada com ROUND_HALF_EVEN e precisão de 28.',
      'Limite interno MAX_STAT_AMOUNT = 3.4028234663852886e38.',
      'A investigação abrange apenas o CSV enviado e o registro selecionado.',
      'Identificadores pessoais e texto livre são omitidos ou ocultados.',
      'Não há histórico de clientes, logs da origem ou causa comprovada.',
      'Não há contexto externo para explicar o registro.',
      'As evidências disponíveis não permitem confirmar a causa nem atribuir responsabilidade.',
      'O detector de ML usa apenas valor; pontuações não são probabilidades nem prova de fraude.',
      'Documentos de suporte não foram disponibilizados.',
    ]
    const before = JSON.stringify(source)
    const chosen = selectExecutiveLimitations(source)
    expect(chosen).toHaveLength(5)
    expect(chosen[0]).toBe('Sem histórico ou registros da origem para confirmar causas.')
    expect(chosen).toContain('Não há contexto externo para explicar o registro.')
    expect(chosen).toContain('Causas e responsabilidades não foram confirmadas.')
    expect(chosen).toContain('O ML considera apenas o valor da transação; seus alertas não comprovam fraude.')
    expect(chosen).toContain('Documentos de suporte não foram disponibilizados.')
    expect(chosen.join(' ')).not.toMatch(/ROUND_|3\.402|28|maiúsculas/)
    const data = session()
    data.investigation.result!.context.limitations = source
    data.investigation.result!.limitations = []
    data.investigation.result!.insufficient_evidence = []
    const original = JSON.stringify(data)
    expect(section(data, 'Limitações relevantes').paragraphs).toHaveLength(5)
    expect(createReportPdf(data, generatedAt).getNumberOfPages()).toBeLessThanOrEqual(2)
    expect(JSON.stringify(data)).toBe(original)
    expect(JSON.stringify(source)).toBe(before)
  })

  it('remove repetições sem afirmar ausências de contexto não informadas', () => {
    const source = [
      'Não há histórico de clientes, logs da origem ou causa comprovada.',
      'Não há logs do sistema de origem nem histórico de clientes para confirmar causas.',
      'As evidências disponíveis não permitem confirmar a causa nem atribuir responsabilidade.',
      'Sugestões simuladas não são explicações comprovadas de causas de negócio.',
    ]
    expect(selectExecutiveLimitations(source)).toEqual([
      'Sem histórico ou registros da origem para confirmar causas.',
      'Causas e responsabilidades não foram confirmadas.',
    ])
    expect(selectExecutiveLimitations(['A investigação abrange apenas o CSV enviado e o registro selecionado.'])).toEqual([
      'Análise limitada ao CSV atual e ao registro selecionado.',
    ])
    expect(selectExecutiveLimitations(['SEM CONTEXTO EXTERNO DISPONÍVEL.'])).toEqual(['SEM CONTEXTO EXTERNO DISPONÍVEL.'])
    expect(selectExecutiveLimitations(['toString'])).toEqual(['toString'])
  })

  it('resume a limitação numérica conhecida sem transportar nomes internos ou arredondamento', () => {
    const source = ['Apenas CSV atual: valor não vazio, até 64 caracteres, aprovado por is_positive_amount e até 3.4028234663852886e38. Outras inconsistências não excluem o valor; duplicados são incluídos. Média e mediana são arredondadas aos centavos com ROUND_HALF_EVEN.']
    expect(selectExecutiveLimitations(source)).toEqual([
      'As estatísticas de valores usam apenas valores elegíveis e podem incluir duplicados ou registros com outras inconsistências.',
    ])
    expect(source[0]).toContain('ROUND_HALF_EVEN')
  })

  it('informa detalhes técnicos disponíveis quando todas as limitações registradas são internas', () => {
    const data = session()
    const agent = data.investigation.result!
    agent.context.limitations = ['Cálculo com ROUND_HALF_EVEN e precisão de 28.']
    agent.limitations = ['A constante MAX_STAT_AMOUNT = 3.4028234663852886e38.']
    agent.insufficient_evidence = []
    agent.context.ml.reasons = []
    const original = JSON.stringify(data)
    const limitations = section(data, 'Limitações relevantes').paragraphs
    expect(limitations).toEqual(['As limitações registradas são técnicas; consulte os detalhes completos na aplicação.'])
    expect(contentText(createReportPdf(data, generatedAt))).not.toContain('Nenhuma limitação foi informada')
    expect(JSON.stringify(data)).toBe(original)
  })

  it.each([[3, 8], [7, 4], [11, 8]])('mantém títulos e o primeiro conteúdo juntos com %i recomendações de tamanho %i', (count, length) => {
    const data = session()
    const agent = data.investigation.result!
    agent.recommendations = Array.from({ length: count }, (_, index) => ({
      action: `Revisão ${index}: ${'Confira os documentos da origem antes de decidir. '.repeat(length)} FIM-${index}`,
      evidence_ids: [],
    }))
    agent.hypotheses = [
      ...agent.hypotheses,
      { description: 'Uma possibilidade ainda não confirmada requer verificação com a origem.', status: 'unconfirmed', evidence_ids: [] },
    ]
    const doc = createReportPdf(data, generatedAt)
    const pages = printedPages(doc).map((page) => page.split('\n').filter((line) =>
      !/^LucOps AI(?: \| Relatório da sessão)?$|^Página \d+ de \d+$|^RELATÓRIO EXECUTIVO$/.test(line),
    ))
    for (const item of buildReportSections(data, generatedAt).slice(1)) {
      const page = pages.find((rows) => rows.includes(item.title))!
      expect(page, item.title).toBeTruthy()
      const position = page.indexOf(item.title)
      expect(page[position + 1], item.title).toBeTruthy()
      expect(page[position + 1], item.title).toContain(item.paragraphs[0].slice(0, 18))
    }
    for (const item of [...agent.recommendations.map((recommendation) => recommendation.action), ...agent.hypotheses.map((hypothesis) => hypothesis.description)]) {
      expect(pages.some((rows) => rows.join('').replace(/\s/g, '').includes(item.replace(/\s/g, '')))).toBe(true)
    }
  })

  it('equilibra o cenário compacto entre gráficos e revisão, sem diminuir a tipografia', () => {
    const doc = createReportPdf(session(), generatedAt)
    const pages = printedPages(doc)
    expect(pages).toHaveLength(2)
    expect(pages[0]).toContain('Qualidade dos Dados')
    expect(pages[0]).toContain('Machine Learning')
    expect(pages[0].split('\n')).not.toContain('Investigação')
    expect(pages[1].split('\n')).toContain('Investigação')
    expect(pages[1]).toContain('Recomendações para revisão humana')
    expect(pages[1]).toContain('Limitações relevantes')
    const unicode = (doc.getFont().metadata as { toUnicode: Record<number, number> }).toUnicode
    const commands = (doc.internal.pages as unknown as string[][])[2]
    const bodyPositions = commands.flatMap((command) => {
      const texts = [...command.matchAll(/<([0-9a-f]+)>\s*Tj/gi)].map((match) =>
        (match[1].match(/.{4}/g) ?? []).map((glyph) => String.fromCodePoint(unicode[parseInt(glyph, 16)])).join(''),
      )
      const position = /(-?[\d.]+) (-?[\d.]+) Td/.exec(command)
      if (!position || texts.every((text) => /^(?:LucOps AI|RELATÓRIO EXECUTIVO|Página )/.test(text))) return []
      const fontSize = Number(/([\d.]+) Tf/.exec(command)?.[1])
      expect(fontSize).toBeGreaterThanOrEqual(9.5)
      return [doc.internal.pageSize.getHeight() - Number(position[2]) / doc.internal.scaleFactor]
    })
    expect(Math.max(...bodyPositions)).toBeGreaterThan(170)
    expect(Math.max(...bodyPositions)).toBeLessThanOrEqual(277)
  })

})
