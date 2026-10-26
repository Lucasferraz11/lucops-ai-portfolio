# Frontend LucOps AI — Fase 7, Etapa 7.4

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

Abra `http://localhost:5173`, selecione ou arraste um CSV e clique em **Analisar qualidade**. Durante o desenvolvimento, o Vite encaminha `/health` e `/analyses` para `http://127.0.0.1:8000`; o navegador usa requisições de mesma origem. Para outra configuração de publicação, `VITE_API_BASE_URL` pode definir a URL-base do cliente, desde que haja um proxy de mesma origem ou CORS autorizado pelo servidor. No PowerShell desta máquina, `npm.cmd` evita o bloqueio de execução do shim `npm.ps1`.

O formulário envia `FormData` com os campos `file` e `include_details=true`, na mesma requisição. A API retorna `quality_status`, `summary` (`total_records`, `valid_records`, `invalid_records`, `total_issues`, `valid_percentage`) e, quando disponível, `details`. A análise de qualidade não calcula anomalias: o respectivo indicador permanece **Não analisado**. A seleção de outro CSV descarta resultados anteriores e cancela a requisição em andamento.

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

Os cinco links do menu funcionam. A Visão Geral e a página Qualidade dos Dados mostram os agregados reais do CSV atual, incluindo um gráfico de rosca calculado a partir de registros válidos e inválidos. As páginas de Anomalias, Investigações e Relatórios ainda exibem estados de preparação. A integração de ML, agentes e relatórios pelo frontend fica para próximas entregas.

## Tabela de inconsistências

A página Qualidade dos Dados reutiliza o mesmo resultado dos indicadores. `details.items` fornece `record_index`, `field`, `description` e `rule`. O índice começa em 1 e conta registros de dados, sem o cabeçalho; um registro pode aparecer várias vezes por ter mais de um problema. **Ver regra** expõe o identificador original da regra, sem renomeá-lo. Valores brutos e identificadores pessoais não são incluídos nesse contrato.

A pesquisa por índice (por exemplo, `2` ou `#2`) ou descrição combina-se com os filtros por campo e regra. As opções são derivadas dos itens recebidos, a filtragem é local e não solicita outra análise. Os indicadores agregados não mudam com os filtros. **Limpar filtros** restaura a lista; os filtros também são limpos quando muda a análise. Não há edição, correção automática ou exportação.

A API retorna no máximo 200 ocorrências detalhadas. `returned_issues`, `total_issues`, `limit` e `truncated` descrevem esse limite. Se `truncated=true`, existem outras ocorrências no CSV que não estão disponíveis para filtragem; o resumo continua abrangendo o arquivo inteiro. Uma lista vazia, detalhes ausentes e filtros sem resultados recebem mensagens distintas. A ausência de `details` não é interpretada como ausência de inconsistências.

Para validar manualmente, analise `data/sample/transacoes_invalidas.csv`: são esperados 4 registros, 1 válido, 3 inválidos e 3 inconsistências. O filtro `valor` apresenta os registros 2 e 3; `cliente_id`, o registro 4. Teste também a navegação pelo teclado, abertura e fechamento do menu móvel e resoluções de 1440, 768 e 390 px. Os testes de componentes simulam as mudanças de resolução; a avaliação visual e da ordem de foco deve ser feita no navegador.
