import { formatCount, formatPercent, shareOfBatch } from '../utils/quality'

export function AnomalyDistribution({ evaluated, anomalies }: { evaluated: number; anomalies: number }) {
  if (evaluated === 0) {
    return <p className="rounded-lg border border-dashed border-outline bg-panel-soft/60 px-5 py-12 text-center text-sm leading-6 text-muted">Nenhum registro foi avaliado pelo modelo; não é possível concluir ausência de anomalias.</p>
  }
  const normal = evaluated - anomalies
  const normalShare = shareOfBatch(normal, evaluated)
  return (
    <div className="flex flex-col items-center gap-7 py-4 sm:flex-row sm:justify-center">
      <div role="img" aria-label={`Distribuição de ML: ${formatCount(normal)} normais e ${formatCount(anomalies)} anômalos`}
        className="flex h-44 w-44 shrink-0 items-center justify-center rounded-full p-[18px] sm:h-48 sm:w-48"
        style={{ background: `conic-gradient(var(--color-primary) 0% ${normalShare}%, #ffb4ab ${normalShare}% 100%)` }}>
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-panel">
          <span className="font-display text-3xl font-bold tabular-nums text-ink">{formatCount(evaluated)}</span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">avaliados</span>
        </div>
      </div>
      <dl className="w-full max-w-xs space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3 rounded-md bg-panel-soft p-4">
          <dt className="flex items-center gap-2 text-muted"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-primary" />Normais</dt>
          <dd className="font-mono tabular-nums text-ink">{formatCount(normal)} <span className="text-xs text-muted">({formatPercent(normalShare)})</span></dd>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md bg-panel-soft p-4">
          <dt className="flex items-center gap-2 text-muted"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#ffb4ab]" />Anômalos</dt>
          <dd className="font-mono tabular-nums text-ink">{formatCount(anomalies)} <span className="text-xs text-muted">({formatPercent(shareOfBatch(anomalies, evaluated))})</span></dd>
        </div>
      </dl>
    </div>
  )
}
