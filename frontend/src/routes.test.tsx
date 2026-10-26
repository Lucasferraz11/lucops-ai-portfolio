import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './routes'
import { AnalysisProvider } from './state/AnalysisContext'

function renderPath(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AnalysisProvider><AppRoutes /></AnalysisProvider>
    </MemoryRouter>,
  )
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('navegação inicial', () => {
  it.each([
    ['/', 'Visão Geral'],
    ['/qualidade', 'Qualidade dos Dados'],
    ['/anomalias', 'Detecção de Anomalias'],
    ['/investigacoes', 'Investigações com IA'],
    ['/relatorios', 'Relatórios'],
  ])('renderiza %s e destaca a rota ativa', (path, title) => {
    const html = renderPath(path)
    expect(html).toContain(`<h1`)
    expect(html).toContain(title)
    const activeLinks = html.match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? []
    expect(activeLinks).toHaveLength(1)
    expect(activeLinks[0]).toContain(`href="${path}"`)
    expect(html).toContain('Navegação principal')
  })

  it('não apresenta métricas inventadas sem arquivo', () => {
    const html = renderPath('/')
    expect(html).toContain('Arraste um arquivo CSV para cá')
    expect(html).toContain('Aguardando análise')
    expect(html).toContain('Não analisado')
    expect(html).not.toContain('48.520')
    expect(html).not.toContain('API Conectada')
  })

  it('apresenta um estado de preparação nas demais páginas', () => {
    expect(renderPath('/qualidade')).toContain('Nenhuma análise de qualidade disponível')
    expect(renderPath('/relatorios')).toContain('Página em preparação')
  })

  it('expõe o estado do menu móvel e fecha a navegação após escolher a rota', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok', service: 'LucOps AI' }), { status: 200 })))
    render(<MemoryRouter initialEntries={['/']}><AnalysisProvider><AppRoutes /></AnalysisProvider></MemoryRouter>)
    const button = screen.getByRole('button', { name: 'Abrir menu' })
    expect(button.getAttribute('aria-controls')).toBe('primary-sidebar')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('heading', { name: 'Qualidade dos Dados' })).toBeTruthy()
  })
})
