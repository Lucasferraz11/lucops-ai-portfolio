import { useId, useState } from 'react'
import type { InvestigationResult } from '../services/investigations'
import { displayEvidenceValue, evidenceDescription, investigationSummary } from '../utils/investigation'
import { QualityMetricCard } from './QualityMetricCard'
import { SurfaceCard } from './SurfaceCard'

export function InvestigationReport({ result, previous }: { result: InvestigationResult; previous: boolean }) {
  const scope = useId()
  const [expandedResult, setExpandedResult] = useState<InvestigationResult | null>(null)
  const showAll = expandedResult === result
  const evidenceListId = `${scope}-evidence-list`
  const { context } = result
  const labels = new Map(result.verified_evidence.map((item, index) => [item.evidence_id, `E${index + 1}`]))
  const references = (ids: string[]) => <span className="mt-2 flex flex-wrap gap-2">{ids.map((id) => <span key={id} title={id} className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">{labels.get(id)}</span>)}</span>
  const preferred = result.verified_evidence.filter((e) =>
    e.kind === 'quality' || (e.source.record_index === context.record_index && ['valor', 'ml.status', 'is_anomaly', 'eligibility'].includes(e.source.field)),
  )
  const preferredIds = new Set(preferred.map((item) => item.evidence_id))
  const primary = showAll ? result.verified_evidence : [
    ...preferred,
    ...result.verified_evidence.filter((item) => !preferredIds.has(item.evidence_id)),
  ].slice(0, 5)
  const mlLabel = context.ml.status === 'evaluated' ? context.ml.is_anomaly ? 'Alerta estatístico' : 'Sem alerta estatístico' : context.ml.status === 'ineligible' ? 'Inelegível' : 'Indisponível'
  const limitations = [...new Set([...context.ml.reasons, ...result.insufficient_evidence, ...result.limitations.slice(0, 3)])]

  return (
    <section aria-label="Resultado da investigação" className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">{previous ? 'Última investigação concluída deste registro' : 'Investigação concluída'}</h2>
        <span className="rounded-md border border-primary/25 bg-primary/10 px-3 py-2 font-mono text-xs text-primary">Modo {result.mode === 'simulated' ? 'simulado' : result.mode}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <QualityMetricCard label="Registro investigado" icon="database" value={`#${context.record_index}`} caption="Índice original no CSV · base 1" />
        <QualityMetricCard label="Valor informado" icon="layers" value={displayEvidenceValue(context.transaction.original_value)} caption="Texto disponibilizado pelo servidor" />
        <QualityMetricCard label="Inconsistências de qualidade" icon="quality" value={String(context.inconsistencies.length)} caption="Inconsistências verificadas pelas regras" />
        <QualityMetricCard label="Situação do ML" icon="anomalies" value={mlLabel} caption="Não representa probabilidade ou severidade" />
      </div>
      <SurfaceCard className="border-primary/20 bg-panel-soft">
        <h2 className="font-display text-base font-semibold text-primary">Resumo dos fatos verificados</h2>
        <p className="mt-3 text-sm leading-7 text-ink">{investigationSummary(result)}</p>
        <p className="mt-3 text-xs leading-5 text-muted">Síntese de apresentação baseada no contexto do servidor. Causas não são confirmadas pelo alerta estatístico.</p>
      </SurfaceCard>
      <SurfaceCard>
        <h2 className="font-display text-base font-semibold text-ink">Evidências verificadas</h2>
        <p className="mt-1 text-xs leading-5 text-muted">Referências curtas para leitura; identificadores e origens completos nos detalhes técnicos. Exibindo {primary.length} de {result.verified_evidence.length} evidências.</p>
        <ul id={evidenceListId} aria-label="Evidências verificadas" className="mt-4 grid gap-3 md:grid-cols-2">{primary.map((item) => (
          <li key={item.evidence_id} className="min-w-0 rounded-md border border-outline/50 bg-panel-soft p-4">
            <span className="font-mono text-xs text-primary">{labels.get(item.evidence_id)} · {item.source.record_index === null ? 'CSV atual' : `Registro #${item.source.record_index}`}</span>
            <p className="mt-2 break-words text-sm leading-6 text-ink">{evidenceDescription(item)}</p>
            <p className="mt-2 break-all font-mono text-xs text-muted">{displayEvidenceValue(item.value)}</p>
          </li>
        ))}</ul>
        {result.verified_evidence.length === 0 && <p className="mt-4 text-sm text-muted">Nenhuma evidência verificada foi retornada pelo servidor.</p>}
        {result.verified_evidence.length > 5 && (
          <button
            type="button"
            aria-expanded={showAll}
            aria-controls={evidenceListId}
            onClick={() => setExpandedResult(showAll ? null : result)}
            className="mt-4 min-h-11 rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            {showAll ? 'Mostrar menos' : 'Ver todas as evidências'}
          </button>
        )}
      </SurfaceCard>
      <div className="grid gap-5 lg:grid-cols-2">
        <SurfaceCard>
          <h2 className="font-display text-base font-semibold text-ink">Hipóteses não confirmadas</h2>
          <p className="mt-1 text-xs text-muted">Interpretações do provedor, separadas dos fatos verificados.</p>
          {result.hypotheses.length === 0 ? <p className="mt-4 text-sm text-muted">Nenhuma hipótese foi proposta com as evidências disponíveis.</p> : <ul className="mt-4 space-y-3">{result.hypotheses.map((h, index) => (
            <li key={index} className="rounded-md bg-panel-soft p-4 text-sm leading-6 text-muted"><span className="mb-2 block text-xs font-semibold text-primary">Não confirmada</span>{h.description}{references(h.evidence_ids)}</li>
          ))}</ul>}
        </SurfaceCard>
        <SurfaceCard>
          <h2 className="font-display text-base font-semibold text-ink">Recomendações fundamentadas</h2>
          <p className="mt-1 text-xs text-muted">Sugestões para revisão humana; nenhuma correção foi executada.</p>
          {result.recommendations.length === 0 ? <p className="mt-4 text-sm text-muted">Nenhuma recomendação foi proposta.</p> : <ol className="mt-4 space-y-3">{result.recommendations.map((r, index) => (
            <li key={index} className="rounded-md bg-panel-soft p-4 text-sm leading-6 text-muted"><span className="mr-2 font-mono text-primary">{index + 1}.</span>{r.action}{references(r.evidence_ids)}</li>
          ))}</ol>}
        </SurfaceCard>
      </div>
      <SurfaceCard>
        <h2 className="font-display text-base font-semibold text-ink">Limitações e informações não comprovadas</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">{limitations.map((text) => <li key={text}>{text}</li>)}</ul>
        <p className="mt-3 text-xs text-muted">Todas as limitações retornadas permanecem disponíveis nos detalhes técnicos.</p>
      </SurfaceCard>
      <SurfaceCard>
        <details>
          <summary className="min-h-10 cursor-pointer font-display text-sm font-semibold text-primary">Ver detalhes técnicos</summary>
          <dl className="mt-4 space-y-3 break-all text-xs leading-6 text-muted">
            <div><dt className="font-semibold text-ink">Provedor retornado</dt><dd>{result.provider} · {result.mode}</dd></div>
            <div><dt className="font-semibold text-ink">Conjunto de dados (SHA-256)</dt><dd className="font-mono">{context.dataset_id}</dd></div>
            <div><dt className="font-semibold text-ink">Referência do registro</dt><dd className="font-mono">{context.transaction.reference}</dd></div>
            <div><dt className="font-semibold text-ink">Informações de ML e limitações completas</dt><dd><pre className="whitespace-pre-wrap break-all font-mono">{JSON.stringify({ ml: context.ml, limitations: result.limitations, insufficient_evidence: result.insufficient_evidence }, null, 2)}</pre></dd></div>
          </dl>
          <h3 className="mt-5 text-sm font-semibold text-ink">Todas as evidências e origens</h3>
          <ul className="mt-3 space-y-3">{result.verified_evidence.map((item) => <li key={item.evidence_id} id={`${scope}-${labels.get(item.evidence_id)}`} className="rounded-md bg-panel-soft p-4 text-xs leading-6 text-muted">
            <p className="font-semibold text-primary">{labels.get(item.evidence_id)} · {item.description}</p>
            <dl className="mt-2 space-y-1 break-all"><div><dt>Identificador completo</dt><dd className="font-mono">{item.evidence_id}</dd></div>
              <div><dt>Origem completa</dt><dd className="font-mono">{item.source.dataset_id} · {item.source.record_index === null ? 'lote atual' : `registro #${item.source.record_index}`} · {item.source.function} · {item.source.field}</dd></div>
              <div><dt>Valor / expectativa</dt><dd>{displayEvidenceValue(item.value)} / {item.expected ?? 'Não informada'}</dd></div></dl>
          </li>)}</ul>
          <h3 className="mt-5 text-sm font-semibold text-ink">JSON completo retornado pelo servidor</h3>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-panel-soft p-4 font-mono text-xs leading-6 text-muted">{JSON.stringify(result, null, 2)}</pre>
        </details>
      </SurfaceCard>
    </section>
  )
}
