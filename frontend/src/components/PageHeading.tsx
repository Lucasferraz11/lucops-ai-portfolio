export function PageHeading({
  eyebrow,
  title,
  description,
  className = 'mb-7',
}: {
  eyebrow: string
  title: string
  description: string
  className?: string
}) {
  return (
    <div className={className}>
      <p className="mb-1 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
        {eyebrow}
      </p>
      <h1 className="font-display text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">
        {title}
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted sm:text-[15px]">
        {description}
      </p>
    </div>
  )
}
