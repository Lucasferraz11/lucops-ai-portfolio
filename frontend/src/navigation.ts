import type { IconName } from './components/Icon'

export const navigation: ReadonlyArray<{
  path: string
  label: string
  icon: IconName
}> = [
  { path: '/', label: 'Visão Geral', icon: 'overview' },
  { path: '/qualidade', label: 'Qualidade dos Dados', icon: 'quality' },
  { path: '/anomalias', label: 'Detecção de Anomalias', icon: 'anomalies' },
  { path: '/investigacoes', label: 'Investigações com IA', icon: 'investigations' },
  { path: '/relatorios', label: 'Relatórios', icon: 'reports' },
]
