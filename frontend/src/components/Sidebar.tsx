import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router'
import { Brand } from './Brand'
import { Icon } from './Icon'
import { navigation } from '../navigation'
import { useAnalysis } from '../state/AnalysisContext'

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sidebar = useRef<HTMLElement>(null)
  useEffect(() => {
    const desktop = window.matchMedia?.('(min-width: 64rem)')
    const restoreFocus = () => {
      if (!open && !desktop?.matches && sidebar.current?.contains(document.activeElement)) {
        document.getElementById('mobile-menu-trigger')?.focus()
      }
    }
    restoreFocus()
    desktop?.addEventListener('change', restoreFocus)
    return () => desktop?.removeEventListener('change', restoreFocus)
  }, [open])
  const { apiStatus, selectedFile, analysis, isAnalyzing, error } = useAnalysis()
  const connection = {
    checking: { label: 'Verificando conexão', description: 'Consultando o servidor', dot: 'bg-[#f59e0b]' },
    connected: { label: 'API conectada', description: 'Servidor disponível para análises', dot: 'bg-positive' },
    unavailable: { label: 'API indisponível', description: 'Não foi possível acessar o servidor', dot: 'bg-[#ffb4ab]' },
  }[apiStatus]
  return (
    <>
      {open && (
        <button
          aria-label="Fechar menu de navegação"
          className="fixed inset-0 z-40 bg-black/65 lg:hidden"
          onClick={onClose}
          type="button"
        />
      )}
      <aside
        ref={sidebar}
        id="primary-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[85vw] flex-col overflow-y-auto border-r border-outline/50 bg-sidebar transition-transform duration-200 lg:visible lg:translate-x-0 ${open ? 'visible translate-x-0' : 'invisible -translate-x-full'}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-outline/35 px-5">
          <Brand />
          <button
            aria-label="Fechar menu"
            className="rounded-md p-2 text-muted hover:bg-panel-raised lg:hidden"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-3 pt-7 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted/75">
          Plataforma analítica
        </div>
        <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-1 px-3">
          {navigation.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-md px-3.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-strong font-semibold text-[#003640] shadow-[0_0_16px_rgba(6,182,212,0.2)]'
                    : 'text-muted hover:bg-panel-raised hover:text-ink'
                }`
              }
              end={path === '/'}
              onClick={onClose}
              to={path}
            >
              <Icon name={icon} className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="m-3 rounded-lg border border-outline/45 bg-panel-soft px-3 py-3.5">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span>Conexão com a API</span>
            <span className={`h-2 w-2 rounded-full ${connection.dot}`} aria-hidden="true" />
          </div>
          <p className="mt-1.5 text-xs font-medium text-ink" data-testid="api-connection">{connection.label}</p>
          <p className="mt-1 text-[11px] leading-4 text-muted">{connection.description}</p>
          <div className="mt-3 border-t border-outline/50 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Sessão atual</p>
            <p className="mt-1 text-xs text-ink">
              {analysis ? isAnalyzing ? 'Atualizando análise' : error ? 'Resultado anterior disponível' : 'Análise disponível' : 'Nenhum lote analisado'}
            </p>
            {analysis && selectedFile && <p className="mt-1 break-all font-mono text-[10px] text-muted">{selectedFile.name}</p>}
          </div>
        </div>
      </aside>
    </>
  )
}
