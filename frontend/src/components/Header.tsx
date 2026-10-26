import { Brand } from './Brand'
import { Icon } from './Icon'
import { useAnalysis } from '../state/AnalysisContext'

export function Header({ onOpenMenu, menuOpen }: { onOpenMenu: () => void; menuOpen: boolean }) {
  const { analysis, isAnalyzing, error } = useAnalysis()
  const sessionLabel = analysis
    ? isAnalyzing ? 'Atualizando análise' : error ? 'Última atualização falhou' : 'Análise disponível nesta sessão'
    : isAnalyzing ? 'Analisando arquivo' : 'Nenhum lote analisado'
  const dotColor = analysis && error ? 'bg-[#ffb4ab]' : isAnalyzing ? 'bg-primary' : analysis ? 'bg-positive' : 'bg-muted'
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-outline/45 bg-sidebar/95 px-4 backdrop-blur-xl sm:px-6 lg:left-[260px] lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          id="mobile-menu-trigger"
          aria-label="Abrir menu"
          aria-controls="primary-sidebar"
          aria-expanded={menuOpen}
          className="rounded-md p-2 text-ink hover:bg-panel-raised lg:hidden"
          onClick={onOpenMenu}
          type="button"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <div className="sm:hidden">
          <Brand />
        </div>
        <div className="hidden items-center gap-2 rounded-md bg-panel-soft px-3 py-1.5 font-mono text-[11px] text-muted sm:flex">
          <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
          <span>{sessionLabel}</span>
        </div>
      </div>
      <span className="hidden rounded-md border border-outline/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted sm:inline-flex">
        Fundação · Fase 7
      </span>
    </header>
  )
}
