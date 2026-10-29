import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { InvestigationReport } from '../components/InvestigationReport'
import { PageHeading } from '../components/PageHeading'
import { SurfaceCard } from '../components/SurfaceCard'
import { useAnalysis } from '../state/AnalysisContext'

export function InvestigationsPage() {
  const { selectedFile, analysis, anomaly, investigation, investigationIndex, selectInvestigationIndex, investigate } = useAnalysis()
  const loading = investigation.status === 'loading'
  const total = analysis?.summary.total_records ?? (anomaly.result ? anomaly.result.evaluated_records + anomaly.result.skipped_records : undefined)
  const indices = [...new Set([
    ...(analysis?.details?.items.map((item) => item.record_index) ?? []),
    ...(anomaly.result?.results.map((item) => item.record_index) ?? []),
    ...(anomaly.result?.ineligible.map((item) => item.record_index) ?? []),
  ])].sort((a, b) => a - b)

  return (
    <>
      <PageHeading eyebrow="Investigação orientada por evidências" title="Investigações com IA" description="Consulte fatos verificados, hipóteses não confirmadas e recomendações para um registro do CSV atual." />
      <SurfaceCard className="mb-6 border-l-4 border-l-primary bg-panel-soft">
        <h2 className="text-sm font-semibold text-primary">Modo simulado · sem LLM real</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Nesta entrega, as respostas são determinísticas, sem chamadas a provedores externos de IA ou custos de OpenAI. A investigação só começa quando você solicita.</p>
      </SurfaceCard>
      {!selectedFile ? <SurfaceCard>
        <EmptyState icon="investigations" title="Nenhum CSV selecionado" description="Selecione um CSV na Visão Geral para investigar um registro pelo índice original." />
        <Link to="/" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline">Ir para Visão Geral →</Link>
      </SurfaceCard> : <>
        <SurfaceCard>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Arquivo da sessão</p>
          <p className="mt-2 break-all font-display font-semibold text-ink">{selectedFile.name}</p>
          <form className="mt-5 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => { event.preventDefault(); void investigate() }}>
            <label className="text-xs font-semibold text-muted">Índice do registro
              <input type="number" min={1} step={1} max={total} required value={investigationIndex} onChange={(event) => selectInvestigationIndex(event.target.value)} aria-describedby="investigation-index-help"
                className="mt-2 min-h-11 w-full rounded-md border border-outline bg-panel-soft px-3 font-mono text-sm text-ink" />
            </label>
            {indices.length > 0 && <label className="text-xs font-semibold text-muted">Atalhos dos resultados disponíveis
              <select value="" onChange={(event) => { if (event.target.value) selectInvestigationIndex(event.target.value) }} className="mt-2 min-h-11 w-full rounded-md border border-outline bg-panel-soft px-3 text-sm text-ink">
                <option value="">Escolher um índice conhecido</option>
                {indices.map((index) => <option key={index} value={index}>Registro #{index}</option>)}
              </select>
            </label>}
            <button type="submit" disabled={loading || total === 0} className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60">
              {loading ? 'Investigando…' : 'Investigar com IA'}
            </button>
          </form>
          <p id="investigation-index-help" className="mt-3 text-xs leading-5 text-muted">O índice começa em 1, sem contar o cabeçalho, e identifica registros mesmo com IDs vazios ou duplicados.{total !== undefined ? ` Este CSV possui ${total} registro(s), conforme a análise da sessão.` : ' Se ainda não há análise do lote, o servidor verificará se o índice existe.'}</p>
          <p className="mt-2 text-xs leading-5 text-muted">Os atalhos apenas selecionam o índice. As evidências são reconstruídas no servidor, sem aceitar scores ou indicadores do navegador.</p>
          {investigation.status === 'not-executed' && <p className="mt-4 text-sm text-muted">Nenhuma investigação executada para esta seleção.</p>}
          {loading && <p role="status" className="mt-4 text-sm text-muted">Investigação em andamento. Aguarde a resposta do servidor.</p>}
          {investigation.error && <p role="alert" className="mt-4 text-sm text-[#ffb4ab]">{investigation.error} A tentativa não foi concluída.</p>}
        </SurfaceCard>
        {investigation.result && <InvestigationReport result={investigation.result} previous={investigation.status !== 'success'} />}
      </>}
    </>
  )
}
