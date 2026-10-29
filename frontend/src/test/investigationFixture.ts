import type { InvestigationEvidence, InvestigationResult } from '../services/investigations'

// Synthetic, backend-shaped data; never used as a business result by the app.
export function investigationFixture(index = 1, mlStatus: 'ineligible' | 'unavailable' | 'evaluated' = 'ineligible'): InvestigationResult {
  const dataset = `sha256:${'a'.repeat(64)}`
  const reference = `${dataset}:record:${index}`
  const fact = (n: number, kind: InvestigationEvidence['kind'], fn: string, field: string, description: string, value: InvestigationEvidence['value']): InvestigationEvidence => ({
    evidence_id: `${reference}:e${n}`, kind, description, value, expected: null,
    source: { dataset_id: dataset, record_index: index, function: fn, field },
  })
  const facts = [
    fact(1, 'transaction', 'lucops.ingestion.load_csv', 'valor', 'Valor do registro selecionado; texto não numérico ou longo é ocultado.', '-10'),
    { ...fact(2, 'quality', 'lucops.pipeline.run_pipeline', 'valor', 'Rule failed.', '-10'), expected: 'rule check passed' },
    fact(3, 'ml', 'lucops.ml.features.prepare_csv_features', 'eligibility', 'Registro inelegível para ML conforme as regras atuais de preparação.', 'ineligible'),
    fact(4, 'ml', 'lucops.agents.tools.get_ml_information', 'ml.status', 'Situação de ML registrada no servidor; ausência não é previsão negativa.', 'ineligible'),
  ]
  const result: InvestigationResult = {
    schema_version: '1', mode: 'simulated', provider: 'deterministic-rules-v1', actions_executed: false,
    context: {
      schema_version: '1', dataset_id: dataset, record_index: index,
      transaction: { reference, original_value: '-10' },
      inconsistencies: [{ field: 'valor', message: 'Rule failed.', observed_value: '-10', expected: 'rule check passed', evidence_id: facts[1].evidence_id }],
      ml: { status: 'ineligible', model_version: null, anomaly_score: null, is_anomaly: null, reasons: ['valor: Rule failed.'], evidence_ids: [facts[2].evidence_id] },
      evidence: facts.slice(0, 3), limitations: ['A investigação abrange apenas o CSV enviado e o registro selecionado.'],
    },
    verified_evidence: facts,
    hypotheses: [{ description: 'O valor pode ter sido informado em formato incompatível; sua origem não foi confirmada.', evidence_ids: [facts[1].evidence_id], status: 'unconfirmed' }],
    recommendations: [{ action: 'Compare o valor com o registro de origem e a regra não atendida antes de propor uma correção.', evidence_ids: [facts[1].evidence_id] }],
    limitations: ['A investigação abrange apenas o CSV enviado e o registro selecionado.', 'Execução simulada: respostas determinísticas; nenhum LLM foi chamado.'],
    insufficient_evidence: ['Não há logs do sistema de origem nem histórico de clientes para confirmar causas.'],
  }
  if (mlStatus !== 'ineligible') {
    const value = mlStatus === 'evaluated' ? '1000000' : '100'
    result.context.transaction.original_value = value
    result.context.inconsistencies = []
    const transaction = { ...facts[0], value }
    const mlFact = mlStatus === 'evaluated'
      ? fact(3, 'ml', 'lucops.ml.service.analyze_csv_anomalies', 'is_anomaly', 'Alerta estatístico do detector de ML existente.', true)
      : null
    const status = { ...facts[3], value: mlStatus }
    result.context.ml = mlStatus === 'evaluated'
      ? { status: 'evaluated', model_version: 'test-v1', anomaly_score: 0.12, is_anomaly: true, reasons: [], evidence_ids: [mlFact!.evidence_id] }
      : { status: 'unavailable', model_version: null, anomaly_score: null, is_anomaly: null, reasons: ['Modelo indisponível.'], evidence_ids: [] }
    result.context.evidence = mlFact ? [transaction, mlFact] : [transaction]
    result.verified_evidence = [...result.context.evidence, status]
    result.hypotheses = mlFact ? [{ description: 'O valor pode ser atípico em relação ao padrão aprendido; não há justificativa de negócio disponível.', status: 'unconfirmed', evidence_ids: [mlFact.evidence_id] }] : []
    result.recommendations = []
  }
  return result
}
