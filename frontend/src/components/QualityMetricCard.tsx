import { Icon, type IconName } from './Icon'
import { SurfaceCard } from './SurfaceCard'

export function QualityMetricCard({ label, icon, value, caption, tone = 'default', progress }: {
  label: string
  icon: IconName
  value: string
  caption: string
  tone?: 'default' | 'positive' | 'error'
  progress?: number
}) {
  const valueColor = tone === 'error' ? 'text-[#ffb4ab]' : 'text-ink'
  const barColor = tone === 'error' ? 'bg-[#ffb4ab]' : tone === 'positive' ? 'bg-positive' : 'bg-primary'
  return (
    <SurfaceCard className="flex h-full min-h-40 flex-col justify-between transition-colors hover:border-outline">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-medium leading-5 text-muted">{label}</h2>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-panel-raised text-primary">
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <div>
        <p className={`mt-4 break-words font-display text-2xl font-bold leading-tight tabular-nums sm:text-3xl ${valueColor}`} aria-label={`${label}: ${value}`}>
          {value}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted">{caption}</p>
        {progress !== undefined && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel-raised" role="meter" aria-label={`${label} no lote`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </SurfaceCard>
  )
}
