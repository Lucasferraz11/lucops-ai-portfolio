import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { AnalysisDetails } from '../services/api'
import { QualityIssuesTable } from './QualityIssuesTable'

const details: AnalysisDetails = {
  items: [
    { record_index: 1, field: 'valor', rule: 'is_positive_amount', description: 'Valor não atende à regra de validação.' },
    { record_index: 2, field: 'cliente_id', rule: 'campo obrigatório', description: 'Campo obrigatório ausente.' },
    { record_index: 2, field: 'valor', rule: 'is_positive_amount', description: 'Valor não atende à regra de validação.' },
    { record_index: 3, field: 'id_transacao', rule: 'valor único', description: 'Identificador duplicado no CSV.' },
  ],
  returned_issues: 4, total_issues: 4, limit: 200, truncated: false, record_index_base: 1,
}

function rows() {
  return screen.getByRole('table').querySelectorAll('tbody tr')
}

afterEach(cleanup)

describe('filtros das inconsistências recebidas', () => {
  it('pesquisa pelo índice original, incluindo várias ocorrências do mesmo registro', () => {
    render(<QualityIssuesTable details={details} totalIssues={4} />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar por registro ou descrição' }), { target: { value: '#2' } })
    expect(rows()).toHaveLength(2)
    expect(Array.from(rows(), (row) => row.querySelector('th')?.textContent)).toEqual(['Registro #2', 'Registro #2'])
    expect(screen.getByText(/2 inconsistências encontradas nos filtros/)).toBeTruthy()
  })

  it('pesquisa a descrição e combina campo e regra com opções vindas da API', () => {
    render(<QualityIssuesTable details={details} totalIssues={4} />)
    expect(Array.from((screen.getByRole('combobox', { name: 'Filtrar por campo' }) as HTMLSelectElement).options, (option) => option.value)).toEqual(['', 'cliente_id', 'id_transacao', 'valor'])
    expect(Array.from((screen.getByRole('combobox', { name: 'Filtrar por regra' }) as HTMLSelectElement).options, (option) => option.value)).toContain('is_positive_amount')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar por registro ou descrição' }), { target: { value: 'vAlOr Não atende' } })
    expect(rows()).toHaveLength(2)
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por campo' }), { target: { value: 'valor' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por regra' }), { target: { value: 'is_positive_amount' } })
    expect(rows()).toHaveLength(2)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar por registro ou descrição' }), { target: { value: '2' } })
    expect(rows()).toHaveLength(1)
    expect(rows()[0].querySelector('th')?.textContent).toBe('Registro #2')
  })

  it('mostra estado sem resultados e permite limpar todos os filtros', () => {
    render(<QualityIssuesTable details={details} totalIssues={4} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por campo' }), { target: { value: 'cliente_id' } })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar por registro ou descrição' }), { target: { value: '999' } })
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('Nenhuma inconsistência encontrada para os filtros selecionados.')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Limpar filtros' })[1])
    expect(rows()).toHaveLength(4)
    expect((screen.getByRole('combobox', { name: 'Filtrar por campo' }) as HTMLSelectElement).value).toBe('')
    expect((screen.getByRole('searchbox', { name: 'Pesquisar por registro ou descrição' }) as HTMLInputElement).value).toBe('')
  })

  it('limpa filtros quando chegam detalhes de outra análise, sem alterar os agregados', () => {
    const view = render(<QualityIssuesTable details={details} totalIssues={4} />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar por registro ou descrição' }), { target: { value: '2' } })
    const next: AnalysisDetails = { ...details, items: [details.items[3]], returned_issues: 1, total_issues: 1 }
    view.rerender(<QualityIssuesTable details={next} totalIssues={1} />)
    expect((screen.getByRole('searchbox', { name: 'Pesquisar por registro ou descrição' }) as HTMLInputElement).value).toBe('')
    expect(rows()).toHaveLength(1)
    expect(rows()[0].querySelector('th')?.textContent).toBe('Registro #3')
  })

  it('preserva aviso de truncamento e código técnico legível ao filtrar', () => {
    const truncated: AnalysisDetails = { ...details, total_issues: 350, truncated: true }
    render(<QualityIssuesTable details={truncated} totalIssues={350} />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Pesquisar por registro ou descrição' }), { target: { value: '1' } })
    expect(rows()).toHaveLength(1)
    expect(screen.getByText(/1 inconsistência encontrada nos filtros · 4 recebidas da API · 350 identificadas no CSV/)).toBeTruthy()
    expect(screen.getByText(/A pesquisa cobre somente as ocorrências recebidas/)).toBeTruthy()
    expect(screen.getByText(/Exibindo 4 de 350 inconsistências identificadas/)).toBeTruthy()
    const disclosure = screen.getByText('Ver regra', { selector: 'span' }).closest('details')!
    fireEvent.click(disclosure.querySelector('summary')!)
    const code = disclosure.querySelector('code')!
    expect(disclosure.open).toBe(true)
    expect(code.textContent).toBe('is_positive_amount')
    expect(code.className).toContain('whitespace-nowrap')
    fireEvent.click(disclosure.querySelector('summary')!)
    expect(disclosure.open).toBe(false)
  })

  it('separa detalhes ausentes de lista vazia sem expor valores extras', () => {
    const view = render(<QualityIssuesTable totalIssues={4} />)
    expect(screen.getByText('Detalhes não disponíveis nesta análise')).toBeTruthy()
    expect(screen.queryByRole('searchbox')).toBeNull()
    view.rerender(<QualityIssuesTable details={{ ...details, items: [], returned_issues: 0, total_issues: 0 }} totalIssues={0} />)
    expect(screen.getByText('Nenhuma inconsistência identificada')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
