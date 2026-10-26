import type { QualitySummary } from '../services/api'

const number = new Intl.NumberFormat('pt-BR')
const percent = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatCount(value: number): string {
  return number.format(value)
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${percent.format(value)}%`
}

export function shareOfBatch(count: number, total: number): number {
  return total > 0 ? count / total * 100 : 0
}

export function qualityDisplay(summary: QualitySummary) {
  return {
    total: formatCount(summary.total_records),
    valid: formatCount(summary.valid_records),
    invalid: formatCount(summary.invalid_records),
    issues: formatCount(summary.total_issues),
    percent: formatPercent(summary.valid_percentage),
  }
}
