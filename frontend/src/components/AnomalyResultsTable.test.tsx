import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AnomalyResultsTable } from './AnomalyResultsTable'
import type { AnomalyResult } from '../services/api'

const results: AnomalyResult[] = [
  { record_index: 2, transaction_id: 'duplicado', original_value: '1000000.00', anomaly_score: 0.0000000123456789, is_anomaly: true },
  { record_index: 9, transaction_id: 'duplicado', original_value: '10', anomaly_score: -0.1234567890123456, is_anomaly: false },
]

afterEach(cleanup)

describe('tabela de resultados de ML', () => {
  it('preserva índices não contíguos e IDs sem usá-los como identidade', () => {
    render(<AnomalyResultsTable results={results} ineligible={[]} />)
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByRole('rowheader').textContent).toBe('#2')
    expect(within(rows[2]).getByRole('rowheader').textContent).toBe('#9')
    expect(within(rows[1]).getByText('Anômalo')).toBeTruthy()
    expect(within(rows[2]).getByText('Normal')).toBeTruthy()
    expect(screen.getAllByText('duplicado')).toHaveLength(2)
    expect(screen.getByText('1000000.00')).toBeTruthy()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('preserva scores completos, incluindo negativos e muito pequenos, sem percentuais', () => {
    render(<AnomalyResultsTable results={results} ineligible={[]} />)
    for (const record of results) {
      expect(screen.getByTitle(String(record.anomaly_score)).textContent).toBe(String(record.anomaly_score).replace('.', ','))
      expect(screen.getByText(String(record.anomaly_score))).toBeTruthy()
      expect(screen.getByTitle(String(record.anomaly_score)).textContent).not.toContain('%')
    }
    expect(screen.getByText(/não é percentual, probabilidade ou grau de severidade/)).toBeTruthy()
  })

  it('classifica pelo booleano do servidor, sem reclassificar um score arredondado', () => {
    render(<AnomalyResultsTable results={[{ ...results[0], anomaly_score: 0, is_anomaly: false }]} ineligible={[]} />)
    expect(screen.getByText('Normal')).toBeTruthy()
    expect(screen.queryByText('Anômalo')).toBeNull()
  })

  it('separa inelegibilidade e minimiza valores brutos dos motivos', () => {
    render(<AnomalyResultsTable results={[]} ineligible={[{
      record_index: 7, transaction_id: '', original_value: '', issues: [
        { field: 'cliente_id', message: 'Field is required.', value: 'private-client-value', expected: 'present and not empty' },
        { field: 'valor', message: 'Rule failed.', value: '-1', expected: 'rule check passed' },
      ],
    }]} />)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('Registro #7 · Inelegível')).toBeTruthy()
    expect(screen.getByText(/Field is required/)).toBeTruthy()
    expect(screen.queryByText('private-client-value')).toBeNull()
    expect(screen.queryByText('Anômalo')).toBeNull()
    expect(screen.getByText(/Ver motivos de inelegibilidade/).tagName).toBe('SUMMARY')
  })

  it('apresenta texto não confiável sem interpretar HTML e permite consultar dados completos', () => {
    const malicious = '<script>alert("x")</script>'
    const { container } = render(<AnomalyResultsTable results={[{ ...results[0], transaction_id: malicious }]} ineligible={[]} />)
    expect(screen.getByText(malicious)).toBeTruthy()
    expect(container.querySelector('script')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver dados do registro #2' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('region', { name: 'Tabela de registros avaliados' }).getAttribute('tabindex')).toBe('0')
  })

  it('mantém todas as colunas dentro de uma região de rolagem própria e limitada', () => {
    render(<AnomalyResultsTable results={results} ineligible={[]} />)
    const region = screen.getByRole('region', { name: 'Tabela de registros avaliados' })
    const table = within(region).getByRole('table')
    for (const token of ['w-full', 'min-w-0', 'max-w-full', 'overflow-x-auto', 'overscroll-x-contain']) {
      expect(region.classList.contains(token)).toBe(true)
    }
    expect(table.parentElement).toBe(region)
    expect(table.classList.contains('min-w-[760px]')).toBe(true)
    expect(table.classList.contains('table-fixed')).toBe(true)
    expect(table.querySelectorAll('col')).toHaveLength(4)
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent))
      .toEqual(['Registro', 'Classificação', 'Score original', 'Dados técnicos'])
    // JSDOM checks structure only; scrollWidth/gesture behavior need a real browser.
  })

  it('impede quebra e truncamento de scores longos na tabela e nos detalhes', () => {
    render(<AnomalyResultsTable results={results} ineligible={[]} />)
    for (const record of results) {
      const cell = screen.getByTitle(String(record.anomaly_score))
      const fullScore = screen.getByText(String(record.anomaly_score))
      for (const element of [cell, fullScore]) {
        expect(element.classList.contains('whitespace-nowrap')).toBe(true)
        expect(element.classList.contains('break-normal')).toBe(true)
        expect(element.classList.contains('break-all')).toBe(false)
        expect(element.classList.contains('truncate')).toBe(false)
      }
      expect(cell.textContent).toBe(String(record.anomaly_score).replace('.', ','))
      expect(fullScore.textContent).toBe(String(record.anomaly_score))
      expect(fullScore.closest('td')?.getAttribute('colspan')).toBe('4')
    }
    expect(screen.getByRole('rowheader', { name: '#2' }).closest('tr')?.classList.contains('bg-[#93000a]/15')).toBe(true)
    expect(screen.getByRole('rowheader', { name: '#9' }).closest('tr')?.classList.contains('bg-[#93000a]/15')).toBe(false)
  })

  it('expande em uma linha separada sem acrescentar conteúdo à linha principal', () => {
    render(<AnomalyResultsTable results={results} ineligible={[]} />)
    const button = screen.getByRole('button', { name: 'Ver dados do registro #2' })
    const mainRow = button.closest('tr')!
    const detailsRow = document.getElementById(button.getAttribute('aria-controls')!)!
    expect(mainRow.children).toHaveLength(4)
    expect(mainRow.querySelector('dl')).toBeNull()
    expect(detailsRow.tagName).toBe('TR')
    expect(detailsRow.hasAttribute('hidden')).toBe(true)
    expect(mainRow.nextElementSibling).toBe(detailsRow)
    expect(detailsRow.parentElement).toBe(mainRow.parentElement)
    expect(detailsRow.children).toHaveLength(1)
    expect(detailsRow.firstElementChild?.tagName).toBe('TD')
    expect(detailsRow.firstElementChild?.getAttribute('colspan')).toBe('4')

    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(detailsRow.hasAttribute('hidden')).toBe(false)
    expect(screen.getByRole('region', { name: 'Dados técnicos do registro #2' })).toBeTruthy()
    expect(mainRow.querySelector('dl')).toBeNull()
    expect(detailsRow.classList.contains('bg-[#93000a]/15')).toBe(true)
    expect(screen.getByRole('table').querySelectorAll('tbody > :not(tr)')).toHaveLength(0)
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(detailsRow.hasAttribute('hidden')).toBe(true)
    expect(screen.queryByRole('region', { name: 'Dados técnicos do registro #2' })).toBeNull()
  })

  it('utiliza controles nativos focáveis e mantém expansões independentes por índice', () => {
    render(<AnomalyResultsTable results={results} ineligible={[]} />)
    const first = screen.getByRole('button', { name: 'Ver dados do registro #2' })
    const second = screen.getByRole('button', { name: 'Ver dados do registro #9' })
    expect(first.getAttribute('type')).toBe('button')
    expect(first.getAttribute('aria-controls')).not.toBe(second.getAttribute('aria-controls'))
    first.focus()
    expect(document.activeElement).toBe(first)
    fireEvent.click(first)
    expect(document.activeElement).toBe(first)
    expect(first.getAttribute('aria-expanded')).toBe('true')
    expect(second.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(second)
    fireEvent.click(first)
    expect(screen.queryByRole('region', { name: 'Dados técnicos do registro #2' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Dados técnicos do registro #9' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'Dados técnicos do registro #9' })).getByText('-0.1234567890123456')).toBeTruthy()
  })
})
