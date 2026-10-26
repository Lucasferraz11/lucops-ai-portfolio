import { Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell'
import { OverviewPage } from './pages/OverviewPage'
import { PreparationPage } from './pages/PreparationPage'
import { QualityPage } from './pages/QualityPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<OverviewPage />} />
        <Route path="qualidade" element={<QualityPage />} />
        <Route
          path="anomalias"
          element={
            <PreparationPage
              title="Detecção de Anomalias"
              description="Alertas estatísticos e registros avaliados serão exibidos aqui."
              icon="anomalies"
            />
          }
        />
        <Route
          path="investigacoes"
          element={
            <PreparationPage
              title="Investigações com IA"
              description="Evidências, hipóteses e recomendações serão exibidas após a integração."
              icon="investigations"
            />
          }
        />
        <Route
          path="relatorios"
          element={
            <PreparationPage
              title="Relatórios"
              description="Os resultados disponíveis para relatório aparecerão aqui."
              icon="reports"
            />
          }
        />
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
