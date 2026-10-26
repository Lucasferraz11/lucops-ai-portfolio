import { useEffect, useMemo, useState } from 'react'
import type { AnalysisDetails } from '../services/api'
import { formatCount } from '../utils/quality'

interface QualityIssuesTableProps {
  details?: AnalysisDetails
  totalIssues: number
}

export function QualityIssuesTable({ details, totalIssues }: QualityIssuesTableProps) {
  const [query, setQuery] = useState('')
  const [field, setField] = useState('')
  const [rule, setRule] = useState('')
  useEffect(() => {
    setQuery('')
    setField('')
    setRule('')
  }, [details])

  const fields = useMemo(() => [...new Set(details?.items.map((item) => item.field) ?? [])].sort((a, b) => a.localeCompare(b, 'pt-BR')), [details])
  const rules = useMemo(() => [...new Set(details?.items.map((item) => item.rule) ?? [])].sort((a, b) => a.localeCompare(b, 'pt-BR')), [details])
  const search = query.trim().toLocaleLowerCase('pt-BR')
  const searchedIndex = /^#?\d+$/.test(search) ? Number(search.replace('#', '')) : null
  const filtered = details?.items.map((issue, index) => ({ issue, index })).filter(({ issue }) =>
    (!search || issue.record_index === searchedIndex || issue.description.toLocaleLowerCase('pt-BR').includes(search)) &&
    (!field || issue.field === field) && (!rule || issue.rule === rule),
  ) ?? []
  const hasFilters = Boolean(search || field || rule)
  const clearFilters = () => { setQuery(''); setField(''); setRule('') }

  return (
    <section aria-labelledby="quality-issues-heading">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="quality-issues-heading" className="font-display text-base font-semibold text-ink">Inconsistências por registro</h2>
          <p className="mt-1 text-sm text-muted">Registros numerados a partir de 1, sem incluir o cabeçalho do CSV.</p>
        </div>
        {details && (
          <span className="rounded-md border border-outline/70 bg-panel-raised px-3 py-1.5 font-mono text-xs tabular-nums text-muted">
            {formatCount(filtered.length)} {filtered.length === 1 ? 'resultado do filtro' : 'resultados do filtro'}
          </span>
        )}
      </div>

      {!details ? (
        <div className="rounded-lg border border-dashed border-outline bg-panel-soft/60 px-5 py-10 text-center">
          <p className="font-display text-sm font-semibold text-ink">Detalhes não disponíveis nesta análise</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
            {totalIssues > 0
              ? `O resumo aponta ${formatCount(totalIssues)} inconsistências, mas a API não forneceu a lista por registro. Analise o CSV novamente para solicitar os detalhes.`
              : 'A API não forneceu a lista por registro. O resumo apresenta zero inconsistências, mas a ausência da lista não é uma verificação detalhada.'}
          </p>
        </div>
      ) : details.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-positive/35 bg-positive/5 px-5 py-10 text-center">
          <p className="font-display text-sm font-semibold text-ink">Nenhuma inconsistência identificada</p>
          <p className="mt-2 text-sm text-muted">A análise deste CSV retornou uma lista de detalhes vazia.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 rounded-lg bg-panel-soft p-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,2fr)_minmax(130px,1fr)_minmax(150px,1fr)_auto]">
            <label className="min-w-0 text-xs font-semibold text-muted">Registro ou descrição
              <input aria-label="Pesquisar por registro ou descrição" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Índice ou descrição" className="mt-1.5 min-h-10 w-full rounded-md border border-outline bg-sidebar px-3 text-sm font-normal text-ink placeholder:text-muted/70 focus:border-primary" />
            </label>
            <label className="min-w-0 text-xs font-semibold text-muted">Campo
              <select aria-label="Filtrar por campo" value={field} onChange={(event) => setField(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-md border border-outline bg-sidebar px-3 text-sm font-normal text-ink focus:border-primary">
                <option value="">Todos os campos</option>
                {fields.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-xs font-semibold text-muted">Regra
              <select aria-label="Filtrar por regra" value={rule} onChange={(event) => setRule(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-md border border-outline bg-sidebar px-3 text-sm font-normal text-ink focus:border-primary">
                <option value="">Todas as regras</option>
                {rules.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <button type="button" onClick={clearFilters} disabled={!hasFilters} className="min-h-10 self-end rounded-md border border-outline bg-panel-raised px-3 text-sm font-semibold text-ink hover:border-primary disabled:cursor-not-allowed disabled:opacity-50">Limpar filtros</button>
          </div>
          <p role="status" className="mb-4 text-sm text-muted">
            {formatCount(filtered.length)} {filtered.length === 1 ? 'inconsistência encontrada' : 'inconsistências encontradas'} nos filtros · {formatCount(details.returned_issues)} recebidas da API · {formatCount(details.total_issues)} identificadas no CSV.
            {details.truncated && ' A pesquisa cobre somente as ocorrências recebidas.'}
          </p>
          {details.truncated && (
            <p role="status" className="mb-4 rounded-md border border-primary/35 bg-primary/10 px-4 py-3 text-sm leading-6 text-ink">
              Exibindo {formatCount(details.returned_issues)} de {formatCount(details.total_issues)} inconsistências identificadas. A API limita os detalhes às primeiras {formatCount(details.limit)} ocorrências; os totais acima incluem todo o CSV.
            </p>
          )}
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline bg-panel-soft/60 px-5 py-10 text-center">
              <p className="font-display text-sm font-semibold text-ink">Nenhuma inconsistência encontrada para os filtros selecionados.</p>
              <button type="button" onClick={clearFilters} className="mt-4 min-h-10 rounded-md border border-primary/50 px-4 text-sm font-semibold text-primary hover:bg-primary/10">Limpar filtros</button>
            </div>
          ) : <div role="region" aria-label="Tabela de inconsistências" tabIndex={0} className="overflow-x-auto rounded-lg border border-outline/60">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead className="bg-panel-raised text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="w-36 px-4 py-3">Registro</th>
                  <th scope="col" className="w-44 px-4 py-3">Campo afetado</th>
                  <th scope="col" className="px-4 py-3">Inconsistência</th>
                  <th scope="col" className="w-60 px-4 py-3">Consulta técnica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/40 bg-panel-soft/50">
                {filtered.map(({ issue, index }) => (
                  <tr key={index} className="align-top transition-colors odd:bg-panel/25 hover:bg-panel-raised/70">
                    <th scope="row" className="px-4 py-4 font-mono text-xs font-semibold tabular-nums text-ink">
                      Registro #{formatCount(issue.record_index)}
                    </th>
                    <td className="px-4 py-4">
                      <code className="break-all rounded bg-primary/10 px-2 py-1 font-mono text-xs text-primary">{issue.field}</code>
                    </td>
                    <td className="px-4 py-4 leading-6 text-ink [overflow-wrap:anywhere]">{issue.description}</td>
                    <td className="px-4 py-3">
                      <details className="group">
                        <summary className="flex min-h-10 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-outline bg-panel-raised px-3 py-2 text-xs font-semibold text-primary hover:border-primary hover:bg-panel-raised/80 focus-visible:outline-primary group-open:border-primary/50 group-open:bg-primary/10 [&::-webkit-details-marker]:hidden">
                          <span className="group-open:hidden">Ver regra</span>
                          <span className="hidden group-open:inline">Ocultar regra</span>
                          <span className="sr-only"> da ocorrência {index + 1} do registro {issue.record_index}</span>
                          <span aria-hidden="true" className="text-base leading-none transition-transform group-open:rotate-180">⌄</span>
                        </summary>
                        <div className="mt-2 rounded-md border border-outline/60 bg-sidebar px-3 py-2 text-xs text-muted">
                          <span className="block">Regra violada</span>
                          <code className="mt-1 block max-w-full overflow-x-auto whitespace-nowrap font-mono text-primary">{issue.rule}</code>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
          {!details.truncated && (
            <p className="mt-4 text-xs text-muted">{formatCount(details.returned_issues)} de {formatCount(details.total_issues)} ocorrências recebidas da API.</p>
          )}
        </>
      )}
    </section>
  )
}
