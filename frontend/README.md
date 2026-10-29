# Frontend LucOps AI — Fase 7, Etapa 7.6 (integração inicial)

Interface React + TypeScript com Vite, Tailwind CSS e React Router em modo declarativo. Visão Geral e Qualidade dos Dados apresentam os indicadores e as inconsistências reais retornados por `POST /analyses`. Os resultados e o arquivo selecionado permanecem apenas na memória da sessão. O dashboard Streamlit continua disponível e documentado no [README principal](../README.md#analytics--dashboard).

## Desenvolvimento local

Requer Node.js compatível com o Vite 6 (a implementação foi validada com Node 22.4.0).

```powershell
# Terminal 1, na raiz do repositório (ambiente Python já configurado)
.\.venv\Scripts\python.exe -m uvicorn lucops.api:app --reload
```

```powershell
# Terminal 2, na raiz do repositório
cd frontend
npm.cmd ci
npm.cmd run dev
```

Abra `http://localhost:5173`, selecione ou arraste um CSV e clique em **Analisar qualidade**. Durante o desenvolvimento, o Vite encaminha `/health`, `/analyses`, `/anomaly-analyses` e `/investigations` para `http://127.0.0.1:8000`; o navegador usa requisições de mesma origem. Para outra configuração de publicação, `VITE_API_BASE_URL` pode definir a URL-base do cliente, desde que haja um proxy de mesma origem ou CORS autorizado pelo servidor. No PowerShell desta máquina, `npm.cmd` evita o bloqueio de execução do shim `npm.ps1`.

O formulário envia `FormData` com os campos `file` e `include_details=true`, na mesma requisição. A API retorna `quality_status`, `summary` (`total_records`, `valid_records`, `invalid_records`, `total_issues`, `valid_percentage`) e, quando disponível, `details`. A análise de qualidade não calcula anomalias: o respectivo indicador permanece **Não analisado** até uma execução explícita de ML. A seleção de outro CSV descarta resultados anteriores e cancela as requisições de qualidade, ML e investigação em andamento.

A sidebar consulta `/health` ao abrir e a cada 30 segundos, mostrando apenas a disponibilidade da FastAPI para análises. Isso não verifica ML nem OpenAI. Uma reanálise malsucedida do mesmo arquivo conserva o último resultado confirmado e o identifica como anterior; ao substituir o CSV, esse resultado é descartado. A verificação de conexão tem limite de 5 segundos e a análise de 30 segundos, incluindo a leitura completa do corpo da resposta. Durante o desenvolvimento, uma falha de conexão do proxy do Vite pode chegar como HTTP 500 vazio; o cliente consulta `/health` para distingui-la de um HTTP 500 retornado pelo backend.

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

### CI automático no GitHub Actions

O workflow [Frontend CI](../.github/workflows/frontend-ci.yml) executa em pushes
para `main` e `feat/**`, além de pull requests destinados à `main`, sem filtros
de caminho. Em um runner Ubuntu com Node 22.x, instala as dependências com
`npm ci` e executa `npm run test`, `npm run lint` e `npm run build` dentro de
`frontend/`. O build inclui a verificação TypeScript (`tsc -b`). O cache npm usa
`frontend/package-lock.json`.

Os comandos acima validam o frontend localmente; a automação executa no GitHub
somente depois do envio da branch ou da abertura/atualização do PR. Os testes
usam mocks e JSDOM e não precisam de FastAPI ou Vite ativos. O workflow tem
apenas permissão de leitura, não usa segredos nem realiza deploy. O CI Python
continua independente em `.github/workflows/ci.yml`.

Para executar a suíte Python completa, a partir da raiz, use o ambiente com os extras `dev`, `dashboard` e `ml` instalados:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Os cinco links do menu funcionam. A Visão Geral e a página Qualidade dos Dados mostram os agregados reais do CSV atual, incluindo um gráfico de rosca calculado a partir de registros válidos e inválidos. Detecção de Anomalias oferece execução explícita, indicadores, distribuição e resultados por registro. Investigações com IA está integrada nesta branch ao provedor simulado; Relatórios continua como página de preparação. A integração da Etapa 7.6 aguarda validação manual, versionamento e merge.

## Investigações com IA — Etapa 7.6

Na branch `feat/react-ai-investigations`, acesse `/investigacoes` após selecionar um CSV na Visão Geral. Informe o **Índice do registro**, começando em 1 e sem contar o cabeçalho, e clique em **Investigar com IA**. Qualidade e ML não precisam ter sido executados no frontend: o servidor prepara novamente o contexto a partir do arquivo. Se houver resultados anteriores na sessão, seus índices alimentam atalhos de seleção e suas contagens delimitam o índice; esses atalhos não enviam scores ou indicadores como evidências. A lista de atalhos abrange somente os registros presentes nos resultados recebidos, que podem ser parciais no caso dos detalhes de qualidade.

### Contrato e segurança

`POST /investigations` recebe multipart com `file`, `record_index` (inteiro positivo) e `provider` (`simulated` por padrão no backend; também existe `openai` no contrato Python). **Esta interface envia explicitamente `provider=simulated` e não oferece acionamento do provedor pago.** Não precisa de chave de API, não altera `LUCOPS_AGENT_OPENAI_MAX_CALLS` e não chama um LLM real. Não há investigação automática ao selecionar arquivo, índice ou página.

A resposta existente contém `schema_version`, `mode`, `provider`, `context`, `verified_evidence`, `hypotheses`, `recommendations`, `limitations`, `insufficient_evidence` e `actions_executed=false`. O contexto identifica o conjunto por SHA-256 e o registro pelo índice; inclui a referência minimizada da transação, inconsistências, informações de ML, evidências locais e limitações. Os estados de ML são `evaluated`, `ineligible` e `unavailable`. Não possuir previsão não equivale a não possuir anomalias.

Cada evidência contém `evidence_id`, `kind`, `source` (`dataset_id`, `record_index` ou `null` para o lote, `function`, `field`), `description`, `value` e `expected`. Hipóteses têm `description`, `evidence_ids` e `status=unconfirmed`; recomendações têm `action` e `evidence_ids`. O cliente verifica a estrutura, o índice solicitado, a origem no mesmo conjunto e as referências existentes, e rejeita respostas em modo diferente do solicitado ou que indiquem ações executadas. As validações semânticas e a construção dos fatos continuam no backend; validar referências no navegador não comprova a verdade de uma hipótese.

### Apresentação e estado da sessão

A visão executiva mostra registro, valor minimizado disponibilizado pelo servidor (sem presumir moeda), contagem de inconsistências e situação de ML. O **Resumo dos fatos verificados** é uma síntese determinística do contexto, criada apenas para apresentação; não é um novo texto gerado por LLM. As evidências principais usam referências E1, E2 etc.; hipóteses são explicitamente não confirmadas e recomendações permanecem sugestões para revisão humana. Valores ocultados pelo servidor não são reconstruídos a partir dos resultados de qualidade ou ML.

**Ver detalhes técnicos** preserva todas as evidências, seus identificadores completos e origens, SHA-256, versão e score de ML quando disponíveis, todas as limitações e o JSON completo recebido. A visão inicial apresenta até cinco evidências e limitações essenciais. O botão **Ver todas as evidências** permite consultar a lista completa; **Mostrar menos** retorna ao resumo. Todas as informações também continuam auditáveis no expansor. Campos e respostas são renderizados como texto, sem interpretar instruções ou HTML do CSV. Scores não são apresentados como probabilidade, risco ou severidade, e nenhuma correção é executada.

HTTP 400 indica CSV inválido, 404 indica índice inexistente, 422 indica entrada inválida, 502 indica resposta rejeitada do provedor, 503 indica provedor indisponível e 500 indica falha interna. A interface usa mensagens próprias para esses erros, sem exibir detalhes internos. Reaproveita o prazo de 30 segundos e o cancelamento do cliente HTTP. Falhas não geram fallback para outro provedor.

Qualidade, ML e investigação são estados independentes em memória. Trocar/remover o CSV limpa todos; trocar o índice limpa apenas a investigação e cancela sua solicitação. Respostas atrasadas são ignoradas. Falhas não apagam qualidade ou ML. Uma nova tentativa para o mesmo arquivo/índice conserva o último resultado confirmado, identificado como anterior. Não há persistência em localStorage ou histórico.

Para conferir no desktop com a API e o Vite em execução:

1. Selecione `data/sample/teste_anomalias.csv` na Visão Geral e abra **Investigações com IA**.
2. Informe o índice **5** e clique em **Investigar com IA**. O modo deve ser `simulated`, sem LLM real; com o mesmo modelo `iforest-v1` previamente validado, o ML poderá contextualizar o alerta desse registro.
3. Confira evidências, hipóteses, recomendações, limitações e referências completas nos detalhes. Sem modelo configurado, a investigação deve continuar mostrando ML indisponível.
4. Troque o índice e o CSV: nenhum resultado anterior deve permanecer associado à nova seleção. Confira também `transacoes_invalidas.csv`, erros de índice e preservação da qualidade/ML.

Os testes usam mocks e dados sintéticos, sem API ativa ou chamadas pagas. A aparência final ainda requer a primeira validação manual no desktop; esta entrega não exige uma nova rodada obrigatória de testes em tablet e celular. OpenAI no React, Relatórios, autenticação, banco de dados e deploy permanecem fora deste escopo.

## Anomalias — integração e dashboard (7.5.1–7.5.3)

Selecione um CSV na Visão Geral, acesse **Detecção de Anomalias** e clique em **Executar análise de anomalias**. Não há execução automática no upload nem treinamento por requisição. O mesmo objeto `File` da sessão é enviado ao endpoint independente; não é persistido em localStorage.

### Contrato existente da FastAPI

`POST /anomaly-analyses` recebe apenas o campo multipart `file`. Não aceita caminhos de modelos ou parâmetros de treinamento pelo frontend. O cliente TypeScript valida a estrutura da resposta e a correspondência entre contagens e listas:

| Campo | Tipo e significado |
| --- | --- |
| `model_version` | string: versão do artefato configurado no servidor |
| `evaluated_records` | inteiro: quantidade de itens em `results` |
| `skipped_records` | inteiro: quantidade de itens em `ineligible` |
| `anomalies_detected` | inteiro: quantidade de `results` com `is_anomaly=true` |
| `results` | lista de `{record_index: number, transaction_id: string, original_value: string, anomaly_score: number, is_anomaly: boolean}` |
| `ineligible` | lista de `{record_index: number, transaction_id: string, original_value: string, issues: [{field: string, message: string, value: unknown, expected: unknown}]}` |

`record_index` começa em **1**, sem contar o cabeçalho, e preserva a posição no CSV, mesmo com IDs vazios ou duplicados. `original_value` permanece texto. A pontuação é `-decision_function`: valores positivos são sinalizados (`is_anomaly=true`); não é probabilidade, severidade nem confirmação de fraude. Inelegíveis preservam os motivos de exclusão e não representam transações avaliadas sem anomalias. Os valores brutos dos motivos de inelegibilidade não são exibidos.

### Dashboard visual

Os quatro cards mostram avaliados, anomalias, ignorados e percentual de anômalos: `anomalies_detected / evaluated_records * 100`. O denominador inclui somente avaliados. Sem avaliados, o percentual aparece como `—`, acompanhado de explicação, e a distribuição não é desenhada. Zero anomalias com registros avaliados aparece como `0` e `0,00%`.

A rosca, construída em CSS como a distribuição de qualidade, apresenta normais (`evaluated_records - anomalies_detected`) e anômalos. Ignorados ficam fora. Textos e legendas identificam as duas classes, sem depender somente de cores. O layout mantém os tokens do Stitch, os cards reutilizáveis e a grade responsiva já adotada no projeto, sem bibliotecas novas.

A tabela exibe todos os avaliados na ordem recebida, com índice original, classificação retornada e score. Alertas possuem destaque visual e texto **Anômalo**; não são níveis de severidade. O score usa separador decimal pt-BR sem arredondamento deliberado, normalização, barra ou símbolo de percentual. **Ver dados do registro** permite consultar ID, valor original como texto (sem presumir moeda) e a representação completa do score retornado. Conteúdo dos campos é renderizado como texto, sem interpretar HTML.

Os dados técnicos ocupam uma linha adicional com `colSpan=4`, abaixo do registro, mantendo a linha principal compacta. Cada botão nativo indica a expansão por `aria-expanded` e referencia sua linha por `aria-controls`; Enter ou Espaço acionam o botão focado. **Ocultar dados do registro** recolhe o painel. Scores permanecem completos e sem quebra em ambas as linhas. A tabela mantém colunas estáveis e rolagem nativa dentro de um contêiner limitado à largura do card, sem interceptar gestos de toque ou roda do mouse. Os testes JSDOM conferem a estrutura, o foco e a alternância do painel; não comprovam a geometria renderizada ou o movimento real da scrollbar.

Os ignorados aparecem em seção separada: **Ver motivos de inelegibilidade** lista índice, campo e mensagem original do servidor, que pode estar em inglês. Não são classificados como normais nem anômalos. A tabela tem rolagem horizontal acessível por teclado em telas menores. Não há filtros, paginação, histórico ou investigação nessa tabela.

O card de anomalias da Visão Geral reutiliza o resultado de ML da sessão, incluindo zero confirmado. Navegar não dispara novas análises. Trocar o CSV limpa indicadores, gráfico e tabelas; falhas de reanálise do mesmo CSV mantêm os resultados anteriores identificados como tais.

Estados de ML são independentes da qualidade: não analisado, em andamento, concluído, erro ou indisponível. HTTP 400 indica CSV inválido, 422 indica envio inválido e 503 indica indisponibilidade do modelo ou das dependências de ML. Falhas de rede, timeout (30 segundos, incluindo o corpo) e resposta incompatível não geram sucesso nem resultados fictícios. Detalhes internos de HTTP 503 não são exibidos. O monitor `/health` indica disponibilidade da API, sem assegurar disponibilidade do modelo.

Uma falha ao repetir a análise do mesmo arquivo preserva o último resultado confirmado, explicitamente identificado como anterior. Trocar ou remover o CSV cancela as requisições e limpa os dois resultados. A identidade da requisição também é conferida antes de atualizar o estado, para ignorar respostas atrasadas. A navegação entre páginas mantém os resultados em memória, e falhas de ML não apagam qualidade.

### Modelo local e validação manual

Use somente o artefato confiável gerado pelo projeto e mantenha o `.joblib` junto do `.joblib.json`, com a versão de Scikit-learn usada no treino. No terminal que inicia a FastAPI, na raiz:

```powershell
$env:LUCOPS_AGENT_OPENAI_MAX_CALLS = '0'
$env:LUCOPS_MODEL_PATH = (Resolve-Path models/isolation_forest.joblib).Path
.\.venv\Scripts\python.exe -m uvicorn lucops.api:app --reload
```

Se a API já estiver em execução, encerre-a no terminal original antes de reiniciar com essa configuração. Definir a variável em outro terminal não configura o processo existente. O modelo é carregado na primeira inferência e reutilizado por processo/caminho; reinicie a API se substituir o artefato. A existência do arquivo sozinha não garante compatibilidade: o backend valida os metadados e a integridade ao carregá-lo.

Se não houver artefato, siga o procedimento de [treinamento local já documentado](../README.md#machine-learning-comandos-locais), em uma ação separada e consciente. Por exemplo, apenas quando necessário e sem sobrescrever um modelo existente:

```powershell
.\.venv\Scripts\python.exe -m lucops.ml train data/sample/transacoes.csv --model models/isolation_forest.joblib --model-version iforest-v1
```

Esta entrega não instala dependências nem treina, baixa ou substitui modelos automaticamente.

Para a revisão manual:

1. Inicie a API configurada e o Vite com `npm.cmd run dev` em `frontend/`.
2. Selecione um CSV de exemplo na Visão Geral. Confirme que ML continua não analisado.
3. Execute a qualidade e depois o ML em `/anomalias`; confira as contagens reais retornadas em `/docs` ou na aba Network.
4. Navegue entre as páginas, repita a execução e substitua o CSV durante uma requisição; resultados de arquivos diferentes não devem se misturar.
5. Para testar 503, reinicie a API sem `LUCOPS_MODEL_PATH`: deve aparecer indisponibilidade, sem resultados inventados e sem apagar qualidade.

Os testes usam respostas sintéticas via mocks de `fetch`, sem servidor, treinamento ou chamadas à OpenAI. As referências do Stitch orientam tema e estrutura; valores ilustrativos, LOF, Z-Score e controles de recalibração presentes no HTML não foram incorporados como funcionalidades reais.

Como referência do teste real já realizado com `iforest-v1`, `data/sample/teste_anomalias.csv` retornou 5 avaliados, 0 ignorados e 1 anomalia (T105), resultando em 20,00% e distribuição de 4 normais e 1 anômalo. Essas contagens são expectativas para esse arquivo/modelo, nunca valores fixados na interface. A revisão automatizada da 7.5.3 cobre expansão, precisão dos scores, zero anomalias, todos inelegíveis e troca de arquivo. O movimento real da rolagem e a aparência final do painel não são comprovados por JSDOM; uma conferência pontual no navegador continua possível, sem exigir uma nova rodada de homologação de tablet e celular.

## Tabela de inconsistências

A página Qualidade dos Dados reutiliza o mesmo resultado dos indicadores. `details.items` fornece `record_index`, `field`, `description` e `rule`. O índice começa em 1 e conta registros de dados, sem o cabeçalho; um registro pode aparecer várias vezes por ter mais de um problema. **Ver regra** expõe o identificador original da regra, sem renomeá-lo. Valores brutos e identificadores pessoais não são incluídos nesse contrato.

A pesquisa por índice (por exemplo, `2` ou `#2`) ou descrição combina-se com os filtros por campo e regra. As opções são derivadas dos itens recebidos, a filtragem é local e não solicita outra análise. Os indicadores agregados não mudam com os filtros. **Limpar filtros** restaura a lista; os filtros também são limpos quando muda a análise. Não há edição, correção automática ou exportação.

A API retorna no máximo 200 ocorrências detalhadas. `returned_issues`, `total_issues`, `limit` e `truncated` descrevem esse limite. Se `truncated=true`, existem outras ocorrências no CSV que não estão disponíveis para filtragem; o resumo continua abrangendo o arquivo inteiro. Uma lista vazia, detalhes ausentes e filtros sem resultados recebem mensagens distintas. A ausência de `details` não é interpretada como ausência de inconsistências.

Para validar manualmente, analise `data/sample/transacoes_invalidas.csv`: são esperados 4 registros, 1 válido, 3 inválidos e 3 inconsistências. O filtro `valor` apresenta os registros 2 e 3; `cliente_id`, o registro 4. Teste também a navegação pelo teclado, abertura e fechamento do menu móvel e resoluções de 1440, 768 e 390 px. Os testes de componentes simulam as mudanças de resolução; a avaliação visual e da ordem de foco deve ser feita no navegador.
