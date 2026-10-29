# Arquitetura do LucOps AI

[Apresentação](../README.md) · [Desenvolvimento](development.md)

## Organização

O repositório reúne uma biblioteca e API Python, um frontend React e uma interface
Streamlit. Mantém o layout Python `src/`; não há necessidade de um diretório
`backend/` para separar as responsabilidades.

| Diretório | Responsabilidade |
| --- | --- |
| `src/lucops/` | Núcleo de qualidade, aplicação, API e CLI |
| `src/lucops/ml/` | Preparação de atributos, treino, inferência e artefatos |
| `src/lucops/agents/` | Contexto, ferramentas, provedores e investigação |
| `frontend/` | Interface React e exportação PDF local |
| `dashboard/` | Interface Streamlit integrada à API |
| `tests/` | Testes Python e fixtures sintéticas |
| `docs/` | Guias técnicos e protocolos de avaliação |
| `bruno/lucops-api/` | Coleção de requisições HTTP |
| `data/sample/` | CSVs públicos de demonstração |
| `models/`, `reports/` | Saídas locais geradas, ignoradas pelo Git |
| `design/stitch-reference/` | Referências visuais locais, não versionadas |

## Fluxo de execução

```text
React / Streamlit
        │ upload de CSV e parâmetros explícitos
        ▼
FastAPI — lucops.api:app
        ├── Qualidade → aplicação → pipeline → regras → resumo e detalhes
        ├── Anomalias → modelo local treinado → atributos → inferência
        └── Investigação → contexto + ferramentas → provedor → validação
        │
        ▼
Resultados JSON → indicadores, evidências e detalhes técnicos
        └── React: relatório da sessão → PDF gerado no navegador
```

Qualidade, ML e investigação são operações independentes. Nenhuma requisição
de inferência treina o modelo. A investigação reconstrói as evidências no servidor;
não aceita indicadores ou scores fornecidos pelo navegador como fatos.

## Núcleo Python de qualidade

- `ingestion.py`: leitura de CSV UTF-8 com suporte a BOM e validação estrutural.
- `core.py`: validação de campos e representação das inconsistências.
- `rules.py`: regra de valor financeiro positivo, com até duas casas decimais.
- `pipeline.py`: validação de registros e identificação de duplicidades.
- `summary.py` e `status.py`: indicadores e situação geral da qualidade.
- `reporting.py`: formatação e salvamento de relatórios TXT.
- `application.py`: coordena pipeline, resumo e relatório; disponibiliza os
  resultados da mesma execução quando são solicitados detalhes.
- `analysis_details.py`: projeção limitada de inconsistências, sem valores brutos.
- `api.py` e `__main__.py`: interfaces HTTP e CLI para os módulos existentes.

O esquema atual requer `id_transacao`, `cliente_id` e `valor`. Presença, valor
financeiro e unicidade do identificador são verificações distintas; um registro
pode ter mais de uma inconsistência. A contagem de registros inválidos não é a
contagem de ocorrências.

## Machine Learning

`features.py` e `schemas.py` preparam atributos e preservam os índices originais.
`training.py` treina o Isolation Forest; `detector.py` executa inferência sem treino.
`artifacts.py` salva e valida joblib e metadados JSON. `service.py` utiliza somente
o modelo local configurado no servidor e mantém cache por processo/caminho.

O detector usa apenas `valor`, com 100 árvores, `random_state=42` e
`contamination='auto'`. O score é `-decision_function`; não representa
probabilidade de fraude ou severidade. ML não altera o status de qualidade.
Registros inelegíveis mantêm seus motivos e não são classificados como normais.

Somente artefatos confiáveis gerados pelo projeto devem ser carregados.
SHA-256 verifica integridade, mas não autentica a origem; joblib pode executar
código ao carregar. Veja a [avaliação do modelo](ml-evaluation.md).

## Investigações orientadas por evidências

- `schemas.py`: contratos de contexto, evidências e resultado.
- `context.py`: identifica o dataset por SHA-256 e reúne dados minimizados.
- `tools.py`: consulta transação, qualidade, duplicidades, lote atual e ML.
- `providers.py`: interface substituível e provedor determinístico `simulated`.
- `service.py` e `safety.py`: orquestração e validação das respostas e referências.
- `openai_provider.py` e `prompts.py`: integração opcional, bloqueada por padrão.
- `presentation.py` e `money.py`: apresentação executiva usada pelo Streamlit.

Evidências verificadas, hipóteses não confirmadas, recomendações e limitações
permanecem separadas. Os estados de ML são avaliado, inelegível e indisponível:
ausência de avaliação não significa ausência de anomalia. As estatísticas são
do CSV atual, sem histórico de clientes ou confirmação de causas.
Consulte [controles dos provedores](ai-investigation.md) e
[limites da avaliação semântica](ai-investigation-evaluation.md).

## Contratos HTTP

| Endpoint | Entrada | Resultado |
| --- | --- | --- |
| `GET /health` | Sem arquivo | `status: ok`, `service: LucOps AI` |
| `POST /analyses` | Multipart `file`; `include_details=false` opcional | `quality_status`, `summary` e detalhes opcionais |
| `POST /anomaly-analyses` | Multipart `file` | Versão, contagens, resultados e inelegíveis |
| `POST /investigations` | Multipart `file`, `record_index`, `provider=simulated` | Contexto, evidências, hipóteses, recomendações e limitações |

O índice começa em **1**, conta registros de dados sem o cabeçalho e não equivale
necessariamente à linha física do arquivo. Identifica registros mesmo com IDs
ausentes ou duplicados. Os uploads são processados em diretórios temporários,
removidos ao sair do processamento; não há armazenamento permanente do CSV.

### Qualidade e detalhes

`summary` contém `total_records`, `valid_records`, `invalid_records`,
`total_issues` e `valid_percentage`. Registros inconsistentes ainda retornam
HTTP 200 quando o processamento é concluído.

Solicitar `include_details=true` não executa uma segunda análise. A coleção
`details.items` contém `record_index`, `field`, `rule` e `description`,
sem valores brutos, severidades ou causas inventadas. `rule` identifica a função
de validação do valor ou as verificações de presença e unicidade.

São retornadas até 200 ocorrências, na ordem do pipeline. `returned_issues`,
`total_issues`, `limit`, `truncated` e `record_index_base` tornam o limite
explícito. O resumo cobre o CSV inteiro, mesmo quando os detalhes são truncados.

### Anomalias e investigação

Anomalias retornam `model_version`, `evaluated_records`, `skipped_records`,
`anomalies_detected`, `results` e `ineligible`. Os resultados preservam índice,
ID, valor original, score e classificação. O percentual de anômalos considera
somente os avaliados, excluindo ignorados.

Investigação retorna `mode`, `provider`, `context`, `verified_evidence`,
`hypotheses`, `recommendations`, `limitations`, `insufficient_evidence`
e `actions_executed=false`. A API aceita seleção explícita de provedor; o React
envia somente `simulated`. Falhas nunca acionam fallback silencioso.

As respostas de investigação distinguem CSV inválido (400), registro inexistente
(404), parâmetros inválidos (422), resposta rejeitada (502), provedor indisponível
(503) e erro interno (500). ML indisponível retorna 503 na análise de anomalias.
O Swagger em `/docs` apresenta os endpoints e parâmetros em execução; os contratos
consumidos pelo React estão detalhados no [guia do frontend](../frontend/README.md).

## Frontend e sessão

`services/` contém o cliente HTTP, tipos e validação de respostas; `state/`
mantém o `AnalysisContext`; `pages/` e `components/` apresentam os resultados.
Trocar o CSV cancela requisições e limpa análises. Trocar o índice limpa somente
a investigação. Respostas atrasadas são descartadas; falhas de reanálise do mesmo
arquivo preservam resultados confirmados, identificados como anteriores.

`reports/pdf.ts` gera o relatório por ação explícita do usuário, sem servidor ou
novas análises. O jsPDF e a fonte local são carregados sob demanda. A fonte mantém
[sua licença e origem](../frontend/src/assets/fonts/README.md). O PDF executivo
resume fatos; a interface preserva evidências, referências e detalhes completos.

Não há localStorage para conteúdo do CSV, banco de dados, autenticação ou histórico
persistente. O Streamlit permanece disponível; não é necessário executá-lo para
usar React. As referências Stitch orientam o visual, sem participar do build.
