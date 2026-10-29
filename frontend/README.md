# Frontend LucOps AI — Fase 7, Entrega 7.7.2 (Relatórios e PDF)

Interface React + TypeScript com Vite, Tailwind CSS e React Router em modo declarativo. Visão Geral e Qualidade dos Dados apresentam os indicadores e as inconsistências reais retornados por `POST /analyses`. Os resultados e o arquivo selecionado permanecem apenas na memória da sessão. O dashboard Streamlit continua disponível e documentado no [guia de desenvolvimento](../docs/development.md#interface-streamlit).

## Desenvolvimento local

Consulte o [guia de desenvolvimento](../docs/development.md) para pré-requisitos,
instalação, execução da FastAPI e React, configuração do modelo, testes e CI.
O [README principal](../README.md) oferece um início rápido, e a
[arquitetura](../docs/architecture.md) descreve os módulos e contratos HTTP.

O Vite encaminha `/health`, `/analyses`, `/anomaly-analyses` e `/investigations`
para a API local. A sidebar consulta `/health` ao abrir e a cada 30 segundos,
com prazo de 5 segundos; isso não verifica disponibilidade de ML ou OpenAI.
As análises têm limite de 30 segundos, incluindo a leitura do corpo. Uma falha
vazia do proxy pode ser diferenciada de erro do backend pela consulta a `/health`.

A Visão Geral e Qualidade dos Dados usam `POST /analyses` com `file` e
`include_details=true`. Os filtros locais abrangem os detalhes recebidos,
limitados a 200 ocorrências; indicadores e totais continuam cobrindo o CSV inteiro.
O ML permanece **Não analisado** até uma execução explícita.
As cinco rotas são funcionais nesta branch; os testes usam mocks e JSDOM.

## Investigações com IA — Etapa 7.6

A Etapa 7.6 foi concluída e integrada à `main`. Acesse `/investigacoes` após selecionar um CSV na Visão Geral. Informe o **Índice do registro**, começando em 1 e sem contar o cabeçalho, e clique em **Investigar com IA**. Qualidade e ML não precisam ter sido executados no frontend: o servidor prepara novamente o contexto a partir do arquivo. Se houver resultados anteriores na sessão, seus índices alimentam atalhos de seleção e suas contagens delimitam o índice; esses atalhos não enviam scores ou indicadores como evidências. A lista de atalhos abrange somente os registros presentes nos resultados recebidos, que podem ser parciais no caso dos detalhes de qualidade.

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

Os testes usam mocks e dados sintéticos, sem API ativa ou chamadas pagas. A investigação e a limpeza de resultados ao trocar o índice foram validadas manualmente no desktop durante a Etapa 7.6. OpenAI no React, autenticação, banco de dados e deploy permanecem fora deste escopo.

## Relatórios da sessão e PDF — Entregas 7.7.1 e 7.7.2

A página Relatórios reúne os resultados disponíveis da sessão React. A rota `/relatorios` lê diretamente o `AnalysisContext`, sem copiar resultados para outro estado nem enviar novas requisições de análise. A verificação de conexão `GET /health` existente continua independente.

A página reúne o nome do CSV e os resultados confirmados disponíveis: resumo de qualidade de `POST /analyses` (total, válidos, inválidos, percentual e inconsistências); modelo, avaliados, ignorados e anomalias de `POST /anomaly-analyses`; registro selecionado, síntese dos fatos, contagens de evidências/interpretações e limitações de `POST /investigations`. Os links levam às páginas originais para consulta completa.

O percentual de anômalos usa somente os registros avaliados como denominador. Sem avaliados, o percentual fica indisponível; zero anomalias após análise é diferente de ML não executado. O ML disponível no contexto de uma investigação específica não é promovido a resultado da análise de ML do lote. Nenhum score é interpretado como probabilidade, fraude ou severidade.

Resultados ausentes, tentativas em andamento e falhas são identificados. Se uma atualização falhar, o último resultado confirmado é preservado e indicado como anterior. Trocar o CSV limpa o relatório; trocar o índice invalida somente a investigação. A sessão não mantém um histórico de investigações.

Para validar no desktop, com FastAPI e Vite iniciados conforme o guia de desenvolvimento:

1. Abra `http://localhost:5173/relatorios` sem CSV e confira o estado vazio.
2. Selecione um CSV na Visão Geral e volte a Relatórios: as análises ainda não executadas devem estar identificadas.
3. Execute qualidade, ML e investigação nas respectivas páginas e retorne a Relatórios para conferir os números e o registro selecionado.
4. Troque o CSV e confira que os resultados anteriores desapareceram.

Não há Excel, download de CSV, assinatura de relatório ou persistência nesta entrega. O relatório textual de qualidade já disponível na CLI Python permanece independente; nenhum endpoint foi criado. A aparência do arquivo gerado pode ser conferida pelo roteiro de exportação abaixo.

### Exportação PDF local — Entrega 7.7.2

Com um CSV selecionado, clique em **Exportar PDF** em Relatórios. O jsPDF é carregado sob demanda e gera um documento A4 com nome seguro (`lucops-relatorio-<arquivo>.pdf`), data/hora reais de geração em America/Sao_Paulo, margens, cabeçalho e paginação. O botão fica indisponível durante a geração; falhas exibem uma mensagem e permitem nova tentativa. A conclusão indica que o download foi iniciado, sujeito aos controles do navegador.

O PDF executivo usa uma fotografia dos resultados disponíveis ao solicitar a exportação: resumo de negócio, cards, rosca vetorial de qualidade (válidos/inválidos) e rosca vetorial de ML (normais/anômalos, excluindo ignorados). Inclui registro investigado, fatos verificados, quantidade de evidências, possibilidades explicitamente não confirmadas, recomendações e limitações relevantes em linguagem acessível. O PDF seleciona até cinco limitações executivas, priorizando ausência de histórico e contexto externo, causas não confirmadas e limites estatísticos. Repetições e detalhes internos de cálculo ficam fora dessa seleção; os textos originais permanecem intactos na sessão e consultáveis na interface React. Títulos e conteúdo inicial são medidos juntos; hipóteses e recomendações pequenas permanecem no mesmo bloco. Quando cabe em uma página, a interpretação é redistribuída como um conjunto para equilibrar a segunda página, sem reduzir as fontes. Evidências individuais, referências completas, funções, scores e dados técnicos permanecem na interface React. Seções sem resultado, resultados zero e últimas análises preservadas após falhas são identificados separadamente. Sem dados para uma distribuição, não é desenhada uma rosca fictícia.

Não há novas análises, chamadas a OpenAI, upload, impressão da página ou envio de dados a terceiros. O arquivo é gerado somente pela ação do usuário e pode conter informações da análise. A fonte Noto Sans é incorporada ao módulo de exportação, sem buscar fontes externas em execução; sua origem e licença SIL OFL 1.1 estão em [src/assets/fonts/README.md](src/assets/fonts/README.md). Acentos e pontuação são preservados; caracteres sem glifo ou controles invisíveis são representados explicitamente por `[U+XXXX]`, com nota no documento, sem cortes silenciosos de textos extensos.

Para validar, execute as análises desejadas nas páginas existentes, volte a Relatórios, clique em **Exportar PDF** e abra o arquivo baixado. Confira nome do CSV, totais, data, cards, duas roscas, recomendações e limitações. Para o cenário com 5 válidos, 0 inválidos, 4 normais e 1 anômalo, a cobertura automatizada verifica um documento de até duas páginas. Textos extensos de negócio podem exigir mais páginas; não são cortados para impor esse limite. Consulte as evidências e referências completas na aplicação. Repita somente com qualidade, sem análises, com zero anomalias e após substituir o CSV.

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

A [configuração do modelo local](../docs/development.md#modelo-local-de-ml)
concentra treinamento explícito, artefatos confiáveis, `LUCOPS_MODEL_PATH`,
compatibilidade e reinício da API. Nenhum modelo é treinado ou substituído
automaticamente. Mantenha as chamadas externas bloqueadas conforme o guia.

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
