import { useState } from 'react'
import { Outlet } from 'react-router'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="min-h-screen overflow-x-clip bg-canvas text-ink">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <Header onOpenMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
      <main id="main-content" className="min-h-screen min-w-0 px-4 pb-10 pt-22 sm:px-6 sm:pt-24 lg:pl-[292px] lg:pr-8">
        <div className="mx-auto max-w-[1440px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
