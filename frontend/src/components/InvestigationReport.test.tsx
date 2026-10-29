import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { InvestigationReport } from './InvestigationReport'
import { investigationFixture } from '../test/investigationFixture'

afterEach(cleanup)

describe('apresentação da investigação', () => {
  it('separa fatos, hipóteses não confirmadas, recomendações e limitações', () => {
    const result = investigationFixture()
    render(<InvestigationReport result={result} previous={false} />)
    expect(screen.getByText('Resumo dos fatos verificados')).toBeTruthy()
    expect(screen.getByText('Hipóteses não confirmadas')).toBeTruthy()
    expect(screen.getByText('Não confirmada')).toBeTruthy()
    expect(screen.getByText(result.hypotheses[0].description)).toBeTruthy()
    expect(screen.getByText(result.recommendations[0].action)).toBeTruthy()
    expect(screen.getByText(result.insufficient_evidence[0])).toBeTruthy()
    expect(screen.getAllByText('E2').length).toBeGreaterThan(0)
  })

  it('preserva referências completas, origens e JSON consultáveis', () => {
    const result = investigationFixture()
    render(<InvestigationReport result={result} previous={true} />)
    expect(screen.getByText('Última investigação concluída deste registro')).toBeTruthy()
    const summary = screen.getByText('Ver detalhes técnicos')
    expect(summary.tagName).toBe('SUMMARY')
    const details = summary.closest('details')!
    expect(within(details).getByText(result.verified_evidence[1].evidence_id)).toBeTruthy()
    expect(details.textContent).toContain('lucops.pipeline.run_pipeline')
    expect(within(details).getByText('JSON completo retornado pelo servidor').nextElementSibling?.textContent).toBe(JSON.stringify(result, null, 2))
  })

  it('não descreve valor visível como ocultado e mantém a ocultação do servidor', () => {
    const result = investigationFixture()
    const view = render(<InvestigationReport result={result} previous={false} />)
    expect(screen.getByText('Valor informado no registro do CSV.')).toBeTruthy()
    expect(screen.queryByText('Valor ocultado pelo servidor por proteção de dados.')).toBeNull()
    result.context.transaction.original_value = '[redacted]'
    result.verified_evidence[0].value = '[redacted]'
    view.rerender(<InvestigationReport result={result} previous={false} />)
    expect(screen.getByLabelText('Valor informado: Ocultado pelo servidor')).toBeTruthy()
    expect(screen.getByText('Valor ocultado pelo servidor por proteção de dados.')).toBeTruthy()
    result.context.transaction.original_value = ''
    result.verified_evidence[0].value = ''
    view.rerender(<InvestigationReport result={result} previous={false} />)
    expect(screen.getByLabelText('Valor informado: Não informado')).toBeTruthy()
    expect(screen.getByText('Valor não informado no registro do CSV.')).toBeTruthy()
  })

  it('não confunde ML indisponível com ausência de alerta', () => {
    const result = investigationFixture(1, 'unavailable')
    render(<InvestigationReport result={result} previous={false} />)
    expect(screen.getByLabelText('Situação do ML: Indisponível')).toBeTruthy()
    expect(screen.getByText(/isso não demonstra ausência de anomalias/)).toBeTruthy()
    expect(screen.queryByLabelText('Situação do ML: Sem alerta estatístico')).toBeNull()
  })

  it('preserva texto malicioso como texto, sem interpretar HTML', () => {
    const result = investigationFixture()
    const injection = '<img src=x onerror=alert(1)>'
    result.hypotheses[0].description = injection
    const { container } = render(<InvestigationReport result={result} previous={false} />)
    expect(screen.getByText(injection)).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
  })

  it('apresenta alerta estatístico e preserva o score sem probabilidade ou severidade', () => {
    const result = investigationFixture(5, 'evaluated')
    render(<InvestigationReport result={result} previous={false} />)
    expect(screen.getByLabelText('Registro investigado: #5')).toBeTruthy()
    expect(screen.getByLabelText('Situação do ML: Alerta estatístico')).toBeTruthy()
    expect(screen.getByText(/O ML sinalizou um alerta estatístico que requer revisão contextual/)).toBeTruthy()
    expect(screen.getByText('Informações de ML e limitações completas').parentElement?.textContent).toContain('0.12')
    expect(screen.queryByText('12%')).toBeNull()
  })

  it('mostra evidência de duplicidade mesmo sem inconsistência na primeira ocorrência', () => {
    const result = investigationFixture(1, 'unavailable')
    result.verified_evidence.push({
      evidence_id: `${result.context.transaction.reference}:tool:find_duplicates:peer:2`, kind: 'quality',
      source: { dataset_id: result.context.dataset_id, record_index: 2, function: 'lucops.agents.tools.find_duplicates', field: 'id_transacao' },
      description: 'Este registro do CSV atual compartilha o ID selecionado.', value: '2', expected: 'unique value',
    })
    render(<InvestigationReport result={result} previous={false} />)
    expect(screen.getByText(/outro registro com o mesmo identificador no CSV/)).toBeTruthy()
    expect(screen.getByText('Este registro do CSV atual compartilha o ID selecionado.')).toBeTruthy()
  })
})

function reportWithTwentyEvidenceItems() {
  const result = investigationFixture()
  for (let index = 5; index <= 20; index++) {
    result.verified_evidence.push({
      ...result.verified_evidence[0],
      evidence_id: `${result.context.transaction.reference}:e${index}`,
      description: `Estat?stica sintética verificável ${index}.`,
      value: index === 20 ? '[redacted]' : index,
      source: {
        ...result.verified_evidence[0].source,
        record_index: null,
        function: 'lucops.agents.tools.summarize_batch',
        field: `statistic_${index}`,
      },
    })
  }
  return result
}

describe('refinamento da apresentação das evidências', () => {
  it('expande de cinco para vinte evidências e recolhe com referências estáveis e controle acessível', () => {
    const result = reportWithTwentyEvidenceItems()
    result.hypotheses[0].evidence_ids = result.verified_evidence.slice(1, 4).map((item) => item.evidence_id)
    const original = JSON.stringify(result)
    render(<InvestigationReport result={result} previous={false} />)
    const list = screen.getByRole('list', { name: 'Evidências verificadas' })
    const button = screen.getByRole('button', { name: 'Ver todas as evidências' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-controls')).toBe(list.id)
    expect(button.getAttribute('type')).toBe('button')
    button.focus()
    expect(document.activeElement).toBe(button)
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: 'Mostrar menos' })).toBe(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(button)
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(20)
    for (const label of ['E2', 'E3', 'E4']) {
      expect(items[Number(label.slice(1)) - 1].textContent).toContain(`${label} ·`)
      expect(screen.getAllByTitle(result.verified_evidence[Number(label.slice(1)) - 1].evidence_id).length).toBeGreaterThan(0)
    }
    expect(items[19].textContent).toContain('Estat?stica sintética verificável 20.')
    expect(items[19].textContent).toContain('Ocultado pelo servidor')
    fireEvent.click(button)
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.textContent).toBe('Ver todas as evidências')
    expect(JSON.stringify(result)).toBe(original)
    const details = screen.getByText('Ver detalhes técnicos').closest('details')!
    expect(within(details).getByText('JSON completo retornado pelo servidor').nextElementSibling?.textContent).toBe(JSON.stringify(result, null, 2))
  })

  it.each([0, 1, 4, 5])('apresenta todas as %i evidências sem oferecer expansão desnecessária', (count) => {
    const result = reportWithTwentyEvidenceItems()
    result.verified_evidence = result.verified_evidence.slice(0, count)
    result.hypotheses = []
    result.recommendations = []
    render(<InvestigationReport result={result} previous={false} />)
    const list = screen.getByRole('list', { name: 'Evidências verificadas' })
    expect(within(list).queryAllByRole('listitem')).toHaveLength(count)
    expect(screen.queryByRole('button', { name: 'Ver todas as evidências' })).toBeNull()
    expect(screen.getByText(new RegExp(`Exibindo ${count} de ${count} evidências`))).toBeTruthy()
    if (count === 0) expect(screen.getByText('Nenhuma evidência verificada foi retornada pelo servidor.')).toBeTruthy()
  })

  it('retorna ao resumo ao receber uma nova investigação, sem preservar expansão anterior', () => {
    const view = render(<InvestigationReport result={reportWithTwentyEvidenceItems()} previous={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas as evidências' }))
    const next = reportWithTwentyEvidenceItems()
    next.context.record_index = 2
    view.rerender(<InvestigationReport result={next} previous={false} />)
    expect(within(screen.getByRole('list', { name: 'Evidências verificadas' })).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Ver todas as evidências' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('traduz somente os rótulos visuais e preserva a contagem e os identificadores técnicos', () => {
    const result = investigationFixture()
    render(<InvestigationReport result={result} previous={false} />)
    expect(screen.getByLabelText('Inconsistências de qualidade: 1')).toBeTruthy()
    expect(screen.queryByText('Qualidade do registro')).toBeNull()
    expect(screen.getByText('Modo simulado')).toBeTruthy()
    expect(screen.queryByText('Modo simulated')).toBeNull()
    const details = screen.getByText('Ver detalhes técnicos').closest('details')!
    expect(within(details).getByText('deterministic-rules-v1 · simulated')).toBeTruthy()
    expect(within(details).getByText('JSON completo retornado pelo servidor').nextElementSibling?.textContent).toContain('"mode": "simulated"')
    expect(screen.getAllByText('Execução simulada: respostas determinísticas; nenhum LLM foi chamado.').length).toBeGreaterThan(0)
  })
})
