# LucOps AI

**Qualidade de dados, detecção de anomalias e investigação orientada por evidências.**

O LucOps AI analisa transações em CSV e reúne indicadores, inconsistências,
alertas estatísticos e recomendações para revisão humana em uma plataforma web.

## O problema

Regras de qualidade encontram campos ausentes, valores inválidos e duplicidades.
Mesmo registros válidos podem conter valores atípicos que exigem investigação.
A plataforma separa essas duas análises e apresenta as evidências disponíveis,
sem transformar hipóteses em causas comprovadas.

## Principais funcionalidades

- **Qualidade de CSV:** campos obrigatórios, valores financeiros, unicidade,
  indicadores e detalhes de inconsistências por registro.
- **Machine Learning:** Isolation Forest previamente treinado, resultados por
  transação, pontuações e motivos de inelegibilidade.
- **Investigações:** ferramentas locais determinísticas com evidências rastreáveis,
  hipóteses não confirmadas, recomendações e limitações.
- **Dashboard React:** Visão Geral, Qualidade, Anomalias, Investigações e Relatórios.
- **Relatórios:** consolidação da sessão e exportação PDF executiva no navegador;
  a CLI Python também gera relatórios de qualidade em TXT.
- **API FastAPI:** upload de CSV, respostas JSON e documentação interativa.
- **Interface Streamlit:** permanece disponível como alternativa ao React.

Qualidade, ML e investigação são independentes. Alertas estatísticos e scores
não comprovam fraude nem representam probabilidades ou severidade.
O provedor `simulated` é determinístico e não utiliza LLM externo.

**Disponibilidade:** o frontend React reúne qualidade, anomalias, investigações,
relatórios da sessão e exportação PDF. Os resultados permanecem em memória,
e o PDF é gerado localmente no navegador, mediante ação explícita.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router |
| Backend e interfaces | Python, FastAPI, Uvicorn, Streamlit |
| ML e PDF | Scikit-learn, joblib, jsPDF |
| Qualidade e testes | Pytest, Vitest, Testing Library, Ruff, ESLint, GitHub Actions |

O adaptador OpenAI é opcional; chamadas reais ficam bloqueadas por padrão.
Seu uso depende de configuração no backend, autorização e avaliação específica.

## Arquitetura resumida

```text
frontend/       Dashboard React, cliente HTTP, estado da sessão e PDF
src/lucops/     API e núcleo Python de qualidade, ML e investigação
dashboard/      Interface Streamlit
tests/          Testes Python e fixtures
docs/           Arquitetura, desenvolvimento e avaliações
bruno/          Coleção de requisições HTTP
data/sample/    CSVs de exemplo
```

React e Streamlit consomem a FastAPI, que reutiliza os módulos Python.
Os resultados React permanecem na memória da sessão; não há banco de dados,
autenticação ou histórico persistente. Consulte a [arquitetura](docs/architecture.md).

## Como executar localmente

Requer Python ≥3.10 e Node.js 22.x. Os comandos abaixo usam PowerShell,
na raiz do repositório. Não é necessário configurar uma chave OpenAI.

**Terminal 1 — instalar o ambiente Python e iniciar a API:**

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev,dashboard,ml]"
$env:LUCOPS_AGENT_OPENAI_MAX_CALLS = '0'
.\.venv\Scripts\python.exe -m uvicorn lucops.api:app --reload
```

**Terminal 2 — instalar e iniciar o frontend:**

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Abra [o dashboard](http://localhost:5173) e envie um CSV na Visão Geral.
A API oferece [Swagger UI](http://127.0.0.1:8000/docs).
Para inferência de ML, configure um modelo local confiável em
`LUCOPS_MODEL_PATH`, conforme o [guia de desenvolvimento](docs/development.md#modelo-local-de-ml).

## Testes e verificações

**Python, na raiz, após instalar os extras indicados acima:**

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
```

**Frontend, dentro de `frontend/`:**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

O build verifica TypeScript. Os testes isolados usam mocks e dados sintéticos,
sem chamadas pagas à OpenAI. Os workflows Python e frontend são independentes.

## Documentação

- [Preparação para demonstração gratuita no Render](docs/render-deployment.md).
- [Arquitetura, módulos e contratos HTTP](docs/architecture.md).
- [Instalação, configuração, CLI, Streamlit e testes](docs/development.md).
- [Frontend: contratos, estados, PDF e validação da interface](frontend/README.md).
- [Avaliação e limitações do Machine Learning](docs/ml-evaluation.md).
- [Investigação: provedores e controles de segurança](docs/ai-investigation.md).
- [Avaliação das investigações e revisão humana](docs/ai-investigation-evaluation.md).
