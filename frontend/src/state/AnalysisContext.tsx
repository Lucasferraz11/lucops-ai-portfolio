import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, createAnalysis, createAnomalyAnalysis, getHealth, type AnalysisResponse, type AnomalyAnalysisResponse } from '../services/api'

export type ApiStatus = 'checking' | 'connected' | 'unavailable'

interface AnomalyState {
  status: 'not-analyzed' | 'loading' | 'success' | 'error' | 'unavailable'
  result: AnomalyAnalysisResponse | null
  error: string | null
}

const initialAnomalyState: AnomalyState = { status: 'not-analyzed', result: null, error: null }

interface AnalysisContextValue {
  selectedFile: File | null
  analysis: AnalysisResponse | null
  isAnalyzing: boolean
  error: string | null
  apiStatus: ApiStatus
  selectFile: (file: File | null) => void
  analyze: () => Promise<void>
  anomaly: AnomalyState
  analyzeAnomalies: () => Promise<void>
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')
  const request = useRef<AbortController | null>(null)
  const healthRequest = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const [anomaly, setAnomaly] = useState<AnomalyState>(initialAnomalyState)
  const anomalyRequest = useRef<AbortController | null>(null)

  useEffect(() => () => {
    request.current?.abort()
    request.current = null
    busy.current = false
    anomalyRequest.current?.abort()
    anomalyRequest.current = null
  }, [])

  const refreshApiStatus = useCallback(async (force = false) => {
    if (healthRequest.current) {
      if (!force) return
      healthRequest.current.abort()
      healthRequest.current = null
    }
    const controller = new AbortController()
    healthRequest.current = controller
    setApiStatus('checking')
    try {
      await getHealth(controller.signal)
      if (healthRequest.current === controller) setApiStatus('connected')
    } catch {
      if (healthRequest.current === controller) setApiStatus('unavailable')
    } finally {
      if (healthRequest.current === controller) healthRequest.current = null
    }
  }, [])

  useEffect(() => {
    void refreshApiStatus()
    const interval = setInterval(() => void refreshApiStatus(), 30_000)
    return () => {
      clearInterval(interval)
      healthRequest.current?.abort()
      healthRequest.current = null
    }
  }, [refreshApiStatus])

  const selectFile = useCallback((file: File | null) => {
    anomalyRequest.current?.abort()
    anomalyRequest.current = null
    setAnomaly(initialAnomalyState)
    request.current?.abort()
    request.current = null
    busy.current = false
    setIsAnalyzing(false)
    setAnalysis(null)
    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      setSelectedFile(null)
      setError('Selecione um arquivo com extensão .csv.')
      return
    }
    setSelectedFile(file)
    setError(null)
  }, [])

  const analyze = useCallback(async () => {
    if (!selectedFile || busy.current) return
    const controller = new AbortController()
    request.current = controller
    busy.current = true
    setIsAnalyzing(true)
    setError(null)
    try {
      const result = await createAnalysis(selectedFile, controller.signal)
      if (request.current === controller) setAnalysis(result)
    } catch (cause) {
      if (request.current === controller) {
        setError(cause instanceof ApiError ? cause.message : 'Não foi possível concluir a análise.')
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        busy.current = false
        setIsAnalyzing(false)
        void refreshApiStatus(true)
      }
    }
  }, [selectedFile, refreshApiStatus])

  const analyzeAnomalies = useCallback(async () => {
    if (!selectedFile || anomalyRequest.current) return
    const controller = new AbortController()
    anomalyRequest.current = controller
    setAnomaly((previous) => ({ ...previous, status: 'loading', error: null }))
    try {
      const result = await createAnomalyAnalysis(selectedFile, controller.signal)
      if (anomalyRequest.current === controller) setAnomaly({ status: 'success', result, error: null })
    } catch (cause) {
      if (anomalyRequest.current === controller) {
        setAnomaly((previous) => ({
          ...previous,
          status: cause instanceof ApiError && cause.status === 503 ? 'unavailable' : 'error',
          error: cause instanceof ApiError ? cause.message : 'Não foi possível concluir a análise de anomalias.',
        }))
      }
    } finally {
      if (anomalyRequest.current === controller) {
        anomalyRequest.current = null
        void refreshApiStatus(true)
      }
    }
  }, [selectedFile, refreshApiStatus])

  return (
    <AnalysisContext.Provider value={{ selectedFile, analysis, isAnalyzing, error, apiStatus, selectFile, analyze, anomaly, analyzeAnomalies }}>
      {children}
    </AnalysisContext.Provider>
  )
}

export function useAnalysis() {
  const context = useContext(AnalysisContext)
  if (!context) throw new Error('useAnalysis deve ser usado dentro de AnalysisProvider.')
  return context
}
