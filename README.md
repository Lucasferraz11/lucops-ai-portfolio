# LucOps AI

**Intelligent Data Quality & Reliability Platform**

Plataforma de qualidade e confiabilidade de dados, integrando Engenharia de Dados, Data Analytics, Machine Learning, Inteligência Artificial e Cloud.

## Objetivo

Automatizar a validação de dados, identificar inconsistências e anomalias e apoiar a investigação de problemas por meio de inteligência artificial.

## Status

**Em desenvolvimento — Fases 1 a 6 concluídas; Fase 7 em andamento.**

O projeto possui motor de qualidade, CLI, FastAPI, Machine Learning e investigação assistida por IA. Duas interfaces coexistem: o dashboard Streamlit, com qualidade, ML e investigação, e o frontend React. As Etapas 7.4 — Visão Geral e Qualidade dos Dados — e 7.5 — Detecção de Anomalias — estão concluídas e integradas à `main`, com as respectivas páginas React funcionais. Investigações com IA e Relatórios no React permanecem como próximas etapas; recursos de agentes e relatórios já existem em outras partes do projeto, conforme documentado adiante.

## Visão geral

A primeira integração React de Investigações com IA está implementada na branch `feat/react-ai-investigations`, em validação antes do versionamento e merge. Ela utiliza o endpoint existente `POST /investigations` com o provedor determinístico `simulated`, sem chamadas pagas ou LLM real. Essa integração ainda não está disponível na `main`; consulte o [contrato e as instruções do frontend](frontend/README.md#investigações-com-ia--etapa-76).

O LucOps AI é uma plataforma modular de qualidade e monitoramento de dados empresariais.

Seu objetivo é automatizar a identificação de inconsistências, gerar indicadores de qualidade e fornecer informações para apoiar análises e decisões.

Atualmente, a plataforma processa arquivos CSV, aplica regras de validação e disponibiliza os resultados por CLI, API REST e interfaces React e Streamlit.

A arquitetura separa qualidade, detecção de anomalias e investigação assistida, permitindo a evolução para outras fontes e bancos de dados.

## Funcionalidades implementadas

### Engenharia e qualidade de dados

- Leitura e validação de arquivos CSV.
- Verificação de campos obrigatórios.
- Validação de valores financeiros.
- Identificação de registros duplicados.
- Cálculo de indicadores de qualidade.
- Classificação do status da análise.
- Geração e salvamento de relatórios TXT.

### Backend e APIs

- API REST desenvolvida com FastAPI.
- Endpoint de verificação de disponibilidade.
- Upload e análise de arquivos CSV via HTTP.
- Retorno de indicadores em formato JSON.
- Tratamento de erros HTTP.
- Documentação interativa com Swagger UI.

### Testes e qualidade de código

- Testes automatizados com Pytest.
- Testes de API com FastAPI TestClient.
- Coleção de requisições HTTP no Bruno.
- Validação automatizada de status codes e respostas JSON.
- Verificação e formatação de código com Ruff.
- Versionamento com Git e GitHub.

## Tecnologias

- **Linguagem:** Python.
- **Backend:** FastAPI e Uvicorn.
- **Interfaces:** React, TypeScript, Vite, Tailwind CSS e Streamlit.
- **Testes:** Pytest, TestClient e Bruno.
- **Qualidade de código:** Ruff.
- **Versionamento:** Git e GitHub.
- **Formato de dados:** CSV e JSON.

## Arquitetura

O projeto utiliza uma arquitetura modular, com responsabilidades separadas:

- `ingestion.py`: leitura de arquivos CSV.
- `core.py`: validação dos registros.
- `rules.py`: regras de negócio.
- `pipeline.py`: processamento e validações.
- `summary.py`: indicadores de qualidade.
- `status.py`: classificação da análise.
- `reporting.py`: geração e salvamento de relatórios.
- `application.py`: coordenação da análise completa.
- `__main__.py`: interface de linha de comando.
- `api.py`: exposição das funcionalidades por meio de endpoints REST.

A API utiliza o motor de qualidade de dados existente, evitando duplicação de regras de negócio.

`frontend/` contém a interface React, com componentes compartilhados, páginas,
cliente HTTP e contexto de análise em memória. `dashboard/` mantém o Streamlit;
`src/lucops/ml/` e `src/lucops/agents/` concentram ML e investigação.

## Como executar

### 1. Preparar o ambiente

No PowerShell, na raiz do projeto:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

### 2. Executar uma análise pela CLI

```powershell
.\.venv\Scripts\python.exe -m lucops data/sample/transacoes_invalidas.csv
```

O comando processa o CSV e gera um relatório em:

`reports/quality_report.txt`

Para escolher outro local de saída:

```powershell
.\.venv\Scripts\python.exe -m lucops data/sample/transacoes_invalidas.csv --output reports/minha_analise.txt
```

A CLI utiliza atualmente o esquema de transações financeiras, com os campos obrigatórios:

- `id_transacao`
- `cliente_id`
- `valor`

A regra financeira exige valores positivos, com no máximo duas casas decimais, e o identificador da transação deve ser único.

### 3. Executar a API REST

Inicie o servidor FastAPI:

```powershell
.\.venv\Scripts\python.exe -m uvicorn lucops.api:app --reload
```

A API estará disponível em:

`http://127.0.0.1:8000`

Para deploy na Vercel, o entrypoint da API está configurado em `pyproject.toml`
como `src.lucops.api:app`.

Para acessar a documentação interativa Swagger UI:

`http://127.0.0.1:8000/docs`

### Interface React — Visão Geral, Qualidade dos Dados e Detecção de Anomalias

Com a FastAPI em execução no terminal 1, abra outro terminal na raiz do projeto.
Use Node.js compatível com Vite 6 e o lockfile existente para instalar o frontend:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Acesse `http://localhost:5173`. Envie um CSV na Visão Geral e clique em
**Analisar qualidade**. A requisição envia `file` e `include_details=true` para
`POST /analyses`; indicadores, gráfico e tabela usam o mesmo resultado. Em
**Qualidade dos Dados**, pesquise pelo índice ou descrição e filtre por campo e
regra. Os filtros são locais e abrangem apenas os detalhes recebidos: a API
retorna até 200 ocorrências, com aviso de truncamento e totais completos no
resumo. **Ver regra** apresenta o identificador original da validação.

A aplicação distingue detalhes ausentes, lista vazia e filtros sem resultados.
Substituir o CSV limpa o estado; falhar na reanálise do mesmo arquivo preserva o
último resultado confirmado. Esse fluxo de qualidade está disponível na `main`.

A página **Detecção de Anomalias**, concluída na Etapa 7.5 e integrada à `main`,
reutiliza o CSV da sessão e, somente ao clicar em
**Executar análise de anomalias**, envia o campo multipart `file` para
`POST /anomaly-analyses`. O backend utiliza um Isolation Forest previamente
treinado, configurado no servidor por `LUCOPS_MODEL_PATH`, sem treinar durante
as requisições. Consulte a [configuração local do modelo](#ml-na-api-e-no-dashboard).

O dashboard de anomalias apresenta indicadores, distribuição normal/anômalo,
tabela de resultados, scores completos e detalhes técnicos expansíveis, além
dos motivos dos registros ignorados em uma seção separada. O percentual de
anômalos considera apenas os registros avaliados; scores não representam
probabilidade, severidade ou confirmação de fraude. ML permanece **Não analisado**
até a execução explícita, e uma análise válida pode retornar zero anomalias.
Qualidade e ML mantêm resultados independentes, descartados ao substituir o CSV.

Investigações com IA e Relatórios continuam como páginas de preparação no React da `main`; a primeira integração de investigação está disponível para validação na branch `feat/react-ai-investigations`.
O dashboard Streamlit continua disponível conforme as instruções adiante.
Consulte [execução, contrato e validação do frontend](frontend/README.md).

### 4. Endpoints disponíveis

**GET /health**

Verifica a disponibilidade da API.

Exemplo de resposta:

```json
{
  "status": "ok",
  "service": "LucOps AI"
}
```

**POST /analyses**

Recebe um arquivo CSV por meio de `multipart/form-data` e executa uma análise de qualidade de dados.

O arquivo deve ser enviado no campo `file`.

Para incluir as inconsistências individuais na mesma análise, envie também o campo
opcional `include_details=true` em `multipart/form-data`. O padrão é `false`, e a
resposta anterior permanece igual quando o campo é omitido. O processamento usa
as mesmas validações do resumo; não há uma segunda análise.

Exemplo de resposta:

```json
{
  "quality_status": "COM INCONSISTÊNCIAS",
  "summary": {
    "total_records": 4,
    "valid_records": 1,
    "invalid_records": 3,
    "total_issues": 3,
    "valid_percentage": 25.0
  }
}
```

A resposta com detalhes inclui adicionalmente:

```json
{
  "details": {
    "items": [
      {
        "record_index": 2,
        "field": "valor",
        "rule": "is_positive_amount",
        "description": "Valor não atende à regra de validação."
      }
    ],
    "returned_issues": 1,
    "total_issues": 1,
    "limit": 200,
    "truncated": false,
    "record_index_base": 1
  }
}
```

`record_index` começa em **1** e conta registros de dados do CSV (sem contar o
cabeçalho); não representa necessariamente a linha física quando houver campos
multilinha. O índice identifica registros mesmo com `id_transacao` ausente ou
duplicado. Cada ocorrência tem um item, portanto um registro pode ter vários.
`rule` usa o nome da função realmente configurada para a regra de `valor`; as
validações de presença e unicidade recebem descrições legíveis. O pipeline não
fornece códigos de regra, categorias nem severidades. Valores originais,
`cliente_id` e demais campos do CSV não são retornados nos detalhes.

São retornadas no máximo 200 ocorrências, na ordem do processamento. O resumo
mantém os totais completos; `returned_issues` indica quantas aparecem na
resposta e `truncated` informa se existem outras não exibidas. No Swagger UI
(`/docs`), abra `POST /analyses`, clique em **Try it out**, selecione o CSV no
campo `file` e marque `include_details` como `true`.

A API utiliza os seguintes códigos HTTP:

- `200 OK`: requisição processada com sucesso.
- `400 Bad Request`: CSV com estrutura inválida.
- `404 Not Found`: endpoint inexistente.
- `422 Unprocessable Entity`: ausência de um campo obrigatório na requisição.

Um arquivo pode conter registros inconsistentes e ainda retornar HTTP 200, pois a análise foi executada corretamente.

## Testes automatizados

Executar todos os testes Python:

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

Para a suíte Python completa, instale previamente os extras `dev`, `dashboard`
e `ml` no ambiente (`python -m pip install -e ".[dev,dashboard,ml]"`).
Os testes frontend são independentes; execute dentro de `frontend/`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Verificar a qualidade do código:

```powershell
.\.venv\Scripts\python.exe -m ruff check .
```

Corrigir automaticamente problemas suportados pelo Ruff:

```powershell
.\.venv\Scripts\python.exe -m ruff check . --fix
```

Formatar os arquivos Python:

```powershell
.\.venv\Scripts\python.exe -m ruff format .
```

### Testes de API com Bruno

A coleção de requisições está localizada em:

`bruno/lucops-api/`

Para executar os testes:

1. Inicie o servidor FastAPI.
2. Abra a coleção `lucops-api` no Bruno.
3. Selecione uma requisição HTTP.
4. Clique em **Send**.
5. Confira os resultados na aba **Tests**.

A coleção contém os seguintes cenários:

| Requisição | HTTP esperado |
|---|---|
| Health Check | 200 |
| Analyze Transactions | 200 |
| Analyze Invalid CSV | 400 |
| Analyze Missing File | 422 |
| Endpoint Not Found | 404 |

Os testes verificam códigos HTTP e informações retornadas no JSON.

## Próximas evoluções

- Integração com bancos de dados.
- Pipelines de ingestão e transformação de dados.
- Validação e integração à `main` das investigações no React, seguida da implementação da página Relatórios.
- Integração com serviços Cloud.
- Containerização com Docker.
- Evolução da interface web e dos recursos de observabilidade.

## Desenvolvimento

O LucOps AI está sendo desenvolvido de maneira incremental, com foco em modularidade, testes automatizados, boas práticas de engenharia de software e documentação técnica.

O projeto também busca demonstrar a integração de conhecimentos de Engenharia de Dados, Qualidade de Software, APIs, Ciência de Dados, Inteligência Artificial e Cloud.

---

## Analytics & Dashboard

O LucOps AI possui uma interface web desenvolvida com Streamlit,
integrada à API FastAPI, para executar análises de qualidade de
dados e visualizar seus resultados.

### Funcionalidades

- Upload de arquivos CSV pela interface web.
- Integração com a API de análises.
- Validação automatizada dos registros.
- Indicadores de registros válidos e inválidos.
- Taxa percentual de qualidade dos dados.
- Gráfico de rosca com distribuição dos registros.
- Barra de qualidade com cores dinâmicas.
- Mensagens para análises válidas, inconsistentes ou sem dados.
- Tratamento de erros de comunicação e arquivos inválidos.

### Tecnologias

- Python
- Streamlit
- FastAPI
- Requests
- Vega-Lite
- Pytest
- Ruff

### Instalação

Instale o projeto com as dependências de desenvolvimento e dashboard:

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev,dashboard]"
```

### Executando a aplicação

A plataforma utiliza dois serviços locais:
a API FastAPI e a interface Streamlit.

**Terminal 1 — Iniciar a API**

```powershell
.\.venv\Scripts\python.exe -m uvicorn lucops.api:app --reload
```

API: http://127.0.0.1:8000

Documentação Swagger: http://127.0.0.1:8000/docs

**Terminal 2 — Iniciar o dashboard**

```powershell
.\.venv\Scripts\python.exe -m streamlit run dashboard/app.py
```

Dashboard: http://localhost:8501

Os dois serviços devem estar em execução para realizar
análises pela interface.

### Deploy do dashboard e da API

O dashboard Streamlit e a API FastAPI são serviços separados. Publique a API
na Vercel e mantenha o dashboard no Streamlit Community Cloud. No painel da
Vercel, teste a API pelo endpoint `/health` da URL pública; a raiz da URL não
é um endpoint da API.

No Streamlit Community Cloud, abra **App settings > Secrets** e configure a
URL base pública da API:

```toml
LUCOPS_API_URL = "https://sua-api.vercel.app"
```

Após salvar, reinicie o dashboard. Localmente, sem essa configuração, o
dashboard continua usando `http://127.0.0.1:8000`.

### Utilizando o dashboard

1. Acesse o dashboard no navegador.
2. Selecione um arquivo CSV.
3. Clique em "Analisar dados".
4. Visualize os indicadores e o gráfico de qualidade.

Exemplos disponíveis em `data/sample/`:

- `transacoes_validas.csv`: registros sem inconsistências.
- `transacoes_invalidas.csv`: registros com problemas de qualidade.
- `transacoes_vazias.csv`: arquivo com cabeçalho, mas sem registros.

### Testes automatizados

Execute todos os testes:

```powershell
.\.venv\Scripts\python.exe -m pytest -v
```

Execute somente os testes do dashboard:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_dashboard.py -v
```

Valide o código com Ruff:

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
```

O projeto utiliza GitHub Actions para executar testes
e verificações de qualidade automaticamente.

### Próximas evoluções

- Evolução das integrações de ML e investigação já disponíveis no Streamlit.
- Integração com outras fontes de dados.
- Implantação utilizando Docker e Cloud.

O dashboard atual representa o MVP de visualização
e análise de qualidade de dados do LucOps AI.

## Machine Learning: comandos locais

A CLI de ML e independente da CLI principal. Requer o extra opcional `ml`
(`python -m pip install -e ".[ml]"`). Use o mesmo ambiente e as mesmas versoes
de dependencias no treinamento e na analise.

Exemplo no PowerShell, a partir da raiz do projeto:

```powershell
.\.venv\Scripts\python.exe -m lucops.ml train data/sample/transacoes.csv --model models/isolation_forest.joblib --model-version iforest-v1
.\.venv\Scripts\python.exe -m lucops.ml analyze data/sample/transacoes_invalidas.csv --model models/isolation_forest.joblib --output reports/anomalies.json
```

O treinamento usa apenas registros elegiveis e exige pelo menos dois.
Salva o modelo e o arquivo acompanhante `isolation_forest.joblib.json`, com
versao, atributo `valor`, parametros, versao do Scikit-learn, quantidade de
registros usados e checksum. Mantenha os dois arquivos juntos. Caminhos de
saida existentes nao sao sobrescritos; escolha outro nome para um novo treino.

A analise carrega o modelo sem treinar novamente. Retorna JSON no terminal
e, opcionalmente, em `--output`, com resultados por transacao e motivos dos
registros inelegiveis. Pontuacoes positivas indicam anomalias em relacao ao
limiar aprendido; nao sao probabilidades nem confirmacao de fraude.
Os status tradicionais de qualidade nao sao alterados.

Carregue somente artefatos locais confiaveis gerados por este projeto.
Joblib pode executar codigo ao carregar: metadados e checksum verificam
compatibilidade e integridade, mas nao autenticam a origem de um arquivo.
A versao do Scikit-learn deve ser exatamente a usada no treinamento.
Os CSVs de exemplo demonstram o fluxo; nao validam a eficacia do modelo.

### Avaliacao reproduzivel

Execute `python -m lucops.ml.evaluation` para comparar Isolation Forest e
quantis em dados sinteticos separados de treino e avaliacao, sem gerar
artefatos. Consulte o [protocolo, resultados e limitacoes](docs/ml-evaluation.md).

### ML na API e no dashboard

Treine um modelo local com a CLI de ML antes de iniciar a API.
No terminal do servidor, configure o caminho do artefato confiavel:

```powershell
$env:LUCOPS_MODEL_PATH = (Resolve-Path models/isolation_forest.joblib).Path
.\.venv\Scripts\python.exe -m uvicorn lucops.api:app --reload
```

Mantenha o `.joblib` e seu `.joblib.json` juntos, com as mesmas versoes de
dependencias usadas no treino e o extra `ml` instalado no servidor.
O modelo e carregado na primeira analise, uma vez por processo/caminho.
Reinicie os workers apos substituir o modelo no mesmo caminho.
Nenhuma requisicao treina ou aceita modelos enviados por usuarios.

`POST /anomaly-analyses` recebe CSV no campo multipart `file`.
Retorna `model_version`, `evaluated_records`, `skipped_records`,
`anomalies_detected`, `results` e `ineligible`.
Resultados incluem indice, ID, valor original, pontuacao e `is_anomaly`;
registros ignorados preservam os motivos de qualidade.

- HTTP 200: inferencia concluida, inclusive CSV sem registros elegiveis.
- HTTP 400: estrutura CSV ou codificacao invalida.
- HTTP 422: arquivo ausente na requisicao.
- HTTP 503: modelo nao configurado, ausente, corrompido ou incompativel,
  ou dependencias opcionais de ML indisponiveis.

Os contratos de `/health` e `/analyses` permanecem inalterados.

No dashboard, envie o CSV em **Nova analise** e use **Detectar anomalias**
na secao de Machine Learning. A analise de qualidade continua disponivel
pelo botao **Analisar dados**. Os resultados sao independentes.
O painel de ML mostra contagens, versao do modelo, tabela de transacoes
sinalizadas e motivos dos registros ignorados. Trocar o arquivo limpa os
resultados anteriores. As tabelas de ML nao mudam o status de qualidade.

Os alertas estatisticos exigem investigacao, nao confirmam fraude e nao
representam probabilidades. O modelo utiliza apenas `valor`; a avaliacao
sintetica mostrou falsos positivos e nao valida eficacia em dados reais.
A API usa somente artefatos locais confiaveis configurados no servidor.

## Fase 6: investigação com IA

O motor de investigação combina regras de qualidade, informações do modelo de
anomalias e ferramentas locais. Cada investigação identifica o CSV pelo hash e
a transação pelo índice do registro, inclusive quando o ID está vazio ou
duplicado. Evidências verificadas, hipóteses não confirmadas, recomendações e
limitações aparecem em campos separados. Não há correção automática.

Para experimentar localmente sem chave ou internet:

```powershell
.\.venv\Scripts\python.exe -m lucops.agents investigate data/sample/transacoes_invalidas.csv --record-index 2 --provider simulated
```

Com a API e o dashboard iniciados, envie um CSV em **Nova análise**, escolha
o registro na seção **Investigação com IA** e clique em **Investigar com IA**.
O endpoint `POST /investigations` recebe `file`, `record_index` (começando em 1)
e `provider` (`simulated` por padrão ou `openai`) como multipart/form-data.
Retorna o contexto, as evidências, hipóteses, recomendações, limitações, modo
e provedor. Índice ausente ou inválido retorna 422; índice fora do CSV, 404;
CSV inválido, 400; provedor real indisponível, 503.

O modo simulado é determinístico e não chama um LLM. O modo OpenAI usa a
Responses API somente quando selecionado, com chave exclusivamente no backend
e limite local de chamadas inicialmente zero. Nenhum CSV inteiro ou chave é
enviado ao modelo. Falhas não alternam para respostas simuladas. Consulte
[configuração e controles](docs/ai-investigation.md) e
[avaliação e revisão humana](docs/ai-investigation-evaluation.md).
Alertas estatísticos não são probabilidades nem confirmação de fraude.
A Fase 6 foi concluída; o provedor OpenAI real continua sujeito a revisão e autorização explícita antes de qualquer chamada paga.

Na seção **Investigação com IA**, a visão de negócio apresenta em português
o registro, a qualidade, a situação do ML, as evidências principais com
referências curtas, hipóteses não confirmadas, recomendações e limitações
essenciais. **Ver detalhes técnicos** contém as referências SHA-256 completas,
origens, pontuações e o JSON integral para auditoria. A resposta simulada usa
textos determinísticos em português e é identificada como tal; o prompt do
provedor OpenAI solicita português brasileiro, mas o modo real ainda requer
validação manual antes de uso.
