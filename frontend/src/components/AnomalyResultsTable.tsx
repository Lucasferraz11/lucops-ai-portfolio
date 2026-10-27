import { useId, useState } from 'react'
import type { AnomalyResult, IneligibleTransaction } from '../services/api'
import { formatCount } from '../utils/quality'

function AnomalyTableRow({ record }: { record: AnomalyResult }) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const highlight = record.is_anomaly ? 'bg-[#93000a]/15' : ''
  return (
    <>
      <tr className={`border-t border-outline/40 align-middle ${highlight}`}>
        <th scope="row" className="px-4 py-3 font-mono font-medium text-ink">#{record.record_index}</th>
        <td className="px-4 py-3"><span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold ${record.is_anomaly ? 'border-[#ffb4ab]/35 bg-[#ffb4ab]/10 text-[#ffb4ab]' : 'border-primary/25 bg-primary/10 text-primary'}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${record.is_anomaly ? 'bg-[#ffb4ab]' : 'bg-primary'}`} />{record.is_anomaly ? 'Anômalo' : 'Normal'}
        </span></td>
        <td className="whitespace-nowrap break-normal px-4 py-3 font-mono tabular-nums text-ink" title={String(record.anomaly_score)}>{String(record.anomaly_score).replace('.', ',')}</td>
        <td className="px-4 py-3">
          <button type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded((open) => !open)}
            className="min-h-10 rounded-md border border-outline px-3 py-2 text-left text-xs font-semibold text-primary transition-colors hover:bg-panel-raised">
            {expanded ? 'Ocultar' : 'Ver'} dados do registro #{record.record_index}
          </button>
        </td>
      </tr>
      <tr id={detailsId} hidden={!expanded} className={`border-t border-outline/40 ${highlight}`}>
        <td colSpan={4} className="p-4">
          <div role="region" aria-label={`Dados técnicos do registro #${record.record_index}`} className="rounded-md border border-outline/60 bg-panel-soft p-4">
            <h3 className="mb-3 text-xs font-semibold text-muted">Dados retornados pelo servidor · registro #{record.record_index}</h3>
            <dl className="grid grid-cols-3 gap-5 text-xs leading-6 text-muted">
              <div className="min-w-0"><dt className="font-semibold">ID da transação</dt><dd className="whitespace-pre-wrap break-all font-mono text-ink">{record.transaction_id || 'Não informado'}</dd></div>
              <div className="min-w-0"><dt className="font-semibold">Valor original (texto do CSV)</dt><dd className="whitespace-pre-wrap break-all font-mono text-ink">{record.original_value || 'Não informado'}</dd></div>
              <div className="min-w-0"><dt className="font-semibold">Score completo retornado</dt><dd className="whitespace-nowrap break-normal font-mono text-ink">{String(record.anomaly_score)}</dd></div>
            </dl>
          </div>
        </td>
      </tr>
    </>
  )
}

export function AnomalyResultsTable({ results, ineligible }: { results: AnomalyResult[]; ineligible: IneligibleTransaction[] }) {
  return (
    <>
      <h2 className="font-display text-base font-semibold text-ink">Registros avaliados pelo modelo</h2>
      <p className="mt-1 text-sm leading-6 text-muted">Índices originais do CSV, a partir de 1, sem contar o cabeçalho. A classificação é a retornada pelo servidor.</p>
      <p id="anomaly-score-help" className="mt-3 rounded-md bg-panel-soft px-4 py-3 text-xs leading-5 text-muted">Score original do Isolation Forest, sem normalização: valores positivos são sinalizados como anômalos. O score não é percentual, probabilidade ou grau de severidade.</p>
      {results.length === 0 ? <p className="mt-5 text-sm text-muted">Não há registros avaliados para exibir na tabela.</p> : (
        <div className="mt-5 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-outline/60 focus-visible:outline-primary" role="region" aria-label="Tabela de registros avaliados" tabIndex={0}>
          <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm" aria-describedby="anomaly-score-help">
            <caption className="sr-only">Resultados de ML por índice original do CSV</caption>
            <colgroup><col className="w-24" /><col className="w-36" /><col className="w-64" /><col /></colgroup>
            <thead className="bg-panel-raised text-xs text-muted"><tr>
              <th scope="col" className="px-4 py-4">Registro</th><th scope="col" className="px-4 py-4">Classificação</th>
              <th scope="col" className="px-4 py-4">Score original</th><th scope="col" className="px-4 py-4">Dados técnicos</th>
            </tr></thead>
            <tbody>{results.map((record) => <AnomalyTableRow key={record.record_index} record={record} />)}</tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">{formatCount(results.length)} registros avaliados exibidos · ordem original recebida · sem paginação ou filtros de backend.</p>
      <div className="mt-7 border-t border-outline/60 pt-6">
        <h2 className="font-display text-base font-semibold text-ink">Registros ignorados pelo ML</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Registros ignorados são inelegíveis para ML e não devem ser interpretados como transações sem anomalias.</p>
        {ineligible.length === 0 ? <p className="mt-3 text-sm text-muted">Nenhum registro foi ignorado nesta análise.</p> : (
          <details className="mt-4 rounded-md border border-outline/60 bg-panel-soft p-4">
            <summary className="cursor-pointer text-sm font-semibold text-primary">Ver motivos de inelegibilidade ({formatCount(ineligible.length)} registros)</summary>
            <ul className="mt-4 space-y-4">{ineligible.map((record) => (
              <li key={record.record_index} className="rounded-md bg-panel p-4 text-sm text-muted">
                <h3 className="font-mono font-semibold text-ink">Registro #{record.record_index} · Inelegível</h3>
                <ul className="mt-2 space-y-2">{record.issues.map((issue, index) => (
                  <li key={index} className="break-words"><span className="font-mono text-primary">{issue.field}</span>: {issue.message}</li>
                ))}</ul>
              </li>
            ))}</ul>
            <p className="mt-4 text-xs leading-5 text-muted">Campos e mensagens originais do servidor. Valores brutos dos motivos não são exibidos.</p>
          </details>
        )}
      </div>
    </>
  )
}
