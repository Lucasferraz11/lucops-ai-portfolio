import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { AppRoutes } from './routes'
import { AnalysisProvider } from './state/AnalysisContext'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AnalysisProvider>
        <AppRoutes />
      </AnalysisProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
