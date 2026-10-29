import { jsPDF } from 'jspdf'
import reportFont from '../assets/fonts/NotoSans-Regular.base64.txt?raw'
import type { useAnalysis } from '../state/AnalysisContext'
import { investigationSummary } from '../utils/investigation'
import { formatCount, formatPercent } from '../utils/quality'

export type ReportSession = Pick<ReturnType<typeof useAnalysis>,
  'selectedFile' | 'analysis' | 'isAnalyzing' | 'error' | 'anomaly' | 'investigation'>

export interface ReportDistribution {
  labels: [string, string]
  counts: [number, number]
  total: number
  focus: 0 | 1
}
export interface ReportSection {
  title: string
  paragraphs: string[]
  distribution?: ReportDistribution
}

export function reportFilename(csvName: string): string {
  const stem = csvName.replace(/\.csv$/i, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).toLowerCase()
  return `lucops-relatorio-${stem || 'arquivo'}.pdf`
}

// Technical identifiers remain available in React, not in the executive document.
function businessText(text: string): string {
  return text
    .replace(/sha256:[a-f0-9]{64}(?::[\w:-]+)?/gi, 'referência disponível na aplicação')
    .replace(/\blucops(?:\.[a-zA-Z_][\w]*)+/g, 'ferramenta de análise')
    .replace(/\b[A-Z]:\\[^\s,;]*\.py\b|(?:\/[\w.-]+)+\.py\b|\b(?:src[\\/])?lucops[\\/][\w/\\.-]+/gi, 'detalhe disponível na aplicação')
}
const limitationSummaries: Record<string, string> = {
  'A investigação abrange apenas o CSV enviado e o registro selecionado.': 'Análise limitada ao CSV atual e ao registro selecionado.',
  'Não há histórico de clientes, logs da origem ou causa comprovada.': 'Sem histórico ou registros da origem para confirmar causas.',
  'Não há logs do sistema de origem nem histórico de clientes para confirmar causas.': 'Sem histórico ou registros da origem para confirmar causas.',
  'Identificadores pessoais e texto livre são omitidos ou ocultados.': 'Dados pessoais e textos livres podem estar ocultos por proteção de privacidade.',
  'Hashes identificam o CSV, mas não anonimizam os dados.': 'A identificação técnica do arquivo não garante o anonimato dos dados.',
  'O detector de ML usa apenas valor; pontuações não são probabilidades nem prova de fraude.': 'O ML considera apenas o valor da transação; seus alertas não comprovam fraude.',
  'As evidências disponíveis não permitem confirmar a causa nem atribuir responsabilidade.': 'Causas e responsabilidades não foram confirmadas.',
  'Sugestões simuladas não são explicações comprovadas de causas de negócio.': 'Sugestões determinísticas não comprovam causas de negócio.',
  'Execução simulada: respostas determinísticas; nenhum LLM foi chamado.': '', // Already identified in the investigation.
  'Estatísticas do CSV atual, não históricas nem específicas de clientes.': 'Estatísticas limitadas ao CSV atual, sem comparação histórica ou análise individual de clientes.',
  'Essas contagens não substituem as métricas tradicionais de qualidade.': 'As estatísticas complementam, mas não substituem, a avaliação de qualidade.',
  'Apenas CSV atual: valor não vazio, até 64 caracteres, aprovado por is_positive_amount e até 3.4028234663852886e38. Outras inconsistências não excluem o valor; duplicados são incluídos. Média e mediana são arredondadas aos centavos com ROUND_HALF_EVEN.': 'As estatísticas de valores usam apenas valores elegíveis e podem incluir duplicados ou registros com outras inconsistências.',
  'valor: Rule failed.': 'O valor do registro não atende aos requisitos para avaliação estatística.',

}

// Selection changes only the executive view; source limitations remain untouched.
export function selectExecutiveLimitations(source: readonly string[]): string[] {
  const candidates = source.flatMap((original, index) => {
    const text = businessText(Object.hasOwn(limitationSummaries, original) ? limitationSummaries[original] : original).trim()
    if (!text || /ROUND_[A-Z_]+|arredondamento|arredondad|\b[A-Z][A-Z_]*_[A-Z_]+\b|\b\d+(?:\.\d+)?e[+-]?\d+\b|\b[a-z]+_[a-z_]+\b/.test(text)) return []
    const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    let priority = 4
    let key = normalized.replace(/[\s.,;:]+/g, ' ').trim()
    if (/historico|registros da origem/.test(normalized)) { priority = 0; key = 'history' }
    else if (/contexto externo|contexto de negocio|justificativa de negocio|fontes externas/.test(normalized)) { priority = 1; key = 'external-context' }
    else if (/causa|responsabilidad/.test(normalized)) { priority = normalized.includes('responsabil') ? 1.5 : 2; key = 'causes' }
    else if (/\bml\b|modelo|avaliacao estatistica|alertas.*fraude/.test(normalized)) priority = 3
    else if (/analise limitada ao csv/.test(normalized)) priority = 5
    else if (/privacidade|anonimato/.test(normalized)) priority = 6
    else if (/ids sao comparados exatamente|ids vazios nao sao comparados/.test(normalized)) priority = 7
    return [{ text, priority, key, index }]
  }).sort((a, b) => a.priority - b.priority || a.index - b.index)
  const selected = new Set<string>()
  return candidates.filter((item) => {
    if (selected.has(item.key)) return false
    selected.add(item.key)
    return true
  }).slice(0, 5).map((item) => item.text)
}

export function buildReportSections(session: ReportSession, generatedAt: Date): ReportSection[] {
  if (!session.selectedFile) throw new Error('Selecione um CSV antes de exportar.')
  if (!Number.isFinite(generatedAt.getTime())) throw new Error('Data de geração inválida.')
  const quality = session.analysis?.summary
  const ml = session.anomaly.result
  const agent = session.investigation.result
  const summary = [
    quality ? `O CSV reúne ${formatCount(quality.total_records)} registros, com ${formatCount(quality.valid_records)} válidos e ${formatCount(quality.total_issues)} ${quality.total_issues === 1 ? 'inconsistência' : 'inconsistências'} de qualidade.` : 'Não há resultado de qualidade confirmado.',
    ml ? `O ML avaliou ${formatCount(ml.evaluated_records)} registros e sinalizou ${formatCount(ml.anomalies_detected)} ${ml.anomalies_detected === 1 ? 'anomalia' : 'anomalias'}.` : 'Não há análise de ML confirmada.',
    agent ? `Há investigação disponível para o registro #${agent.context.record_index}.` : 'Não há investigação confirmada para a seleção atual.',
  ].join(' ')
  const sections: ReportSection[] = [{
    title: 'Identificação',
    paragraphs: [
      `CSV: ${session.selectedFile.name}`,
      `Geração: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(generatedAt)} (horário de Brasília).`,
      'Resultados da sessão atual. Sem histórico ou novas análises.',
    ],
  }, { title: 'Resumo executivo', paragraphs: [summary] }, {
    title: 'Qualidade dos Dados',
    paragraphs: quality && session.analysis ? [
      `Situação: ${session.analysis.quality_status === 'SEM INCONSISTÊNCIAS' ? 'Sem inconsistências' : session.analysis.quality_status === 'COM INCONSISTÊNCIAS' ? 'Com inconsistências' : 'Sem dados'}.`,
      `${formatCount(quality.total_records)} registros · ${formatCount(quality.total_issues)} inconsistências.`,
      ...(quality.total_records === 0 ? ['Sem registros para calcular a distribuição.'] : []),
      ...(session.isAnalyzing || session.error ? [`${session.isAnalyzing ? 'Atualização em andamento.' : 'A última tentativa falhou.'} Exibindo a última análise concluída.`] : []),
    ] : [session.isAnalyzing ? 'Análise de qualidade em andamento, ainda sem resultado confirmado.' : session.error ? 'Sem resultado de qualidade confirmado. A última tentativa falhou.' : 'Análise de qualidade não executada nesta sessão.'],
    ...(quality && quality.total_records > 0 ? { distribution: { labels: ['Válidos', 'Inválidos'] as [string, string], counts: [quality.valid_records, quality.invalid_records] as [number, number], total: quality.total_records, focus: 0 as const } } : {}),
  }, {
    title: 'Machine Learning',
    paragraphs: ml ? [
      'Isolation Forest · alertas estatísticos.',
      `${formatCount(ml.evaluated_records)} ${ml.evaluated_records === 1 ? 'avaliado' : 'avaliados'} · ${formatCount(ml.skipped_records)} ${ml.skipped_records === 1 ? 'ignorado' : 'ignorados'}.`,
      ...(ml.evaluated_records === 0 ? ['Sem registros avaliados para calcular a distribuição.'] : []),
      ...(session.anomaly.status !== 'success' ? [`${session.anomaly.status === 'loading' ? 'Atualização em andamento.' : 'A última tentativa não foi concluída.'} Exibindo a última análise concluída.`] : []),
    ] : [session.anomaly.status === 'loading' ? 'Análise de ML em andamento, ainda sem resultado confirmado.' : session.anomaly.error ? 'Sem resultado de ML confirmado. A última tentativa não foi concluída.' : 'Análise de ML não executada nesta sessão.'],
    ...(ml && ml.evaluated_records > 0 ? { distribution: { labels: ['Normais', 'Anômalos'] as [string, string], counts: [ml.evaluated_records - ml.anomalies_detected, ml.anomalies_detected] as [number, number], total: ml.evaluated_records, focus: 1 as const } } : {}),
  }]
  if (!agent) {
    sections.push({ title: 'Investigação', paragraphs: [session.investigation.status === 'loading' ? 'Investigação em andamento, ainda sem resultado confirmado.' : session.investigation.error ? 'Sem investigação confirmada para esta seleção. A última tentativa falhou.' : 'Investigação não executada para a seleção atual.'] })
    return sections
  }
  sections.push({
    title: 'Investigação',
    paragraphs: [
      `Registro #${agent.context.record_index} · ${formatCount(agent.verified_evidence.length)} ${agent.verified_evidence.length === 1 ? 'evidência verificada' : 'evidências verificadas'}.`,
      agent.mode === 'simulated' ? 'Modo simulado: análise determinística, sem LLM real.' : 'Investigação com OpenAI.',
      ...(session.investigation.status !== 'success' ? [`${session.investigation.status === 'loading' ? 'Nova investigação em andamento.' : 'A última tentativa falhou.'} Exibindo a última investigação concluída.`] : []),
      investigationSummary(agent),
      'Conclusão contextual: os fatos apoiam a revisão humana; não confirmam causas ou irregularidades.',
    ],
  })
  if (agent.hypotheses.length) sections.push({
    title: 'Possibilidades não confirmadas',
    paragraphs: agent.hypotheses.map((item) => item.description),
  })
  sections.push({
    title: 'Recomendações para revisão humana',
    paragraphs: agent.recommendations.length ? agent.recommendations.map((item, index) => `${index + 1}. ${item.action}`) : ['Nenhuma recomendação foi proposta com as evidências disponíveis.'],
  }, {
    title: 'Limitações relevantes',
    paragraphs: selectExecutiveLimitations([
      ...agent.context.limitations, ...agent.context.ml.reasons, ...agent.limitations, ...agent.insufficient_evidence,
    ]),
  })
  if (sections.at(-1)!.paragraphs.length === 0) sections.at(-1)!.paragraphs.push(
    agent.context.limitations.length + agent.context.ml.reasons.length + agent.limitations.length + agent.insufficient_evidence.length > 0
      ? 'As limitações registradas são técnicas; consulte os detalhes completos na aplicação.'
      : 'Nenhuma limitação foi informada; isso não comprova ausência de limitações.',
  )
  return sections.map((section) => ({ ...section, paragraphs: section.paragraphs.map(businessText) }))
}

export function createReportPdf(session: ReportSession, generatedAt = new Date()): jsPDF {
  const sections = buildReportSections(session, generatedAt)
  const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'portrait', compress: true, putOnlyUsedFonts: true })
  doc.addFileToVFS('NotoSans-Regular.ttf', reportFont.trim())
  doc.addFont('NotoSans-Regular.ttf', 'LucOpsNoto', 'normal')
  doc.setFont('LucOpsNoto', 'normal')
  doc.setProperties({ title: 'Relatório de Análise de Dados', author: 'LucOps AI', creator: 'LucOps AI - relatório executivo local' })
  doc.setCreationDate(generatedAt)
  const glyphs = (doc.getFont().metadata as { cmap: { unicode: { codeMap: Record<number, number> } } }).cmap.unicode.codeMap
  let encodedCharacters = false
  const printable = (value: string) => Array.from(value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, '    ')).map((char) => {
    if (char === '\n' || (!/\p{C}/u.test(char) && glyphs[char.codePointAt(0)!])) return char
    encodedCharacters = true
    return `[U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}]`
  }).join('')
  const margin = 16
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const contentWidth = width - margin * 2
  const bottom = height - 20
  const lineStep = (size = 10.5) => size * 0.3528 * 1.38
  let y = 34
  function header() {
    doc.setFillColor('#051424')
    doc.rect(0, 0, width, 23, 'F')
    doc.setTextColor('#4cd7f6')
    doc.setFontSize(14)
    doc.text('LucOps AI', margin, 14)
    doc.setFontSize(9)
    doc.setTextColor('#ffffff')
    doc.text('RELATÓRIO EXECUTIVO', width - margin, 14, { align: 'right' })
    y = 34
  }
  function reserve(space: number) {
    if (y + space > bottom) { doc.addPage(); header() }
  }
  function lines(text: string, size = 10.5, available = contentWidth) {
    doc.setFontSize(size)
    return doc.splitTextToSize(printable(text), available) as string[]
  }
  function write(text: string, size = 10.5, color = '#233143', keepTogether = true) {
    const wrapped = lines(text, size)
    const step = lineStep(size)
    if (keepTogether && wrapped.length * step + 2 <= bottom - 34) reserve(wrapped.length * step + 2)
    for (const line of wrapped) {
      reserve(step)
      doc.setFontSize(size)
      doc.setTextColor(color)
      doc.text(line, margin, y)
      y += step
    }
    y += 2
  }
  const textHeight = (text: string, size = 10.5) => lines(text, size).length * lineStep(size) + 2
  const headingHeight = (title: string) => 4 + textHeight(title, 13)
  function heading(title: string, firstParagraph = '') {
    const firstHeight = textHeight(firstParagraph)
    const keepFirst = headingHeight(title) + firstHeight <= bottom - 34
    reserve(headingHeight(title) + (keepFirst ? firstHeight : Math.min(2 * lineStep() + 2, firstHeight)))
    y += 2
    write(title, 13, '#00687a', false)
    doc.setDrawColor('#cbd5e1')
    doc.line(margin, y - 1, width - margin, y - 1)
    y += 2
    return keepFirst
  }
  // A pie sector followed by a white inner circle forms a vector ring. No image/chart service.
  function ring(x: number, cy: number, distribution: ReportDistribution) {
    const radius = 15
    const colors = ['#04b4a2', distribution.focus === 0 ? '#cf4b43' : '#d18b13']
    let start = -Math.PI / 2
    distribution.counts.forEach((count, index) => {
      const angle = count / distribution.total * Math.PI * 2
      if (count > 0) {
        doc.setFillColor(colors[index])
        if (count === distribution.total) doc.circle(x, cy, radius, 'F')
        else {
          const operations: { op: string; c: number[] }[] = [
            { op: 'm', c: [x, cy] },
            { op: 'l', c: [x + radius * Math.cos(start), cy + radius * Math.sin(start)] },
          ]
          const segments = Math.ceil(angle / (Math.PI / 2))
          const step = angle / segments
          for (let segment = 0; segment < segments; segment++) {
            const a = start + segment * step
            const b = a + step
            const k = 4 / 3 * Math.tan(step / 4)
            operations.push({ op: 'c', c: [
              x + radius * (Math.cos(a) - k * Math.sin(a)), cy + radius * (Math.sin(a) + k * Math.cos(a)),
              x + radius * (Math.cos(b) + k * Math.sin(b)), cy + radius * (Math.sin(b) - k * Math.cos(b)),
              x + radius * Math.cos(b), cy + radius * Math.sin(b),
            ] })
          }
          operations.push({ op: 'h', c: [] })
          doc.path(operations).fill()
        }
      }
      start += angle
    })
    doc.setFillColor('#ffffff')
    doc.circle(x, cy, 10.5, 'F')
    doc.setFontSize(10)
    doc.setTextColor('#051424')
    doc.text(formatPercent(distribution.counts[distribution.focus] / distribution.total * 100), x, cy, { align: 'center' })
    doc.setFontSize(9)
    doc.text(distribution.labels[distribution.focus].toLowerCase(), x, cy + 5, { align: 'center' })
  }
  function distributionPanels() {
    const panels = sections.filter((section) => ['Qualidade dos Dados', 'Machine Learning'].includes(section.title))
    const gap = 6
    const panelWidth = (contentWidth - gap) / 2
    const panelHeight = Math.max(...panels.map((panel) => {
      const notes = panel.distribution ? panel.paragraphs.slice(1) : panel.paragraphs
      return (panel.distribution ? 65 : 24) + notes.reduce((sum, text) => sum + lines(text, 9.5, panelWidth - 10).length * 4.6 + 1, 0)
    }))
    reserve(panelHeight + 5)
    const top = y
    panels.forEach((panel, index) => {
      const x = margin + index * (panelWidth + gap)
      doc.setFillColor('#ffffff')
      doc.setDrawColor('#cbd5e1')
      doc.roundedRect(x, top, panelWidth, panelHeight, 2, 2, 'FD')
      doc.setFontSize(12)
      doc.setTextColor('#051424')
      doc.text(panel.title, x + 5, top + 9)
      if (panel.distribution) {
        doc.setFontSize(9.5)
        doc.setTextColor('#475569')
        doc.text(lines(panel.paragraphs[0], 9.5, panelWidth - 10), x + 5, top + 16, { lineHeightFactor: 1.3 })
        const chartY = top + 40
        ring(x + 22, chartY, panel.distribution)
        panel.distribution.labels.forEach((label, itemIndex) => {
          const legendY = top + 30 + itemIndex * 16
          doc.setFillColor(itemIndex === 0 ? '#04b4a2' : index === 0 ? '#cf4b43' : '#d18b13')
          doc.rect(x + 43, legendY - 2.5, 2, 2, 'F')
          doc.setFontSize(9.5)
          doc.setTextColor('#233143')
          doc.text(label, x + 47, legendY)
          doc.text(`${formatCount(panel.distribution!.counts[itemIndex])} · ${formatPercent(panel.distribution!.counts[itemIndex] / panel.distribution!.total * 100)}`, x + 43, legendY + 5)
        })
      }
      let textY = top + (panel.distribution ? 65 : 24)
      const notes = panel.distribution ? panel.paragraphs.slice(1) : panel.paragraphs
      for (const text of notes) {
        doc.setFontSize(9.5)
        doc.setTextColor('#475569')
        const wrapped = lines(text, 9.5, panelWidth - 10)
        doc.text(wrapped, x + 5, textY, { lineHeightFactor: 1.3 })
        textY += wrapped.length * 4.6 + 1
      }
    })
    y = top + panelHeight + 5
  }
  header()
  write('Relatório de Análise de Dados', 19, '#051424')
  for (const text of sections[0].paragraphs) write(text, 9.5, '#475569')
  heading('Resumo executivo', sections[1].paragraphs[0])
  write(sections[1].paragraphs[0])

  const quality = session.analysis?.summary
  const ml = session.anomaly.result
  const qualityState = session.isAnalyzing ? 'Em andamento' : session.error ? 'Sem resultado' : 'Não analisado'
  const mlState = session.anomaly.status === 'loading' ? 'Em andamento' : session.anomaly.status === 'unavailable' ? 'Indisponível' : session.anomaly.error ? 'Sem resultado' : 'Não analisado'
  const cards = [
    ['Registros analisados', quality ? formatCount(quality.total_records) : qualityState],
    ['Qualidade dos dados', quality ? formatPercent(quality.valid_percentage) : qualityState],
    ['Inconsistências', quality ? formatCount(quality.total_issues) : qualityState],
    ['Anomalias sinalizadas', ml ? formatCount(ml.anomalies_detected) : mlState],
  ]
  const cardWidth = (contentWidth - 15) / 4
  const cardData = cards.map(([label, value]) => {
    let size = 17
    while (size > 10 && (doc.setFontSize(size), doc.getTextWidth(printable(value))) > cardWidth - 8) size--
    return { label: lines(label, 9.5, cardWidth - 8), value: lines(value, size, cardWidth - 8), size }
  })
  const cardHeight = Math.max(30, ...cardData.map((card) => 14 + card.value.length * card.size * 0.3528 * 1.4))
  reserve(cardHeight + 6)
  cardData.forEach((card, index) => {
    const x = margin + index * (cardWidth + 5)
    doc.setFillColor('#f0f6fa')
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'F')
    doc.setFillColor('#06b6d4')
    doc.rect(x, y + 3, 1, cardHeight - 6, 'F')
    doc.setTextColor('#475569')
    doc.setFontSize(9.5)
    doc.text(card.label, x + 4, y + 6, { lineHeightFactor: 1.2 })
    doc.setTextColor('#051424')
    doc.setFontSize(card.size)
    doc.text(card.value, x + 4, y + 21, { lineHeightFactor: 1.4 })
  })
  y += cardHeight + 6
  distributionPanels()
  write('Alertas estatísticos orientam revisão contextual; não confirmam fraude ou causas. Ignorados não entram na distribuição de ML.', 9.5, '#475569')

  const narrative = sections.slice(4)
  const sectionHeight = (section: ReportSection) => headingHeight(section.title) + section.paragraphs.reduce((sum, text) => sum + textHeight(text), 0)
  const narrativeHeight = narrative.reduce((sum, section) => sum + sectionHeight(section) + 4, 0)
  const closingNotes = ['Detalhes técnicos, evidências completas, limitações originais e referências de auditoria permanecem disponíveis na aplicação React.']
  if (encodedCharacters) closingNotes.push('Caracteres sem glifo ou controles invisíveis estão identificados pela notação Unicode [U+XXXX].')
  const closingHeight = closingNotes.reduce((sum, note) => sum + textHeight(note, 9.5), 0)
  let sectionGap = 4
  // Keep a compact interpretation/review group together, rather than leaving its tail alone on page two.
  if (narrativeHeight + closingHeight > bottom - y && narrativeHeight + closingHeight <= bottom - 34) {
    doc.addPage()
    header()
    sectionGap += Math.min(6, (bottom - y - narrativeHeight - closingHeight) / (narrative.length + 1))
  }
  for (const section of narrative) {
    // Small hypotheses/recommendation sections stay intact; larger sets paginate by paragraph.
    const isLast = section === narrative.at(-1)
    const completeHeight = sectionHeight(section) + (isLast ? sectionGap + closingHeight : 0)
    if (completeHeight <= 65 || (isLast && completeHeight <= bottom - 34)) reserve(completeHeight)
    const keepFirst = heading(section.title, section.paragraphs[0])
    section.paragraphs.forEach((paragraph, index) => write(paragraph, 10.5, '#233143', index === 0 ? keepFirst : true))
    y += sectionGap
  }
  for (const note of closingNotes) write(note, 9.5, '#475569')
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setDrawColor('#cbd5e1')
    doc.line(margin, height - 15, width - margin, height - 15)
    doc.setTextColor('#475569')
    doc.setFontSize(9)
    doc.text('LucOps AI | Relatório da sessão', margin, height - 9)
    doc.text(`Página ${page} de ${pages}`, width - margin, height - 9, { align: 'right' })
  }
  return doc
}

export async function exportReportPdf(session: ReportSession): Promise<void> {
  const doc = createReportPdf(session)
  await doc.save(reportFilename(session.selectedFile!.name), { returnPromise: true })
}
