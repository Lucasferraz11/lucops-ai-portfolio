import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../routes'
import { AnalysisProvider } from '../state/AnalysisContext'

function mount(desktop = false) {
  const media = new EventTarget() as EventTarget & { matches: boolean }
  media.matches = desktop
  const matchMedia = vi.fn().mockReturnValue(media)
  vi.stubGlobal('matchMedia', matchMedia)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok', service: 'LucOps AI' }), { status: 200 })))
  const view = render(<MemoryRouter><AnalysisProvider><AppRoutes /></AnalysisProvider></MemoryRouter>)
  return { ...view, media, matchMedia }
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('acessibilidade responsiva da sidebar', () => {
  it('oculta o menu móvel fechado e restaura foco ao fechar pelo link', () => {
    mount()
    const trigger = screen.getByRole('button', { name: 'Abrir menu' })
    const sidebar = document.getElementById('primary-sidebar')!
    // JSDOM does not apply Tailwind media queries or model visibility-based tab order.
    // Assert the responsive visibility mechanism and the actual focus restoration.
    expect(sidebar.classList.contains('invisible')).toBe(true)
    expect(sidebar.classList.contains('lg:visible')).toBe(true)
    fireEvent.click(trigger)
    expect(sidebar.classList.contains('invisible')).toBe(false)
    expect(sidebar.classList.contains('visible')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const link = screen.getByRole('link', { name: 'Qualidade dos Dados' })
    link.focus()
    fireEvent.click(link)
    expect(document.activeElement).toBe(trigger)
    expect(sidebar.contains(document.activeElement)).toBe(false)
    expect(sidebar.classList.contains('invisible')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('restaura foco ao fechar pelo botão e preserva reabertura', () => {
    mount()
    const trigger = screen.getByRole('button', { name: 'Abrir menu' })
    fireEvent.click(trigger)
    const close = screen.getByRole('button', { name: 'Fechar menu' })
    close.focus()
    fireEvent.click(close)
    expect(document.activeElement).toBe(trigger)
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('preserva desktop e remove o foco do menu ao reduzir a tela com ele fechado', () => {
    const { media, matchMedia } = mount(true)
    const trigger = screen.getByRole('button', { name: 'Abrir menu' })
    const link = screen.getByRole('link', { name: 'Qualidade dos Dados' })
    link.focus()
    fireEvent.click(link)
    expect(document.activeElement).toBe(link)
    expect(document.getElementById('primary-sidebar')?.getAttribute('aria-hidden')).toBeNull()
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 64rem)')
    act(() => { media.matches = false; media.dispatchEvent(new Event('change')) })
    expect(document.activeElement).toBe(trigger)
    act(() => { media.matches = true; media.dispatchEvent(new Event('change')) })
    expect(document.getElementById('primary-sidebar')?.classList.contains('lg:visible')).toBe(true)
  })
})
