import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../routes'
import { AnalysisProvider } from '../state/AnalysisContext'

const invalidResult = {
  quality_status: 'COM INCONSISTÊNCIAS',
  summary: { total_records: 1200, valid_records: 900, invalid_records: 300, total_issues: 450, valid_percentage: 75 },
}

const detailedResult = {
  quality_status: 'COM INCONSISTÊNCIAS',
  summary: { total_records: 3, valid_records: 1, invalid_records: 2, total_issues: 4, valid_percentage: 33.33 },
  details: {
    items: [
      { record_index: 2, field: 'cliente_id', rule: 'campo obrigatório', description: 'Campo obrigatório ausente.', raw_value: 'SECRET-CLIENTE' },
      { record_index: 2, field: 'valor', rule: 'is_positive_amount', description: 'Valor não atende à regra de validação.' },
      { record_index: 2, field: 'id_transacao', rule: 'valor único', description: 'Identificador duplicado no CSV.' },
      { record_index: 3, field: 'id_transacao', rule: 'campo obrigatório', description: 'Campo obrigatório ausente.' },
    ],
    returned_issues: 4,
    total_issues: 4,
    limit: 200,
    truncated: false,
    record_index_base: 1,
  },
}

function mount(path = '/', analysisFetch?: (url: string, options?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) =>
    url === '/health'
      ? Promise.resolve(new Response(JSON.stringify({ status: 'ok', service: 'LucOps AI' }), { status: 200 }))
      : analysisFetch ? analysisFetch(url, options) : Promise.reject(new Error('Análise não esperada')),
  ))
  return render(<MemoryRouter initialEntries={[path]}><AnalysisProvider><AppRoutes /></AnalysisProvider></MemoryRouter>)
}

function selectFile(name: string) {
  fireEvent.change(screen.getByLabelText('Arquivo CSV'), { target: { files: [new File(['csv'], name, { type: 'text/csv' })] } })
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Qualidade dos Dados', () => {
  it('mostra estado vazio e caminho para analisar um CSV', () => {
    mount('/qualidade')
    expect(screen.getByText('Nenhuma análise de qualidade disponível')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir para Visão Geral' }).getAttribute('href')).toBe('/')
    expect(screen.queryByText('REG-001')).toBeNull()
  })

  it('exibe os agregados reais e o gráfico após navegar da Visão Geral', async () => {
    mount('/', async () => new Response(JSON.stringify(invalidResult), { status: 200 }))
    selectFile('transacoes.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('link', { name: 'Ver qualidade do lote →' }))
    expect(screen.getByRole('heading', { name: 'Qualidade dos Dados' })).toBeTruthy()
    expect(screen.getAllByText('transacoes.csv').length).toBeGreaterThan(0)
    expect(screen.getByText('COM INCONSISTÊNCIAS')).toBeTruthy()
    expect(screen.getByLabelText('Percentual geral de qualidade: 75,00%')).toBeTruthy()
    expect(screen.getByLabelText('Registros válidos: 900')).toBeTruthy()
    expect(screen.getByLabelText('Registros inválidos: 300')).toBeTruthy()
    expect(screen.getByLabelText('Total de inconsistências: 450')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Distribuição do lote: 900 válidos e 300 inválidos' })).toBeTruthy()
    expect(screen.getAllByText('De 1.200 registros analisados')).toHaveLength(2)
    expect(screen.getByText('Detalhes não disponíveis nesta análise')).toBeTruthy()
    expect(screen.getByText(/O resumo aponta 450 inconsistências/)).toBeTruthy()
    expect(screen.getByLabelText('Registros válidos no lote').getAttribute('aria-valuenow')).toBe('75')
  })

  it('trata lote sem registros sem apresentar percentual inventado', async () => {
    const empty = { quality_status: 'SEM DADOS', summary: { total_records: 0, valid_records: 0, invalid_records: 0, total_issues: 0, valid_percentage: null } }
    mount('/', async () => new Response(JSON.stringify(empty), { status: 200 }))
    selectFile('vazio.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('link', { name: 'Ver qualidade do lote →' }))
    expect(screen.getByText('SEM DADOS')).toBeTruthy()
    expect(screen.getByLabelText('Percentual geral de qualidade: —')).toBeTruthy()
    expect(screen.getByText('O CSV analisado não contém registros para distribuir.')).toBeTruthy()
  })

  it('mostra ocorrências reais na ordem da API e múltiplos problemas no mesmo registro', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(detailedResult), { status: 200 }))
    mount('/', fetchMock)
    selectFile('transacoes_invalidas.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('link', { name: 'Ver qualidade do lote →' }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Total de inconsistências: 4')).toBeTruthy()
    expect(screen.getByLabelText('Registros inválidos: 2')).toBeTruthy()
    const rows = screen.getByRole('table').querySelectorAll('tbody tr')
    expect(rows).toHaveLength(4)
    expect(Array.from(rows, (row) => row.querySelector('th')?.textContent)).toEqual([
      'Registro #2', 'Registro #2', 'Registro #2', 'Registro #3',
    ])
    expect(rows[1].textContent).toContain('Valor não atende à regra de validação.')
    expect(screen.getByRole('region', { name: 'Tabela de inconsistências' }).getAttribute('tabindex')).toBe('0')
    expect(document.body.textContent).not.toContain('SECRET-CLIENTE')
  })

  it('usa o índice 1 do primeiro registro de dados, sem substituí-lo pela posição visual', async () => {
    const firstRecord = {
      quality_status: 'COM INCONSISTÊNCIAS',
      summary: { total_records: 1, valid_records: 0, invalid_records: 1, total_issues: 1, valid_percentage: 0 },
      details: {
        items: [{ record_index: 1, field: 'valor', rule: 'is_positive_amount', description: 'Valor não atende à regra de validação.' }],
        returned_issues: 1, total_issues: 1, limit: 200, truncated: false, record_index_base: 1,
      },
    }
    mount('/', async () => new Response(JSON.stringify(firstRecord), { status: 200 }))
    selectFile('primeiro-registro.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))

    expect(screen.getByRole('rowheader', { name: 'Registro #1' })).toBeTruthy()
    expect(screen.queryByText('Registro #0')).toBeNull()
  })

  it('abre e fecha a regra técnica sem alterar o identificador rastreável', async () => {
    mount('/', async () => new Response(JSON.stringify(detailedResult), { status: 200 }))
    selectFile('lote.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))

    // The first occurrence is a required field; inspect the amount rule in the second row.
    const amountControl = screen.getAllByText('Ver regra', { selector: 'span' })[1].closest('summary')!
    const disclosure = amountControl.closest('details')!
    expect(disclosure.open).toBe(false)
    fireEvent.click(amountControl)
    expect(disclosure.open).toBe(true)
    expect(disclosure.textContent).toContain('is_positive_amount')
    fireEvent.click(amountControl)
    expect(disclosure.open).toBe(false)
  })

  it('diferencia uma lista vazia de detalhes ausentes', async () => {
    const clean = {
      quality_status: 'SEM INCONSISTÊNCIAS',
      summary: { total_records: 1, valid_records: 1, invalid_records: 0, total_issues: 0, valid_percentage: 100 },
      details: { items: [], returned_issues: 0, total_issues: 0, limit: 200, truncated: false, record_index_base: 1 },
    }
    mount('/', async () => new Response(JSON.stringify(clean), { status: 200 }))
    selectFile('valido.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))

    expect(screen.getByText('Nenhuma inconsistência identificada')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText('Detalhes não disponíveis nesta análise')).toBeNull()
  })

  it('informa o total real quando os detalhes vêm truncados', async () => {
    const items = Array.from({ length: 200 }, (_, index) => ({
      record_index: index + 1, field: 'valor', rule: 'is_positive_amount', description: 'Valor não atende à regra de validação.',
    }))
    const truncated = {
      quality_status: 'COM INCONSISTÊNCIAS',
      summary: { total_records: 350, valid_records: 0, invalid_records: 350, total_issues: 350, valid_percentage: 0 },
      details: { items, returned_issues: 200, total_issues: 350, limit: 200, truncated: true, record_index_base: 1 },
    }
    mount('/', async () => new Response(JSON.stringify(truncated), { status: 200 }))
    selectFile('grande.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))

    expect(screen.getByText(/Exibindo 200 de 350 inconsistências identificadas/)).toBeTruthy()
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(200)
    expect(screen.getByLabelText('Total de inconsistências: 350')).toBeTruthy()
    expect(document.body.textContent).not.toContain('200 de 200')
  })

  it('limpa a qualidade do arquivo anterior quando outro CSV é selecionado', async () => {
    mount('/', async () => new Response(JSON.stringify(invalidResult), { status: 200 }))
    selectFile('primeiro.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))
    expect(screen.getAllByText('primeiro.csv').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('link', { name: 'Ir para Visão Geral' }))
    selectFile('segundo.csv')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))
    expect(screen.getByText('Nenhuma análise de qualidade disponível')).toBeTruthy()
    expect(screen.queryByLabelText('Registros válidos: 900')).toBeNull()
    expect(screen.queryByText('primeiro.csv')).toBeNull()
  })

  it('remove a tabela antiga ao substituir o CSV', async () => {
    mount('/', async () => new Response(JSON.stringify(detailedResult), { status: 200 }))
    selectFile('primeiro.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))
    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(4)

    fireEvent.click(screen.getByRole('link', { name: 'Ir para Visão Geral' }))
    selectFile('segundo.csv')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText('Registro #2')).toBeNull()
    expect(screen.getByText('Nenhuma análise de qualidade disponível')).toBeTruthy()
  })

  it('preserva a última análise confirmada após falha de reanálise', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(invalidResult), { status: 200 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mount('/', fetch)
    selectFile('lote.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))
    expect(screen.getByLabelText('Registros válidos: 900')).toBeTruthy()
    expect(screen.getByText('A última atualização falhou. Os indicadores abaixo pertencem à última análise concluída deste arquivo.')).toBeTruthy()
  })

  it('preserva os detalhes confirmados quando a reanálise do mesmo CSV falha', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(detailedResult), { status: 200 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mount('/', fetch)
    selectFile('lote.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))

    expect(screen.getByRole('table').querySelectorAll('tbody tr')).toHaveLength(4)
    expect(screen.getByLabelText('Total de inconsistências: 4')).toBeTruthy()
    expect(screen.getByText('A última atualização falhou. Os indicadores abaixo pertencem à última análise concluída deste arquivo.')).toBeTruthy()
  })

  it('não apresenta categorias, regras ou severidades inexistentes no contrato', async () => {
    mount('/', async () => new Response(JSON.stringify(invalidResult), { status: 200 }))
    selectFile('lote.csv')
    fireEvent.click(screen.getByRole('button', { name: 'Analisar qualidade' }))
    await screen.findByRole('status')
    fireEvent.click(screen.getByRole('link', { name: 'Qualidade dos Dados' }))
    const content = document.body.textContent ?? ''
    for (const invented of ['REG-001', 'CPF/CNPJ', 'CRÍTICA', '18 ativas', 'Impacto Financeiro', 'Causa Raiz']) {
      expect(content).not.toContain(invented)
    }
  })
})
