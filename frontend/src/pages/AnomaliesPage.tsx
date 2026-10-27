import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { AnomalyDistribution } from '../components/AnomalyDistribution'
import { AnomalyResultsTable } from '../components/AnomalyResultsTable'
import { Icon } from '../components/Icon'
import { QualityMetricCard } from '../components/QualityMetricCard'
import { PageHeading } from '../components/PageHeading'
import { SurfaceCard } from '../components/SurfaceCard'
import { useAnalysis } from '../state/AnalysisContext'
import { formatCount, formatPercent } from '../utils/quality'

export function AnomaliesPage() {
  const { selectedFile, anomaly, analyzeAnomalies } = useAnalysis()
  const loading = anomaly.status === 'loading'
  const result = anomaly.result
  const anomalyShare = result && result.evaluated_records > 0 ? result.anomalies_detected / result.evaluated_records * 100 : null

  return (
    <>
      <PageHeading eyebrow="Análise do lote · Machine Learning" title="Detecção de Anomalias"
        description="Analise o CSV da sessão com o Isolation Forest previamente treinado no servidor." />
      <SurfaceCard className="mb-6 flex items-start gap-3 border-l-4 border-l-primary bg-panel-soft">
        <Icon name="anomalies" className="mt-1 h-5 w-5 shrink-0 text-primary" />
        <div><h2 className="text-sm font-semibold text-primary">Análise estatística · Isolation Forest</h2>
          <p className="mt-1 text-sm leading-6 text-muted">Os alertas são estatísticos e não confirmam fraude. A análise de ML é independente e não altera os resultados de qualidade.</p>
        </div>
      </SurfaceCard>
      {!selectedFile ? (
        <SurfaceCard>
          <EmptyState icon="anomalies" title="Nenhum CSV selecionado" description="Selecione um CSV na Visão Geral para executar a análise de anomalias." />
          <Link to="/" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline">Ir para Visão Geral →</Link>
        </SurfaceCard>
      ) : (
        <>
        <SurfaceCard className="mb-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Arquivo da sessão</p>
              <p className="mt-2 break-all font-display font-semibold text-ink">{selectedFile.name}</p>
              {result && <p className="mt-2 text-xs text-muted">Versão do modelo: <span className="break-all font-mono text-primary">{result.model_version}</span>.</p>}
            </div>
            <button type="button" disabled={loading} onClick={() => void analyzeAnomalies()}
              className="min-h-11 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60 sm:w-auto">
              {loading ? 'Analisando anomalias…' : 'Executar análise de anomalias'}
            </button>
          </div>
          <div className={`${anomaly.status === 'success' ? '' : 'mt-5'} text-sm leading-6 text-muted`} aria-busy={loading}>
            {anomaly.status === 'not-analyzed' && <p>ML não analisado para este arquivo. A execução depende da ação acima.</p>}
            {loading && <p role="status">Análise de anomalias em andamento. Aguarde a resposta do servidor.</p>}
            {anomaly.error && <p role="alert" className="text-[#ffb4ab]">{anomaly.error} A tentativa não foi concluída.</p>}
          </div>
        </SurfaceCard>
        {result && (
          <section aria-label="Resultado da análise de anomalias">
            <h2 className="mb-4 font-display text-base font-semibold text-ink">{anomaly.status === 'success' ? 'Análise de anomalias concluída' : 'Última análise de anomalias concluída deste arquivo'}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de Machine Learning">
              <QualityMetricCard label="Registros avaliados" icon="database" value={formatCount(result.evaluated_records)} caption="Classificados pelo modelo no CSV atual" />
              <QualityMetricCard label="Anomalias sinalizadas" icon="anomalies" value={formatCount(result.anomalies_detected)} caption="Alertas estatísticos entre os avaliados" tone={result.anomalies_detected > 0 ? 'error' : 'default'} />
              <QualityMetricCard label="Registros ignorados" icon="layers" value={formatCount(result.skipped_records)} caption="Inelegíveis · não classificados pelo modelo" />
              <QualityMetricCard label="Percentual de anômalos" icon="anomalies" value={formatPercent(anomalyShare)} caption={anomalyShare === null ? 'Sem registros avaliados para calcular' : 'Sobre os avaliados · não é probabilidade'} />
            </div>
            <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-12">
              <SurfaceCard className="min-w-0 lg:col-span-8">
                <h2 className="font-display text-base font-semibold text-ink">Distribuição dos registros avaliados</h2>
                <p className="mt-1 text-sm leading-6 text-muted">Normais e anômalos conforme o modelo. Registros ignorados ficam fora desta distribuição.</p>
                <AnomalyDistribution evaluated={result.evaluated_records} anomalies={result.anomalies_detected} />
              </SurfaceCard>
              <SurfaceCard className="flex min-w-0 flex-col lg:col-span-4">
                <h2 className="font-display text-base font-semibold text-ink">Leitura do lote</h2>
                <p className="mt-4 text-sm leading-6 text-muted">{result.evaluated_records === 0 ? 'A execução terminou sem registros elegíveis para classificação.' : result.anomalies_detected === 0 ? 'Nenhuma anomalia foi sinalizada entre os registros avaliados.' : 'Há registros sinalizados para revisão contextual. A classificação não confirma causas ou irregularidades.'}</p>
                <p className="mt-5 border-t border-outline/60 pt-4 text-xs leading-5 text-muted">O percentual resume este CSV e considera apenas os registros avaliados. Não mede risco, probabilidade de fraude ou desempenho histórico.</p>
              </SurfaceCard>
            </div>
            <SurfaceCard className="mt-6 w-full min-w-0 max-w-full"><AnomalyResultsTable results={result.results} ineligible={result.ineligible} /></SurfaceCard>
          </section>
        )}
        </>
      )}
    </>
  )
}
