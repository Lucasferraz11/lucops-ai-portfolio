# Desenvolvimento local

[Apresentação](../README.md) · [Arquitetura e contratos](architecture.md)

Este guia concentra os procedimentos de instalação, configuração e execução.
Os comandos usam PowerShell e partem da raiz do repositório, salvo indicação.

## Pré-requisitos e instalação

- Python ≥3.10, conforme `pyproject.toml`; o CI Python utiliza 3.13.
- Node.js 22.x e npm; o frontend utiliza Vite 6 e o CI utiliza Node 22.x.
- Os CSVs públicos de demonstração estão em `data/sample/`.
- Não é necessário configurar chave OpenAI para usar o modo simulado.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev,dashboard,ml]"
```

Os extras `dev`, `dashboard` e `ml` permitem executar a suíte Python completa.
O extra `dashboard` instala Streamlit e Requests; `ml` instala Scikit-learn e
joblib. O SDK OpenAI é opcional, no extra `agents`, e não é necessário para esta
execução. Usar o extra não autoriza chamadas externas.

```powershell
cd frontend
npm.cmd ci
```

`npm ci` usa `frontend/package-lock.json`. Em outros ambientes, pode-se utilizar
`npm`; no PowerShell, `npm.cmd` evita o bloqueio do shim `npm.ps1`.
Para os comandos seguintes na raiz, retorne com `cd ..`.

## API e React

**Terminal 1, na raiz:**

```powershell
$env:LUCOPS_AGENT_OPENAI_MAX_CALLS = '0'
.\.venv\Scripts\python.exe -m uvicorn lucops.api:app --reload
```

- API: http://127.0.0.1:8000
- Disponibilidade: http://127.0.0.1:8000/health
- Swagger UI: http://127.0.0.1:8000/docs

**Terminal 2, na raiz:**

```powershell
cd frontend
npm.cmd run dev
```

Abra http://localhost:5173. O proxy Vite encaminha `/health`, `/analyses`,
`/anomaly-analyses` e `/investigations` para a API local, sem alterar CORS no
backend. Para outra configuração, `VITE_API_BASE_URL` define a URL-base pública
do cliente; exige proxy de mesma origem ou CORS autorizado no servidor.
Variáveis `VITE_*` podem ser expostas no navegador: nunca coloque segredos nelas.

O comando de inicialização da FastAPI não carrega `.env` automaticamente; o Vite
possui seu próprio tratamento de arquivos de ambiente para o frontend.
Configure variáveis no terminal que inicia o servidor e reinicie-o ao alterá-las.
Definir variáveis em outro terminal não altera um processo já em execução.

### Fluxo de uso

1. Envie um CSV na Visão Geral e execute a qualidade explicitamente.
2. Consulte indicadores, distribuição e inconsistências em Qualidade dos Dados.
3. Com um modelo configurado, execute ML em Detecção de Anomalias.
4. Selecione o índice e solicite uma investigação em modo simulado.
5. Consulte Relatórios e solicite a exportação PDF, gerada no navegador.

Qualidade, ML e investigação não são disparados automaticamente uns pelos outros.
Os resultados são da sessão em memória; trocar o CSV limpa as análises.
A página de Relatórios consolida os resultados disponíveis sem novas análises.
O PDF é gerado localmente por ação explícita, sem histórico persistente.
Os [estados da interface e roteiros de validação](../frontend/README.md) descrevem
filtros, truncamento, falhas, navegação, evidências e detalhes técnicos.

## CSV e CLI de qualidade

O esquema de transações exige as colunas `id_transacao`, `cliente_id` e `valor`.
O CSV usa vírgula como separador e UTF-8; valores financeiros devem ser positivos
e ter no máximo duas casas decimais. O identificador deve ser único.
No arquivo, use ponto decimal (por exemplo, `1234.56`); a apresentação pt-BR
da interface não altera os dados originais.

```powershell
.\.venv\Scripts\python.exe -m lucops data/sample/transacoes_invalidas.csv
```

A saída padrão é `reports/quality_report.txt`. Para escolher outra:

```powershell
.\.venv\Scripts\python.exe -m lucops data/sample/transacoes_invalidas.csv --output reports/minha_analise.txt
```

Exemplos úteis: `transacoes_validas.csv`, `transacoes_invalidas.csv`,
`transacoes_vazias.csv` (apenas cabeçalho), `transacoes_sem_cliente.csv`
e `teste_anomalias.csv`. Os arquivos demonstram fluxos, não eficácia empresarial.

## Modelo local de ML

O treino é uma ação independente da inferência. Se ainda não houver artefato
confiável, execute conscientemente, sem sobrescrever um modelo existente:

```powershell
.\.venv\Scripts\python.exe -m lucops.ml train data/sample/transacoes.csv --model models/isolation_forest.joblib --model-version iforest-v1
```

O treino exige ao menos dois registros elegíveis. O comando salva `.joblib` e
`.joblib.json` com versão do modelo, atributos, parâmetros, versão Scikit-learn,
quantidade de registros e checksum. Mantenha os dois arquivos juntos.
Caminhos de saída existentes não são sobrescritos; escolha outro nome se necessário.

No terminal que inicia a API, configure o caminho e então inicie o servidor:

```powershell
$env:LUCOPS_MODEL_PATH = (Resolve-Path models/isolation_forest.joblib).Path
```

Se a API já estiver em execução, encerre-a no terminal original e reinicie com
essa variável. O cache reutiliza o modelo por processo/caminho; reinicie os workers
também quando substituir o modelo no mesmo caminho.

Para inferência pela CLI, sem novo treino:

```powershell
.\.venv\Scripts\python.exe -m lucops.ml analyze data/sample/transacoes_invalidas.csv --model models/isolation_forest.joblib --output reports/anomalies.json
```

O JSON aparece no terminal e pode ser salvo em um caminho ainda inexistente.
Use as mesmas versões de dependências no treino e na análise; a versão Scikit-learn
é validada exatamente. Carregue somente artefatos locais confiáveis gerados pelo
projeto. Joblib pode executar código; checksum e metadados não autenticam a origem.

Sem modelo válido, a qualidade continua disponível, a análise de anomalias informa
indisponibilidade e a investigação identifica o estado de ML. Isso não significa
zero anomalias. Os alertas não representam fraude, probabilidade ou severidade.

Para comparar Isolation Forest e quantis em dados sintéticos separados:

```powershell
.\.venv\Scripts\python.exe -m lucops.ml.evaluation
```

O comando não gera artefatos; consulte [protocolo, resultados e limites](ml-evaluation.md).

## Investigação determinística

```powershell
.\.venv\Scripts\python.exe -m lucops.agents investigate data/sample/transacoes_invalidas.csv --record-index 2 --provider simulated
```

O índice começa em 1, sem o cabeçalho. A opção `--no-ml` permite investigar sem
solicitar inferência. `--output reports/investigation.json` salva o JSON completo
em um caminho ainda inexistente. Nenhuma correção é executada.

O modo simulado funciona sem chave ou chamadas ao LLM. O React seleciona somente
esse provedor. O adaptador real permanece sujeito a revisão, autorização e limites
de gastos; mantenha `LUCOPS_AGENT_OPENAI_MAX_CALLS=0`.
A [documentação dos agentes](ai-investigation.md) concentra configurações, limites,
privacidade e pré-condições para OpenAI; não há fallback silencioso.

## Interface Streamlit

Com a API iniciada e o extra `dashboard` instalado, use outro terminal na raiz:

```powershell
.\.venv\Scripts\python.exe -m streamlit run dashboard/app.py
```

Abra http://localhost:8501. Envie o CSV em **Nova análise**, execute qualidade,
detecção de anomalias ou investigação pelos respectivos controles.
A Visão de negócio mantém resumo, hipóteses e recomendações separados; os detalhes
técnicos preservam referências, scores e JSON.

`LUCOPS_API_URL` configura a URL-base da API para o Streamlit; o padrão é
`http://127.0.0.1:8000`. Também pode ser configurada em secrets do Streamlit.
O React não utiliza essa variável.

A configuração Vercel existente permanece em `pyproject.toml`, com entrypoint
`src.lucops.api:app`; o comando local continua `lucops.api:app`. API e Streamlit
são serviços separados. Se houver publicação externa, use a URL da API em
`LUCOPS_API_URL` e verifique `/health`; a raiz não é endpoint da API.
No Streamlit Community Cloud, essa variável pode ser definida em
**App settings > Secrets**, seguida de reinício. Essas orientações não afirmam
que exista um deploy ativo; publicação não faz parte desta entrega.

## Testes e qualidade de código

Na raiz, com os extras de desenvolvimento instalados:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
```

Para verificar somente o dashboard: `python -m pytest tests/test_dashboard.py -v`
com o ambiente virtual ativado. Para alterações deliberadas de formatação,
`python -m ruff format .`; `python -m ruff check . --fix` aplica correções
suportadas. Esses comandos modificam arquivos; não são verificações de leitura.

Dentro de `frontend/`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

O build executa `tsc -b` e Vite. Os testes frontend usam mocks e não exigem
API ou Vite ativos. Os testes de provedores não fazem chamadas pagas à OpenAI.
JSDOM não comprova renderização, responsividade ou rolagem real no navegador.
Não use contagens históricas de testes como resultado de uma execução atual.

### Coleção Bruno

Com a API ativa, abra `bruno/lucops-api/` no Bruno, selecione uma requisição,
clique em **Send** e consulte **Tests**. A coleção cobre disponibilidade (200),
qualidade (200), CSV inválido (400), arquivo ausente (422) e endpoint inexistente
(404). O Swagger permite testar os demais endpoints e solicitar
`include_details=true` em `POST /analyses`.
Consulte os [contratos e limites](architecture.md#contratos-http).

### Integração contínua

O [CI Python](../.github/workflows/ci.yml) executa em qualquer push e em PRs destinados à `main`,
instala `.[dev,dashboard,ml]`, executa Ruff e Pytest com Python 3.13.
O [CI frontend](../.github/workflows/frontend-ci.yml) executa em pushes para
`main` e `feat/**`, além de PRs para `main`; usa Node 22.x, `npm ci`, testes,
lint e build dentro de `frontend/`, com cache baseado no lockfile.

A verificação de formatação Python acima é local; não é uma etapa do CI atual.
Os workflows não realizam deploy. A execução local não comprova aprovação remota.

## Arquivos locais e privacidade

Não versione chaves, `.env`, ambientes virtuais, dependências, builds, caches,
dados privados ou artefatos gerados. `models/` e `reports/` são saídas locais.
A sessão React não mantém conteúdo do CSV em localStorage ou banco de dados.
Os 11 arquivos locais do Stitch em `design/stitch-reference/` devem permanecer
intactos e fora do staging; o frontend não depende deles para executar.
