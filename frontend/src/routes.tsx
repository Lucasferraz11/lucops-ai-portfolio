import { Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { OverviewPage } from './pages/OverviewPage'
import { PreparationPage } from './pages/PreparationPage'
import { QualityPage } from './pages/QualityPage'
import { AnomaliesPage } from './pages/AnomaliesPage'
import { InvestigationsPage } from './pages/InvestigationsPage'
import { ReportsPage } from './pages/ReportsPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="qualidade" element={<QualityPage />} />
        <Route path="anomalias" element={<AnomaliesPage />} />
        <Route path="investigacoes" element={<InvestigationsPage />} />
        <Route path="relatorios" element={<ReportsPage />} />
        <Route
          path="*"
          element={
            <PreparationPage
              title="Página não encontrada"
              description="A rota solicitada não faz parte desta entrega."
              icon="layers"
            />
          }
        />
      </Route>
    </Routes>
  )
}
