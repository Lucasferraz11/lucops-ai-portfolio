# Preparação para demonstração gratuita no Render

[README](../README.md) · [Desenvolvimento](development.md) · [Arquitetura](architecture.md)

Esta entrega prepara arquivos e proteções. Nenhum serviço foi criado ou publicado.
O `render.yaml` é uma referência para a publicação posterior, após aprovação.
Conectar um Blueprint pode disparar o primeiro deploy mesmo com auto-deploy desligado;
não o conecte nesta etapa.

## Serviços e comandos

| Configuração | Backend | Frontend |
| --- | --- | --- |
| Tipo | Web Service, Python | Static Site |
| Plano | Free, explicitamente | Gratuito; sem instância de backend |
| Branch futura | main, após integrar esta entrega | main |
| Root Directory | Raiz do repositório | frontend |
| Versão | Python 3.13, via .python-version | Node 22.x, via frontend/.node-version |
| Build | Comando abaixo | npm ci && npm run build |
| Start | Comando abaixo | Não se aplica |
| Publicação | Porta fornecida pelo Render | dist |
| Health check | /health | Não se aplica |

Backend, na raiz:

```sh
pip install -r requirements-render.txt && pip install --no-deps . && python scripts/prepare_render_model.py
```

Start de produção:

```sh
uvicorn lucops.api:app --host 0.0.0.0 --port $PORT --workers 1
```

Não use `--reload` em produção. O frontend tem `SKIP_INSTALL_DEPS=true` no
Blueprint para instalar exclusivamente pelo lockfile com `npm ci`.
O fallback de React Router é Rewrite `/*` → `/index.html`, preservando
os arquivos estáticos existentes. Apenas `frontend/dist` é publicado no site.

`autoDeployTrigger: "off"` impede deploy automático a cada commit, mas não impede
o deploy inicial ao criar serviços. Não há discos, banco de dados, SDK OpenAI ou
serviços pagos definidos no Blueprint.

## Comunicação e variáveis

Não existem URLs públicas definidas nesta preparação. Na publicação autorizada:

1. Crie o backend e copie sua URL HTTPS real no painel do Render.
2. No Static Site, configure `VITE_API_BASE_URL` com essa URL, sem caminho extra.
3. Copie a origem HTTPS real do Static Site e configure
   `LUCOPS_CORS_ORIGINS` no backend.
4. Refaça o build do frontend se mudar `VITE_API_BASE_URL`; é uma variável de build.
5. Reinicie o backend se mudar limites ou CORS; são lidos ao iniciar a aplicação.

Não use URL interna de serviço no navegador, nem HTTP entre serviços públicos.
O proxy Vite local continua funcionando sem `VITE_API_BASE_URL`.
Variáveis `VITE_*` são públicas; nunca devem conter chaves.

| Variável do backend | Padrão local | Valor preparado no Render |
| --- | --- | --- |
| LUCOPS_MAX_CSV_BYTES | 5242880 (5 MiB) | 5242880 |
| LUCOPS_MAX_CSV_RECORDS | 10000 | 10000 |
| LUCOPS_MAX_CONCURRENT_ANALYSES | 2 | 1 |
| LUCOPS_CORS_ORIGINS | vazio, sem CORS externo | Origem HTTPS real do frontend |
| LUCOPS_MODEL_PATH | sem modelo configurado | models/render-isolation-forest.joblib |
| LUCOPS_AGENT_OPENAI_MAX_CALLS | 0 | 0 |
| OMP_NUM_THREADS / OPENBLAS_NUM_THREADS / MKL_NUM_THREADS | Ambiente local | 1 |

CORS aceita origens HTTP/HTTPS explícitas separadas por vírgula. Não aceita
`*`, curingas, credenciais, caminhos ou origem `null`. Não habilita cookies
nem credenciais cross-origin. CORS não autentica usuários e não bloqueia clientes
que não sejam navegadores.

Não configure `OPENAI_API_KEY` no serviço de demonstração. O SDK não está nas
dependências de produção preparadas. O limite zero mantém chamadas reais
desativadas, e o React solicita somente o provedor determinístico `simulated`.
Não há fallback silencioso, autenticação ou correções automáticas.

## Limites e dados enviados

As proteções cobrem `/analyses`, `/anomaly-analyses` e `/investigations`:

- A requisição multipart é limitada antes do parsing, inclusive sem Content-Length.
- O corpo é copiado em blocos para um spool com até 64 KiB em memória; o restante
  usa armazenamento temporário. Há 256 KiB adicionais de orçamento para o envelope
  multipart; isso não aumenta o limite efetivo do arquivo CSV.
- O CSV é copiado em blocos limitados e contado por registros lógicos, sem criar
  uma segunda lista em memória. Cabeçalho e quebras dentro de campos não aumentam
  a contagem de registros.
- O processamento existente só recebe arquivos dentro dos limites. As regras de
  qualidade, scores, índices e respostas de sucesso permanecem iguais.
- O limite de concorrência cobre upload, parsing e processamento; é por processo,
  sem fila e sem quota distribuída. O worker único evita multiplicar esse orçamento.
- Temporários e slots são liberados também após erros. `/health` e preflight CORS
  não dependem de uma vaga de análise.

Excesso de bytes ou registros retorna **413**; servidor ocupado retorna **429**
com `Retry-After: 5`. O frontend mostra mensagens próprias, sem repetir detalhes
internos. Não há retry automático nem novas análises disparadas pelo cliente.
CSV inválido mantém HTTP 400 e parâmetros inválidos mantêm HTTP 422.

Os limites reduzem consumo; não substituem proteção contra abuso sustentado,
rate limiting distribuído ou controle de acesso. Não publique CSVs pessoais:
respostas de ML incluem ID e valor original, e relatórios exportados podem conter
informações da sessão. Use apenas dados sintéticos na demonstração pública.
O servidor não mantém histórico, e o frontend não salva o CSV em localStorage.

## Modelo reproduzível

O artefato local confiável exige **Scikit-learn 1.9.1**, com oito registros de treino.
O ambiente inspecionado usa joblib 1.6.0, NumPy 2.5.4 e SciPy 1.18.1.
`requirements-render.txt` fixa esses pacotes e a árvore de dependências de runtime,
sem instalar Streamlit, ferramentas de testes ou o SDK OpenAI.

O servidor não terá acesso aos arquivos ignorados de `models/`.
Por isso, o build gera um modelo demonstrativo pelo script
`scripts/prepare_render_model.py`, usando exclusivamente
`data/sample/transacoes.csv`, público e versionado. O script:

1. Exige Scikit-learn 1.9.1 e confere o SHA-256 do CSV revisado, normalizando CRLF/LF.
2. Reutiliza preparação, treinamento e persistência existentes: 100 árvores,
   random_state=42, contamination=auto e atributo valor.
3. Valida o artefato e seus metadados antes de disponibilizá-los.
4. Substitui somente seus dois arquivos fixos de demonstração em builds posteriores.

Saídas: `models/render-isolation-forest.joblib` e arquivo acompanhante `.json`,
com versão `iforest-render-demo-v1`. Permanecem ignorados pelo Git.
O modelo original `models/isolation_forest.joblib` não é alterado ou enviado.
O build não baixa modelos externos e não usa uploads ou dados privados como treino.

O treinamento acontece **durante o build**, antes de iniciar a API, nunca em
requisições, no health check ou durante inferência. O modelo é carregado e mantido
em cache por processo/caminho. Não carregue joblib de origem desconhecida:
checksum verifica integridade, não autentica a origem.

O modelo de oito exemplos serve para demonstrar o fluxo, não para validar eficácia
empresarial. Alertas estatísticos não são fraude, probabilidade ou severidade.
Consulte a [avaliação do ML](ml-evaluation.md).

## Limitações do plano gratuito

A documentação oficial informa 512 MB de memória no Free e suspensão após
15 minutos sem tráfego, com retomada que pode levar cerca de um minuto.
O cliente atual pode atingir seu timeout durante essa retomada: aguarde o
`/health` responder e repita a ação; não há retentativa automática.
O polling existente da interface pode manter a API ativa enquanto a aba estiver aberta.

Arquivos locais são efêmeros. Os artefatos do build precisam ser regenerados em
cada build; uploads e relatórios não devem depender de persistência.
Não configure disco persistente pago. Um worker, bibliotecas numéricas com uma
thread e limites conservadores reduzem consumo, mas o uso real de RAM precisa ser
medido no primeiro deploy autorizado. O limite de registros também limita o JSON
de ML, que inclui resultados de todo o lote elegível.

O Free compartilha 750 horas mensais por workspace; tráfego e minutos de build
também têm franquias. Revise os limites no painel e não habilite upgrades pagos.
É uma demonstração pública, não uma configuração de produção empresarial.

## Validação antes e depois da publicação

Antes: execute os [testes e verificações locais](development.md#testes-e-qualidade-de-código).
Os testes de limites usam dados sintéticos; o teste do modelo valida reconstrução
com finais de linha de Windows e Linux. Nenhuma chamada real à OpenAI é necessária.

No primeiro deploy autorizado, conferir:

- Build Linux/Python 3.13 com as versões fixadas e geração dos dois artefatos.
- Health 200, CORS somente para o frontend real e erro 413/429 seguro.
- Navegação direta nas cinco rotas e download PDF.
- Qualidade, ML e investigação simulada independentes.
- Upload no limite, troca de arquivo e recuperação após cold start.
- Memória, temporários, logs sem dados dos CSVs e consumo da franquia gratuita.

Validar o YAML no painel/CLI do Render antes da criação dos serviços; não foram
instaladas ferramentas adicionais nem chamado o endpoint de deploy nesta entrega.

## Referências oficiais

- [Free e suas limitações](https://render.com/docs/free).
- [Planos e memória](https://render.com/pricing).
- [Versão Python](https://render.com/docs/python-version).
- [Versão Node](https://render.com/docs/node-version).
- [Blueprint YAML](https://render.com/docs/blueprint-spec).
- [Static Sites](https://render.com/docs/static-sites).
- [Fallback e rewrites](https://render.com/docs/redirects-rewrites).
