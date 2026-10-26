import type { QualitySummary } from '../services/api'
import { formatCount, formatPercent, shareOfBatch } from '../utils/quality'

export function QualityDistribution({ summary }: { summary: QualitySummary }) {
  if (summary.total_records === 0) {
    return <p className="rounded-lg border border-dashed border-outline bg-panel-soft/60 px-5 py-12 text-center text-sm text-muted">O CSV analisado não contém registros para distribuir.</p>
  }

  const validShare = shareOfBatch(summary.valid_records, summary.total_records)
  const invalidShare = shareOfBatch(summary.invalid_records, summary.total_records)
  return (
    <div className="flex flex-col items-center gap-8 py-3 sm:flex-row sm:justify-center lg:gap-10">
      <div
        className="relative flex h-44 w-44 shrink-0 items-center justify-center rounded-full p-[18px] sm:h-48 sm:w-48"
        style={{ background: `conic-gradient(var(--color-positive) 0% ${validShare}%, #ffb4ab ${validShare}% 100%)` }}
        role="img"
        aria-label={`Distribuição do lote: ${formatCount(summary.valid_records)} válidos e ${formatCount(summary.invalid_records)} inválidos`}
      >
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-panel text-center">
          <span className="font-display text-3xl font-bold tabular-nums text-ink">{formatPercent(summary.valid_percentage)}</span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">registros válidos</span>
        </div>
      </div>
      <div className="w-full max-w-xs space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md bg-panel-soft px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted"><span className="h-2.5 w-2.5 rounded-full bg-positive" />Válidos</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-ink">{formatCount(summary.valid_records)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md bg-panel-soft px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-muted"><span className="h-2.5 w-2.5 rounded-full bg-[#ffb4ab]" />Inválidos</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-ink">{formatCount(summary.invalid_records)}</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-panel-raised" role="img" aria-label={`Proporção de registros: ${formatPercent(validShare)} válidos e ${formatPercent(invalidShare)} inválidos`}>
          <div className="flex h-full"><div className="h-full bg-positive" style={{ width: `${validShare}%` }} /><div className="h-full bg-[#ffb4ab]" style={{ width: `${invalidShare}%` }} /></div>
        </div>
      </div>
    </div>
  )
}
