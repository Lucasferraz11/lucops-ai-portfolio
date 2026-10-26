import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { PageHeading } from '../components/PageHeading'
import { QualityDistribution } from '../components/QualityDistribution'
import { QualityIssuesTable } from '../components/QualityIssuesTable'
import { QualityMetricCard } from '../components/QualityMetricCard'
import { SurfaceCard } from '../components/SurfaceCard'
import { useAnalysis } from '../state/AnalysisContext'
import { qualityDisplay, shareOfBatch } from '../utils/quality'

export function QualityPage() {
  const { selectedFile, analysis, isAnalyzing, error } = useAnalysis()
  const summary = analysis?.summary
  const display = summary ? qualityDisplay(summary) : null

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <PageHeading
          className="min-w-0"
          eyebrow="Análise do lote · qualidade de dados"
          title="Qualidade dos Dados"
          description="Conformidade dos registros do CSV atual, conforme a análise realizada pela FastAPI."
        />
        <Link to="/" className="inline-flex min-h-10 items-center rounded-md border border-outline bg-panel-raised px-4 text-sm font-semibold text-ink hover:border-primary hover:text-primary">
          Ir para Visão Geral
        </Link>
      </div>

      {!analysis || !summary || !display ? (
        <SurfaceCard>
          <EmptyState
            icon="quality"
            title={isAnalyzing ? 'Análise em andamento' : 'Nenhuma análise de qualidade disponível'}
            description={isAnalyzing ? 'O CSV está sendo analisado. Os resultados aparecerão aqui ao concluir.' : selectedFile ? 'O arquivo selecionado ainda não possui resultado confirmado. Analise-o na Visão Geral.' : 'Envie e analise um CSV na Visão Geral para ver os indicadores de qualidade.'}
          />
          {error && <p className="mt-4 text-center text-sm text-[#ffb4ab]">A última tentativa não produziu uma análise: {error}</p>}
        </SurfaceCard>
      ) : (
        <>
          <SurfaceCard className="mb-6 flex min-w-0 flex-wrap items-center justify-between gap-4 border-primary/20 bg-panel-soft">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Arquivo analisado nesta sessão</p>
              <p className="mt-1 break-all font-display text-base font-semibold text-ink">{selectedFile?.name}</p>
            </div>
            <span className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${analysis.quality_status === 'COM INCONSISTÊNCIAS' ? 'border-[#ffb4ab]/35 bg-[#93000a]/20 text-[#ffb4ab]' : analysis.quality_status === 'SEM DADOS' ? 'border-outline bg-panel-raised text-muted' : 'border-positive/35 bg-positive/10 text-positive'}`}>
              {analysis.quality_status}
            </span>
          </SurfaceCard>
          {(isAnalyzing || error) && (
            <p role="status" className="mb-6 rounded-md border border-outline bg-panel-soft px-4 py-3 text-sm text-muted">
              {isAnalyzing ? 'Atualização em andamento. Os indicadores abaixo pertencem à última análise concluída.' : 'A última atualização falhou. Os indicadores abaixo pertencem à última análise concluída deste arquivo.'}
            </p>
          )}

          <section aria-label="Indicadores de qualidade" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QualityMetricCard label="Percentual geral de qualidade" icon="quality" value={display.percent} caption={summary.valid_percentage === null ? 'Sem registros para calcular' : 'Registros válidos no CSV atual'} tone="positive" progress={summary.valid_percentage ?? undefined} />
            <QualityMetricCard label="Registros válidos" icon="database" value={display.valid} caption={`De ${display.total} registros analisados`} tone="positive" progress={shareOfBatch(summary.valid_records, summary.total_records)} />
            <QualityMetricCard label="Registros inválidos" icon="layers" value={display.invalid} caption={`De ${display.total} registros analisados`} tone="error" progress={shareOfBatch(summary.invalid_records, summary.total_records)} />
            <QualityMetricCard label="Total de inconsistências" icon="quality" value={display.issues} caption="Ocorrências de regras de qualidade" />
          </section>

          <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-12">
            <SurfaceCard className="min-w-0 lg:col-span-7">
              <div className="mb-5">
                <h2 className="font-display text-base font-semibold text-ink">Distribuição dos registros</h2>
                <p className="mt-1 text-sm text-muted">Proporção entre registros válidos e inválidos no lote atual.</p>
              </div>
              <QualityDistribution summary={summary} />
            </SurfaceCard>
            <SurfaceCard className="min-w-0 lg:col-span-5">
              <h2 className="font-display text-base font-semibold text-ink">Resumo da verificação</h2>
              <p className="mt-1 text-sm text-muted">Contagens fornecidas pela análise de qualidade.</p>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-outline/50 pb-3 text-sm"><span className="text-muted">Registros analisados</span><span className="font-mono tabular-nums text-ink">{display.total}</span></div>
                <div className="flex items-center justify-between gap-4 border-b border-outline/50 pb-3 text-sm"><span className="text-muted">Registros com inconsistências</span><span className="font-mono tabular-nums text-ink">{display.invalid}</span></div>
                <div className="flex items-center justify-between gap-4 text-sm"><span className="text-muted">Ocorrências de inconsistências</span><span className="font-mono tabular-nums text-ink">{display.issues}</span></div>
              </div>
              <p className="mt-6 rounded-md bg-panel-soft px-4 py-3 text-xs leading-5 text-muted">Um registro pode apresentar mais de uma inconsistência; por isso, o total de ocorrências pode diferir da quantidade de registros inválidos.</p>
            </SurfaceCard>
          </div>

          <SurfaceCard className="mt-6 min-w-0">
            <QualityIssuesTable details={analysis.details} totalIssues={summary.total_issues} />
          </SurfaceCard>
        </>
      )}
    </>
  )
}
