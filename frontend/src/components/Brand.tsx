export function Brand() {
  return (
    <div className="flex items-center gap-3" aria-label="LucOps AI">
      <img className="h-9 w-9 shrink-0" src="/lucops-mark.svg" alt="" />
      <div className="min-w-0 leading-tight">
        <div className="font-display text-[17px] font-bold tracking-tight text-ink">
          LucOps <span className="text-primary">AI</span>
        </div>
        <div className="font-mono text-[9px] tracking-[0.08em] text-muted">
          DATA OBSERVABILITY &amp; ML
        </div>
      </div>
    </div>
  )
}
