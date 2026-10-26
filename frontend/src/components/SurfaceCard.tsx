import type { ReactNode } from 'react'

export function SurfaceCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-lg border border-outline/60 bg-panel p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  )
}
