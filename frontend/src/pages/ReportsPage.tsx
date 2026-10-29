import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { PageHeading } from '../components/PageHeading'
import { QualityMetricCard } from '../components/QualityMetricCard'
import { SurfaceCard } from '../components/SurfaceCard'
import { useAnalysis } from '../state/AnalysisContext'
import { investigationSummary } from '../utils/investigation'
import { formatCount, formatPercent } from '../utils/quality'

function ReportValues({ items }: { items: [string, string][] }) {
  return (
    <dl className="mt-5 space-y-3">
      {items.map(([label, value]) => (
        <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 border-b border-outline/40 pb-3 last:border-0 last:pb-0">
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="max-w-full break-all font-mono text-sm tabular-nums text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}


function ReportLimitations({ items }: { items: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const hintId = useId()
  const visible = expanded ? items : items.slice(0, 4)

  return (
    <div className="min-w-0 rounded-md bg-panel-soft p-4">
      <h3 className="text-sm font-semibold text-ink">Limitações e informações indisponíveis</h3>
      {items.length ? (
        <>
          {expanded && <p id={hintId} className="mt-3 text-xs leading-5 text-muted">Lista completa. Role para consultar os demais itens quando necessário.</p>}
          <ul id={listId} aria-label="Limitações da investigação" aria-describedby={expanded ? hintId : undefined}
            tabIndex={expanded ? 0 : undefined}
            className={`mt-3 list-disc space-y-2 break-words pl-5 text-xs leading-6 text-muted ${expanded ? 'max-h-96 overflow-y-auto overscroll-contain pr-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary' : ''}`}>
            {visible.map((item) => <li key={item}>{item}</li>)}
          </ul>
          {items.length > 4 && (
            <>
              <p className="mt-3 text-xs text-muted">Exibindo {visible.length} de {items.length} limitações.</p>
              <button type="button" aria-expanded={expanded} aria-controls={listId}
                onClick={() => setExpanded((value) => !value)}
                className="mt-3 min-h-11 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                {expanded ? 'Mostrar menos' : 'Ver todas as limitações'}
              </button>
            </>
          )}
        </>
      ) : <p className="mt-3 text-xs leading-6 text-muted">Nenhuma limitação foi informada na resposta. Isso não comprova ausência de limitações.</p>}
    </div>
  )
}

export function ReportsPage() {
  const { selectedFile, analysis, isAnalyzing, error, anomaly, investigation } = useAnalysis()
  const [exportState, setExportState] = useState<{ file: File | null; status: 'loading' | 'success' | 'error' } | null>(null)
  const exportJob = useRef<symbol | null>(null)
  const currentFile = useRef(selectedFile)
  useEffect(() => {
    currentFile.current = selectedFile
    return () => { currentFile.current = null; exportJob.current = null }
  }, [selectedFile])
  const exporting = exportState?.file === selectedFile && exportState.status === 'loading'
  const exportStatus = exportState?.file === selectedFile ? exportState.status : null
  async function exportPdf() {
    if (!selectedFile || exportJob.current) return
    const job = Symbol()
    exportJob.current = job
    setExportState({ file: selectedFile, status: 'loading' })
    try {
      const { exportReportPdf } = await import('../reports/pdf')
      if (exportJob.current !== job || currentFile.current !== selectedFile) return
      await exportReportPdf({ selectedFile, analysis, isAnalyzing, error, anomaly, investigation })
      if (exportJob.current === job && currentFile.current === selectedFile) setExportState({ file: selectedFile, status: 'success' })
    } catch {
      if (exportJob.current === job && currentFile.current === selectedFile) setExportState({ file: selectedFile, status: 'error' })
    } finally {
      if (exportJob.current === job) exportJob.current = null
    }
  }
  const quality = analysis?.summary
  const ml = anomaly.result
  const agent = investigation.result
  const anomalyShare = ml && ml.evaluated_records > 0 ? ml.anomalies_detected / ml.evaluated_records * 100 : null
  const limitations = agent ? [...new Set([
    ...agent.context.limitations, ...agent.context.ml.reasons, ...agent.limitations, ...agent.insufficient_evidence,
  ])] : []
  const linkClass = 'mt-5 inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline'

  return (
    <>
      <PageHeading eyebrow="Consolidação · sessão atual" title="Relatórios"
        description="Visão consolidada dos resultados disponíveis para o CSV selecionado, sem executar novas análises." />
      {!selectedFile ? (
        <SurfaceCard>
          <EmptyState icon="reports" title="Nenhum CSV selecionado"
            description="Selecione um CSV na Visão Geral. Os resultados confirmados da sessão serão reunidos aqui." />
          <Link to="/" className={linkClass}>Ir para Visão Geral →</Link>
        </SurfaceCard>
      ) : (
        <div className="space-y-6">
          <SurfaceCard className="flex min-w-0 flex-wrap items-start justify-between gap-4 border-primary/20 bg-panel-soft">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-panel-raised text-primary"><Icon name="reports" className="h-6 w-6" /></span>
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Relatório da sessão atual</p>
                <h2 className="mt-2 break-all font-display text-base font-semibold text-ink">{selectedFile.name}</h2>
                <p className="mt-2 text-xs leading-5 text-muted">Resultados mantidos apenas na memória desta sessão. Não há armazenamento do relatório no servidor nem histórico. O PDF é gerado localmente somente quando solicitado.</p>
              </div>
            </div>
            <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:items-end">
              <span className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 font-mono text-xs text-primary">CSV atual · sessão React</span>
              <button type="button" disabled={exporting} onClick={() => void exportPdf()} aria-busy={exporting}
                className="min-h-11 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60 sm:w-auto">
                {exporting ? 'Gerando PDF…' : 'Exportar PDF'}
              </button>
            </div>
          </SurfaceCard>

          {exportStatus === 'loading' && <p role="status" className="text-sm text-muted">Gerando o PDF com os resultados disponíveis. Aguarde.</p>}
          {exportStatus === 'success' && <p role="status" className="text-sm text-primary">Download do PDF iniciado. Confira os downloads do navegador.</p>}
          {exportStatus === 'error' && <p role="alert" className="text-sm text-[#ffb4ab]">Não foi possível gerar ou baixar o PDF. Tente novamente.</p>}

          <section aria-label="Indicadores consolidados" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QualityMetricCard label="Registros analisados" icon="database"
              value={quality ? formatCount(quality.total_records) : isAnalyzing ? 'Em andamento' : error ? 'Sem resultado' : 'Não analisado'}
              caption="Total na análise de qualidade" />
            <QualityMetricCard label="Qualidade dos dados" icon="quality"
              value={quality ? formatPercent(quality.valid_percentage) : isAnalyzing ? 'Em andamento' : error ? 'Sem resultado' : 'Não analisado'}
              caption={quality?.valid_percentage === null ? 'Sem registros para calcular' : 'Percentual de registros válidos'} />
            <QualityMetricCard label="Anomalias sinalizadas" icon="anomalies"
              value={ml ? formatCount(ml.anomalies_detected) : anomaly.status === 'loading' ? 'Em andamento' : anomaly.status === 'unavailable' ? 'Indisponível' : anomaly.error ? 'Sem resultado' : 'Não analisado'}
              caption="Alertas estatísticos entre os avaliados" />
            <QualityMetricCard label="Registro investigado" icon="investigations"
              value={agent ? `#${agent.context.record_index}` : investigation.status === 'loading' ? 'Em andamento' : investigation.error ? 'Sem resultado' : 'Não executada'}
              caption="Última investigação da seleção atual · base 1" />
          </section>

          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <section aria-label="Qualidade dos dados no relatório" className="min-w-0">
              <SurfaceCard className="h-full">
                <h2 className="font-display text-lg font-semibold text-ink">Qualidade dos Dados</h2>
                {quality && analysis ? (
                  <>
                    <p className="mt-2 text-sm text-primary">{analysis.quality_status}</p>
                    {(isAnalyzing || error) && <p role="status" className="mt-3 rounded-md bg-panel-soft p-3 text-xs leading-5 text-muted">{isAnalyzing ? 'Atualização de qualidade em andamento.' : 'A última tentativa de qualidade falhou.'} Exibindo a última análise concluída deste CSV.</p>}
                    <ReportValues items={[
                      ['Total de registros', formatCount(quality.total_records)],
                      ['Registros válidos', formatCount(quality.valid_records)],
                      ['Registros inválidos', formatCount(quality.invalid_records)],
                      ['Percentual de qualidade', formatPercent(quality.valid_percentage)],
                      ['Total de inconsistências', formatCount(quality.total_issues)],
                    ]} />
                    {quality.total_records === 0 && <p className="mt-4 text-xs text-muted">Sem registros para calcular o percentual de qualidade.</p>}
                    <p className="mt-4 text-xs leading-5 text-muted">Um registro pode apresentar várias inconsistências. Os totais são da análise de qualidade do CSV atual.</p>
                  </>
                ) : <p className="mt-4 text-sm leading-6 text-muted">{isAnalyzing ? 'Análise de qualidade em andamento, ainda sem resultado confirmado.' : error ? `Sem resultado de qualidade confirmado. ${error}` : 'Análise de qualidade não executada nesta sessão.'}</p>}
                <Link to={quality ? '/qualidade' : '/'} className={linkClass}>{quality ? 'Consultar qualidade dos dados →' : 'Ir para Visão Geral →'}</Link>
              </SurfaceCard>
            </section>

            <section aria-label="Machine Learning no relatório" className="min-w-0">
              <SurfaceCard className="h-full">
                <h2 className="font-display text-lg font-semibold text-ink">Machine Learning</h2>
                {ml ? (
                  <>
                    <p className="mt-2 text-sm text-primary">Isolation Forest · inferência do modelo previamente treinado</p>
                    {anomaly.status !== 'success' && <p role="status" className="mt-3 rounded-md bg-panel-soft p-3 text-xs leading-5 text-muted">{anomaly.status === 'loading' ? 'Atualização de ML em andamento.' : 'A última tentativa de ML não foi concluída.'} Exibindo a última análise concluída deste CSV.</p>}
                    <ReportValues items={[
                      ['Versão do modelo', ml.model_version],
                      ['Registros avaliados', formatCount(ml.evaluated_records)],
                      ['Registros ignorados', formatCount(ml.skipped_records)],
                      ['Anomalias detectadas', formatCount(ml.anomalies_detected)],
                      ['Percentual de anômalos', formatPercent(anomalyShare)],
                    ]} />
                    <p className="mt-4 text-xs leading-5 text-muted">{anomalyShare === null ? 'Nenhum registro avaliado; não há percentual de anômalos para calcular.' : 'Percentual calculado somente sobre os registros avaliados; ignorados ficam fora do denominador.'} Alertas não confirmam fraude e scores não representam probabilidade ou severidade.</p>
                  </>
                ) : <p className="mt-4 text-sm leading-6 text-muted">{anomaly.status === 'loading' ? 'Análise de ML em andamento, ainda sem resultado confirmado.' : anomaly.error ? `Sem resultado de ML confirmado. ${anomaly.error}` : 'Análise de ML não executada nesta sessão.'}</p>}
                <Link to="/anomalias" className={linkClass}>Consultar detecção de anomalias →</Link>
              </SurfaceCard>
            </section>
          </div>

          <section aria-label="Investigação no relatório" className="min-w-0">
            <SurfaceCard>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-ink">Investigações com IA</h2>
                {agent && <span className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-primary">{agent.mode === 'simulated' ? 'Modo simulado · sem LLM real' : 'Provedor OpenAI'}</span>}
              </div>
              {agent ? (
                <>
                  {investigation.status !== 'success' && <p role="status" className="mt-3 rounded-md bg-panel-soft p-3 text-xs leading-5 text-muted">{investigation.status === 'loading' ? 'Nova investigação em andamento.' : 'A última tentativa de investigação falhou.'} Exibindo a última investigação concluída deste registro.</p>}
                  <p className="mt-4 text-sm leading-7 text-ink">{investigationSummary(agent)}</p>
                  <p className="mt-2 text-xs leading-5 text-muted">Síntese de fatos do servidor sobre o registro #{agent.context.record_index}. Não representa uma análise de todo o lote nem confirma causas.</p>
                  <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
                    <div className="rounded-md bg-panel-soft p-4">
                      <h3 className="text-sm font-semibold text-ink">Evidências e interpretações disponíveis</h3>
                      <ReportValues items={[
                        ['Evidências verificadas', formatCount(agent.verified_evidence.length)],
                        ['Hipóteses não confirmadas', formatCount(agent.hypotheses.length)],
                        ['Recomendações', formatCount(agent.recommendations.length)],
                      ]} />
                      <p className="mt-4 text-xs leading-5 text-muted">As referências e o conteúdo completo permanecem na página Investigações com IA. Nenhuma correção foi executada.</p>
                    </div>
                    <ReportLimitations key={agent.context.transaction.reference} items={limitations} />
                  </div>
                  <details className="mt-5 rounded-md border border-outline/50 p-4">
                    <summary className="min-h-8 cursor-pointer text-sm font-semibold text-primary">Identificação técnica da investigação</summary>
                    <ReportValues items={[
                      ['Conjunto de dados (SHA-256)', agent.context.dataset_id],
                      ['Referência do registro', agent.context.transaction.reference],
                      ['Provedor retornado', agent.provider],
                      ['Modo técnico', agent.mode],
                    ]} />
                  </details>
                </>
              ) : <p className="mt-4 text-sm leading-6 text-muted">{investigation.status === 'loading' ? 'Investigação em andamento, ainda sem resultado confirmado.' : investigation.error ? `Sem investigação confirmada para esta seleção. ${investigation.error}` : 'Investigação não executada para a seleção atual.'}</p>}
              <Link to="/investigacoes" className={linkClass}>Consultar investigação do registro →</Link>
            </SurfaceCard>
          </section>
        </div>
      )}
    </>
  )
}
