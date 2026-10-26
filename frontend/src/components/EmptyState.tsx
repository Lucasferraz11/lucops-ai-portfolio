import { Icon, type IconName } from './Icon'

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: IconName
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-outline bg-panel-soft/60 px-6 py-9 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-panel-raised text-primary">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
    </div>
  )
}
