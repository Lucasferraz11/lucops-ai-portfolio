import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { PageHeading } from '../components/PageHeading'
import { QualityDistribution } from '../components/QualityDistribution'
import { QualityMetricCard } from '../components/QualityMetricCard'
import { SurfaceCard } from '../components/SurfaceCard'
import { UploadPanel } from '../components/UploadPanel'
import { useAnalysis } from '../state/AnalysisContext'
import { formatCount, qualityDisplay } from '../utils/quality'

const indicators = [
  { label: 'Registros analisados', icon: 'database' as const },
  { label: 'Qualidade dos dados', icon: 'quality' as const },
  { label: 'Inconsistências encontradas', icon: 'layers' as const },
  { label: 'Anomalias sinalizadas', icon: 'anomalies' as const },
]

export function OverviewPage() {
  const { selectedFile, analysis, isAnalyzing, error, anomaly } = useAnalysis()
  const summary = analysis?.summary
  const display = summary ? qualityDisplay(summary) : null
  const values = [
    display?.total ?? '—',
    display?.percent ?? '—',
    display?.issues ?? '—',
    anomaly.result ? formatCount(anomaly.result.anomalies_detected) : anomaly.status === 'loading' ? 'Em análise' : anomaly.status === 'not-analyzed' ? 'Não analisado' : 'Indisponível',
  ]
  const captions = [
    summary ? 'CSV atual' : 'Aguardando análise',
    analysis?.quality_status ?? 'Aguardando análise',
    summary ? 'Ocorrências no CSV atual' : 'Aguardando análise',
    anomaly.result ? anomaly.status === 'success' ? 'Alertas estatísticos · CSV atual' : 'Última análise de ML concluída' : anomaly.status === 'not-analyzed' ? 'Análise de ML ainda não executada' : 'Consulte Detecção de Anomalias',
  ]
  return (
    <>
      <PageHeading
        eyebrow="Plataforma analítica · qualidade de dados"
        title="Visão Geral"
        description="Envie um CSV para consultar os resultados de qualidade calculados pelo servidor."
      />

      <div className="grid min-w-0 gap-5 lg:grid-cols-12">
        <SurfaceCard className="min-w-0 lg:col-span-8">
          <UploadPanel />
        </SurfaceCard>

        <SurfaceCard className="flex min-w-0 flex-col lg:col-span-4">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-muted">
            {analysis && (isAnalyzing || error) ? 'Última análise concluída' : 'Lote da sessão'}
          </p>
          <div className="flex flex-1 flex-col justify-center py-5 sm:py-6">
            {analysis && summary ? (
              <>
                <Icon name="database" className="mb-4 h-9 w-9 text-primary" />
                <p className="break-all font-display text-base font-semibold text-ink">{selectedFile?.name}</p>
                <p className="mt-3 text-sm text-muted">{analysis.quality_status}</p>
                <p className="mt-2 text-sm text-muted">{formatCount(summary.valid_records)} válidos · {formatCount(summary.invalid_records)} inválidos</p>
              </>
            ) : (
              <div className="text-center">
                <Icon name="database" className="mx-auto mb-4 h-9 w-9 text-primary/70" />
                <p className="font-display text-lg font-semibold text-ink">Nenhum lote analisado</p>
                <p className="mt-2 text-sm leading-6 text-muted">Os resultados do CSV selecionado aparecerão aqui.</p>
              </div>
            )}
          </div>
          <p className="border-t border-outline/60 pt-4 font-mono text-[11px] text-muted">
            {analysis ? 'Análise atual · sem histórico persistente' : 'Aguardando análise de dados'}
          </p>
        </SurfaceCard>
      </div>

      <section aria-label="Indicadores do lote" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {indicators.map(({ label, icon }, index) => (
          <QualityMetricCard key={label} label={label} icon={icon} value={values[index]} caption={captions[index]} tone={index === 2 && summary?.total_issues ? 'error' : index === 1 ? 'positive' : 'default'} progress={index === 1 ? summary?.valid_percentage ?? undefined : undefined} />
        ))}
      </section>

      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-2">
        <SurfaceCard className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-ink">Distribuição dos registros</h2>
              <p className="mt-1 text-sm text-muted">Resultado da qualidade do CSV atual.</p>
            </div>
            {analysis && <Link to="/qualidade" className="text-sm font-semibold text-primary hover:underline">Ver qualidade do lote →</Link>}
          </div>
          {summary ? (
            <div className="mt-5"><QualityDistribution summary={summary} /></div>
          ) : <div className="mt-5"><EmptyState icon="quality" title={isAnalyzing ? 'Análise em andamento' : error ? 'Resultado indisponível' : 'Distribuição indisponível'} description={isAnalyzing ? 'O gráfico será exibido quando a análise do CSV terminar.' : 'Ainda não há registros analisados para apresentar neste painel.'} /></div>}
        </SurfaceCard>
        <SurfaceCard className="min-w-0">
          <h2 className="font-display text-base font-semibold text-ink">Alertas e investigações</h2>
          <p className="mt-1 text-sm text-muted">Evidências e análises do arquivo atual.</p>
          <div className="mt-5">
            <EmptyState
              icon="investigations"
              title={anomaly.result ? 'Análise de ML disponível' : 'Execuções independentes'}
              description="A análise de qualidade não executa detecção de anomalias nem investigação com IA."
            />
            <Link to="/anomalias" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline">Ver detecção de anomalias →</Link>
          </div>
        </SurfaceCard>
      </div>
    </>
  )
}
