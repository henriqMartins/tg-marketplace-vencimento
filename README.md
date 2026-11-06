# TG — Marketplace de produtos próximos ao vencimento

Mercadinhos de bairro publicam lotes de produtos perto do vencimento com desconto.
O consumidor **reserva** pelo celular (PWA), **retira e paga na loja** com um código
que o lojista digita, e o gestor acompanha **indicadores de negócio** em painéis.

Não há integração com sistema de caixa (PDV) nem com controle de estoque: toda a
informação nasce no cadastro do lote.

Trabalho de Graduação — Fatec Rio Preto, 2026 — Henrique Martins e Yan Henrry.

| Data | Marco |
|---|---|
| 09/11/2026 | Versão para a banca: o artigo descreve o sistema tela por tela |
| 17/11 a 02/12/2026 | Apresentação ao vivo, com o sistema no ar |

Este README é a **documentação oficial do repositório**. As decisões de projeto
ficam registradas no Contexto mestre (fora do repositório); aqui fica o resumo
necessário para entender e rodar o código.

---

## Sumário

1. [Estrutura do repositório](#1-estrutura-do-repositório)
2. [Arquitetura](#2-arquitetura)
3. [Regras do domínio](#3-regras-do-domínio)
4. [Funcionalidades do sistema](#4-funcionalidades-do-sistema)
5. [Stack e hospedagem](#5-stack-e-hospedagem)
6. [Como rodar e testar](#6-como-rodar-e-testar)
7. [Escopo](#7-escopo)
8. [Linha do tempo](#8-linha-do-tempo)

---

## 1. Estrutura do repositório

Legenda: ✅ existe · 🚧 planejado (ainda não existe)

```
/
├── README.md                 ✅ este documento
├── .env.example              ✅ variáveis de ambiente necessárias, sem valores reais
├── dominio/                  ✅ regras da reserva — Python puro, pacote instalável
│   ├── pyproject.toml           pacote "tg-dominio"
│   ├── src/dominio/__init__.py  Oferta, Reserva, estados e invariantes
│   └── tests/test_dominio.py    testes das regras
├── simulacao/                ✅ Monte Carlo + limiar de referência
│   ├── simulacao.py             modelo: roda cada comprador pelo pacote dominio
│   ├── limiar_referencia.py     compara com o cenário "sem plataforma"
│   ├── parametros.md            parâmetros, faixas e procedência de cada um
│   ├── test_*.py                testes da simulação e do limiar
│   ├── resultados/              gráficos e CSV (N = 1000)
│   └── resultados_n5000/        mesma rodada com N = 5000 (convergência)
├── spikes/spike_django/      ✅ prova dos 3 critérios do framework (referência, não é produção)
├── backend/                  ✅ API Django + DRF (vira a imagem Docker) — em construção
│   ├── config/                  configuração (só por variável de ambiente) e /health
│   ├── contas/                  usuário próprio (login único)
│   └── ofertas/                 Loja, Vínculo, Produto, Oferta, Reserva, Ajuste, Recusa
│       ├── models.py               tabelas e travas do banco
│       ├── servico.py              os 5 passos: transação → trava → reconstitui → regra → grava; varredura
│       ├── views.py                endpoint da varredura (POST /tarefas/varrer, com token)
│       ├── tests.py                testes das travas do banco
│       ├── test_servico.py         testes do serviço
│       ├── test_concorrencia.py    N pessoas ao mesmo tempo pela última unidade
│       └── test_varredura.py       varredura idempotente e endpoint protegido
├── docs/colinha-python.md    ✅ colinha de Python com exemplos do projeto
├── frontend/                 🚧 React + TypeScript + Vite, PWA (Vercel)
└── docker-compose.yml        ✅ só desenvolvimento local (PostgreSQL no Docker do WSL 2)
```

## 2. Arquitetura

```
 Consumidor (PWA)      Lojista (PWA)       Gestor (painéis)
        │                    │                    │
        └──────────── HTTPS / JSON ───────────────┘
                             │
                   backend/ (Django + DRF)
             transação + select_for_update()
                             │  importa
                             ▼
                   dominio/ (Python puro)  ◄── importa ── simulacao/
                             │
                      PostgreSQL (fonte oficial)
```

### Princípios (não quebrar)

1. **Regras em um lugar só.** `dominio/` é a única implementação da reserva.
   `backend/` e `simulacao/` **importam** o pacote; nenhum dos dois reimplementa
   regra nem copia o arquivo. É isso que permite afirmar no artigo que *a simulação
   executa a mesma lógica do sistema*.
2. **O domínio não conhece banco, HTTP, tela nem relógio.** Toda operação recebe
   `agora` em horas (número decimal). No backend: `agora = timestamp_unix / 3600`.
   Assim a simulação controla o relógio e os testes são reproduzíveis.
3. **Mudou uma regra do domínio?** Primeiro o teste, depois o código. Todos os
   testes do domínio e da simulação continuam passando.
4. **Concorrência é responsabilidade do backend.** Toda escrita numa oferta:
   abre transação → trava a linha com `select_for_update()` → reconstitui a
   `Oferta` do domínio a partir do banco → chama a regra → grava → confirma.
   A view nunca mexe no estoque diretamente.
5. **PostgreSQL é a fonte oficial**, inclusive da expiração (coluna `expira_em`).
   **Nunca SQLite**, nem em teste: no SQLite o `select_for_update()` não trava nada
   e o teste de concorrência passaria sem provar coisa alguma.
6. **Expiração sem worker separado:**
   - antes de reservar, cancelar, retirar ou ajustar → o domínio expira as vencidas daquela oferta;
   - na vitrine → o "livre" exibido já desconta as vencidas ainda não processadas;
   - ao abrir os painéis → varredura geral antes de calcular os indicadores;
   - reforço diário → o agendamento da Vercel chama um endpoint protegido por token
     (`CRON_TOKEN`), que varre reservas vencidas e encerra ofertas que passaram do fim.

   A varredura é **idempotente**: rodar duas vezes não devolve unidades em dobro.
7. **Configuração só por variável de ambiente** (`DATABASE_URL`, `DJANGO_SECRET_KEY`,
   `CRON_TOKEN`...). Nenhuma senha, chave ou URL de produção no código ou no git.
   Ver [.env.example](.env.example).

## 3. Regras do domínio

Implementadas em [dominio/src/dominio/\_\_init\_\_.py](dominio/src/dominio/__init__.py).

| Regra | Resumo |
|---|---|
| Lote | Separado fisicamente antes de publicar; `livre` nasce igual a `separado`. |
| Reserva | Por quantidade. Parcial automática: `min(pedido, livre)`. Livre = 0 → recusa. |
| Estados | `reservada → retirada \| expirada \| cancelada`. |
| Janela de reserva | Configurável pelo lojista; nunca passa do fim da oferta. |
| Devolução | Cancelamento e expiração devolvem ao livre **exatamente uma vez**. |
| Retirada | Tudo ou nada, com código; pagamento presencial. |
| Ajuste | O lojista só reduz o livre, com motivo; unidade reservada não é ajustada. |
| Fim da oferta | Automático na validade menos uma margem configurável; sobra livre vira **perda**. |
| Invariante | `separado = livre + reservado + retirado + ajustado + perda`, conferida a cada operação. |

**Limitação declarada do protótipo:** perda de unidade já reservada não é tratada.

### Operações da `Oferta`

| Método | O que faz |
|---|---|
| `reservar(pedido, agora)` | cria reserva (parcial se preciso) ou devolve `None` se não há livre |
| `cancelar(id_reserva, agora)` | cliente desiste; unidades voltam ao livre |
| `expirar_vencidas(agora)` | expira reservas cuja janela passou; devolve ao livre |
| `retirar(id_reserva, codigo, agora)` | confirma a retirada com o código |
| `ajustar_estoque(quantidade, motivo, agora)` | lojista reduz o livre (avaria, erro de contagem...) |
| `encerrar(agora)` | fecha a oferta; sobra livre vira perda |
| `verificar_invariantes()` | confere a conservação das unidades |

## 4. Funcionalidades do sistema

Descrição do que o sistema entrega. O andamento de cada item está na
[linha do tempo](#8-linha-do-tempo).

### Código de retirada
6 dígitos aleatórios (módulo `secrets`), no estilo de um código de autenticação.
O **lojista digita** o código na tela dele; o backend localiza a reserva ativa
**daquela loja** com esse código. O código é único entre as reservas ativas da mesma loja.

### Fitas coloridas (método de conferência)
- 6 cores fixas, uma por **bimestre de vencimento** (data absoluta, não tempo restante),
  ciclo anual, válidas para qualquer produto.
- Lote novo do mesmo produto e da mesma cor de um grupo ativo entra nesse grupo;
  a referência do grupo passa a ser a **data mais próxima**.
- **Aviso de colisão de ciclo:** lote remanescente da mesma cor do ano anterior ainda ativo.
- A fita acelera a conferência, mas não substitui a data: o aviso sempre mostra a data exata.

### Avisos e notificações
- Aviso de estoque/validade: **só para o lojista**, com antecedência configurada pela loja.
- Consumidor: notificação **apenas na publicação de oferta**, e só se ele permitiu.

### Proximidade
- Loja: coordenadas obtidas no cadastro do endereço.
- Consumidor: localização do navegador; se negar, CEP. **Nada disso é gravado**:
  converte em coordenada, ordena por distância e descarta.
- Distância calculada pela **fórmula de Haversine em SQL**. Sem PostGIS, sem mapa, sem rotas.

### Papéis (login único)
Uma tabela de usuários e **um login só**; o que cada pessoa pode fazer vem do seu
**vínculo** com a loja:

| Quem | Vínculo | Exemplo |
|---|---|---|
| Consumidor | nenhum — todo usuário pode reservar | Ana, que só compra |
| Responsável | loja X, papel responsável (lojista e gestor numa pessoa só) | o dono do mercadinho |
| Funcionário | loja X, papel funcionário | quem confere a gôndola |

Uma pessoa tem no máximo um vínculo por loja, mas pode ter vínculo com várias lojas.

### Margem do fim da oferta
A loja tem uma margem padrão (inicial: **1 dia**) e o produto pode ter a sua (opcional).
Ao publicar, o fim da oferta é **calculado e gravado** (validade − margem); mudar a
margem depois vale só para ofertas novas.

### Painéis do gestor
Indicadores de **negócio**, lidos direto do PostgreSQL, por período:
reservas criadas, taxa de retirada, taxa de expiração, compradores bloqueados
(recusa total ou parcial) e perda no encerramento.

### Simulação
Monte Carlo que responde **como a janela de reserva afeta o desperdício e o bloqueio
de compradores**. Cada ação dos compradores simulados passa pelo pacote `dominio`.
O resultado é **cenário projetado**, não previsão: os parâmetros entram como faixas,
cada um com sua procedência declarada em [simulacao/parametros.md](simulacao/parametros.md).

## 5. Stack e hospedagem

| Camada | Escolha |
|---|---|
| Domínio | Python puro (só biblioteca padrão), pacote `dominio` |
| Backend | Django + Django REST Framework, gunicorn, psycopg |
| Banco | PostgreSQL |
| Frontend | React + TypeScript, Vite, PWA |
| Simulação | Python + NumPy + Matplotlib |
| Ambiente local | Docker Engine nativo no WSL 2 + Compose (só o PostgreSQL); o Django roda no Windows |

Hospedagem, toda em plano gratuito:

| Serviço | O quê | Observações |
|---|---|---|
| Vercel | Frontend + agendamento diário | Cron do plano Hobby: 1×/dia, horário impreciso |
| Render | API (imagem Docker de `backend/Dockerfile`) | Dorme após ~15 min sem uso e leva ~1 min para acordar; o frontend mostra "carregando" nesse intervalo. O comando de início roda `migrate` e depois `gunicorn`, na porta `$PORT`. |
| Neon | PostgreSQL | Endereço **direto** (sem pooler), com `sslmode=require`, na mesma região da API (EUA Leste). |

**Dockerfile de produção** (`backend/Dockerfile`): multi-stage, usuário não-root,
`requirements.txt` copiado antes do código (aproveita cache), contexto de build na
raiz do repositório (precisa de `dominio/` e `backend/`), endpoint `/health` e
`.dockerignore` excluindo frontend, simulação, resultados, `.env` e testes.
O `docker-compose.yml` é só para desenvolvimento local.

## 6. Como rodar e testar

Tudo roda num **ambiente virtual** (`.venv/`, na raiz), não no Python geral.
Comandos para PowerShell, no Windows.

**Pré-requisitos (uma vez):**

```powershell
py -m venv .venv                         # na raiz: cria o ambiente virtual
.venv\Scripts\Activate.ps1               # ativa (o prompt passa a mostrar "(.venv)")
cd backend;   python -m pip install -r requirements.txt; cd ..   # domínio + Django/DRF/psycopg
cd simulacao; python -m pip install -r requirements.txt; cd ..   # domínio + NumPy/Matplotlib
copy .env.example .env                   # e preencha os valores (senhas só suas)
```

**Banco local (PostgreSQL 16 no Docker nativo do WSL 2):**

```powershell
wsl docker compose up -d --wait          # na raiz: liga o banco e espera ficar pronto
wsl docker compose stop                  # desliga (os dados ficam guardados)
```

O WSL desliga o Ubuntu sozinho quando nenhum programa do Windows o usa, e o banco cai
junto (sintoma: a conexão **trava** em vez de dar erro). Deixe um terminal do Ubuntu
aberto enquanto desenvolve.

**Testes** (com o `.venv` ativo; cada comando de dentro da pasta indicada):

```powershell
cd dominio;   python -m unittest discover -s tests -v   # regras da reserva
cd simulacao; python -m unittest -v                     # simulação e limiar
cd backend;   python manage.py test                     # backend (precisa do banco ligado)
```

O backend nunca usa SQLite: sem `DATABASE_URL` apontando para um PostgreSQL, ele
recusa ligar. Os testes criam e apagam sozinhos um banco temporário (`test_tg`).

**Teste de concorrência** (obrigatório): 20 pessoas ao mesmo tempo pela última
unidade → exatamente 1 reserva, 19 recusas, livre nunca negativo e conservação
fechando (5 rodadas). Também com 5 unidades e com reservas parciais.

```powershell
cd backend
python manage.py test ofertas.test_concorrencia
# controle negativo (tira a trava de propósito, para provar que o teste enxerga o erro):
$env:CONTROLE_NEGATIVO="1"; python manage.py test ofertas.test_concorrencia.TestControleNegativo; Remove-Item Env:CONTROLE_NEGATIVO
```

**Servidor local:** `python manage.py runserver` (em `backend/`) → `http://localhost:8000/health`
responde `{"status": "ok", "banco": "ok"}` (ou HTTP 503 se o banco estiver fora).

**Varredura** (a "ronda" diária: devolve reservas vencidas e encerra ofertas que passaram
do fim). Exige `CRON_TOKEN` no `.env`; sem ele, o endpoint responde 503 sempre.

```powershell
curl.exe -X POST http://localhost:8000/tarefas/varrer -H "Authorization: Bearer SEU_CRON_TOKEN"
# → {"expiradas": 0, "encerradas": 0, "perda": 0, "puladas": 0}
```

Sem token → 401 · token errado → 403 · GET → 405. Rodar duas vezes seguidas não devolve
nada em dobro (idempotente). Oferta sendo usada por outra operação naquele instante é
pulada e entra na próxima ronda.

**Rodar a simulação:**

```powershell
cd simulacao
python simulacao.py              # N = 1000, semente 2026, gráficos em resultados/
python simulacao.py --n 5000     # mais repetições
python limiar_referencia.py      # lê resultados/rodadas.csv e calcula o limiar
```

Regra da casa: **nenhum teste existente pode quebrar.**

## 7. Escopo

**Fora de escopo** (não será adicionado):
- Redis, cache, filas, Celery, worker separado.
- Observabilidade (Prometheus, Grafana, Loki) ou métricas técnicas como entrega.
- CI/CD e publicação automática a cada push.
- PostGIS, mapa, rotas, geofencing.
- Integração com PDV, importação de planilha, pagamento online, entrega, WhatsApp.

**Decisões ainda em aberto:**
- Login do consumidor e tipo de token da API (recomendação até aqui: token do próprio DRF).
- Permissões de cada papel (responsável, funcionário) — etapa 6.
- Serviço de push para a notificação de oferta nova.
- Serviço que converte CEP/endereço em coordenada.

---

## 8. Linha do tempo

Atualizada a cada passo concluído. Um item só entra como ✅ depois de existir
**e** ter sido verificado (a coluna "Verificação" diz como).

Legenda: ✅ concluído · 🔄 em andamento · ⏳ a fazer

### Concluído

| Data | Entrega | Verificação |
|---|---|---|
| 14/10/2026 | Parâmetros da simulação v0 aprovados pela dupla | [parametros.md](simulacao/parametros.md) |
| 15/10/2026 | Revisão dos parâmetros (lote, validade restante, tamanho do pedido) com fontes | [parametros.md](simulacao/parametros.md) |
| 20/10/2026 | Spike Django + DRF + PostgreSQL: concorrência, expiração e migrações | Com trava: 1 sucesso e 19 recusas em 5 rodadas de 20 clientes; sem trava, a conservação quebrou ([relatório](spikes/spike_django/README.md)) |
| 21/10/2026 | Repositório organizado; domínio vira pacote instalável (`tg-dominio`) | Domínio: 21 testes ok · Simulação: 16 testes ok |
| 21/10/2026 | Resultados da simulação versionados (gráficos, `rodadas.csv`, `limiar_referencia.csv`) | Arquivos em [simulacao/resultados/](simulacao/resultados/) |
| 21/10/2026 | README como documentação oficial | — |
| 22/10/2026 | Domínio: `Oferta.reconstituir()` — remonta a oferta a partir do banco e recusa estado impossível | Domínio: 34 testes ok (13 novos, escritos antes do código) |
| 22/10/2026 | Ambiente: PostgreSQL 16 no Docker nativo do WSL 2; `.venv` na raiz | Banco `healthy`; porta 5432 acessível pelo Windows |
| 22/10/2026 | Backend (etapa 1): projeto Django, configuração só por ambiente, `/health` | 4 testes; `/health` dá 200 com banco ligado e 503 com banco desligado |
| 23/10/2026 | Backend (etapa 2): modelos e travas do banco; papéis por vínculo; margem por loja/produto | 26 testes; migrações aplicadas, desfeitas e reaplicadas |
| 23/10/2026 | Backend (etapa 3): serviço de reserva (5 passos com `select_for_update()`), código de retirada único por loja entre ativas | 41 testes |
| 26/10/2026 | Backend (etapa 4): teste de concorrência + controle negativo | 20 clientes × 5 rodadas: 1 reserva e 19 recusas em todas; **sem a trava, 20 de 20 receberam "reservado" pela mesma unidade** em todas as rodadas · backend: 44 testes ok |

| 05/11/2026 | Backend (etapa 5): varredura idempotente + endpoint `POST /tarefas/varrer` protegido por `CRON_TOKEN` | 11 testes (rodar 2× não devolve em dobro; oferta travada é pulada; 401/403/405/503) · backend: 55 testes ok |

### Próximos passos

| Status | Entrega |
|---|---|
| ⏳ | Fechar decisões em aberto (login/token, permissões, push, geocodificação) |
| ⏳ | Backend (etapa 6): login e papéis |
| ⏳ | Backend (etapa 7): endpoints da reserva (publicar, vitrine, reservar, cancelar, retirar) |
| ⏳ | Backend: fitas coloridas e aviso de colisão de ciclo |
| ⏳ | Backend: proximidade por Haversine em SQL |
| ⏳ | Backend: indicadores dos painéis |
| ⏳ | Frontend: telas do consumidor (vitrine, reserva, código) |
| ⏳ | Frontend: telas do lojista (cadastro de lote, fitas, retirada, ajuste, avisos) |
| ⏳ | Frontend: painéis do gestor |
| ⏳ | Notificação de oferta nova |
| ⏳ | `backend/Dockerfile` de produção + deploy (Render, Neon, Vercel) |
| ⏳ | Capturas de tela para o artigo |
| ⏳ | **09/11/2026** — versão para a banca |
| ⏳ | **17/11 a 02/12/2026** — apresentação ao vivo |
