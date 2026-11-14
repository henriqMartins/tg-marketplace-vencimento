# TG — Marketplace de produtos próximos ao vencimento

Mercadinhos de bairro publicam lotes de produtos perto do vencimento com desconto.
O consumidor **reserva** pelo celular (PWA), **retira e paga na loja** com um código
de 6 dígitos que o lojista digita, e o dono acompanha **indicadores de negócio** em painéis.

Sem integração com sistema de caixa (PDV) nem com controle de estoque: toda a
informação nasce no cadastro do lote. Sem pagamento online e sem entrega.

Trabalho de Graduação — Fatec Rio Preto, 2026 — Henrique Martins e Yan Henrry.

## Situação (14/11/2026)

| Parte | Situação |
|---|---|
| Domínio (regras da reserva) | ✅ pronto — 53 testes |
| Backend (API) | ✅ todos os grupos do contrato (A a G) — 279 testes + 1 pulado |
| Simulação (Monte Carlo) | ✅ pronta, resultados no artigo — 16 testes |
| Frontend (PWA) | 🔄 todas as telas prontas contra um **mock** do contrato (branch `frontend`); integração com a API real em andamento |
| Vídeo do sistema | ⏳ para a apresentação final (17/11 a 02/12/2026) |
| Deploy | ⏳ só se sobrar tempo (o vídeo pode ser gravado com o sistema local) |

| Data | Marco |
|---|---|
| 09/11/2026 | Versão para a banca: o artigo descreve o sistema tela por tela, pelos protótipos |
| 17/11 a 02/12/2026 | Apresentação final: o sistema real é mostrado num vídeo |

---

## Sumário

1. [Como funciona](#1-como-funciona)
2. [Arquitetura](#2-arquitetura)
3. [Regras do domínio](#3-regras-do-domínio)
4. [Funcionalidades](#4-funcionalidades)
5. [Estrutura do repositório](#5-estrutura-do-repositório)
6. [Stack e hospedagem](#6-stack-e-hospedagem)
7. [Como rodar](#7-como-rodar)
8. [Testes](#8-testes)
9. [API](#9-api)
10. [Escopo](#10-escopo)
11. [Linha do tempo](#11-linha-do-tempo)

---

## 1. Como funciona

1. A loja **cadastra o lote** que chegou (produto, validade, quantidade). O sistema dá ao
   lote a **cor da fita** do bimestre de vencimento e agrupa lotes iguais.
2. Alguns dias antes da validade, a loja recebe um **aviso**, confere a gôndola pela fita,
   separa as unidades e **publica uma oferta** com desconto.
3. O consumidor vê a **vitrine** ordenada por distância e **reserva** uma quantidade. Recebe
   um **código** e um prazo ("retire até 20:00").
4. Na loja, o funcionário **digita o código**; o cliente paga no caixa e leva.
5. Reserva não retirada no prazo **expira** e a unidade volta a ficar livre. No fim da
   oferta, a sobra vira **perda**.
6. O dono vê no **painel** reservas, retiradas, expirações, compradores que ficaram sem
   produto e perda; e na **projeção** compara janelas de reserva com a simulação do artigo.

## 2. Arquitetura

```
 Consumidor (PWA)      Loja (PWA)        Dono (painéis)
        │                   │                   │
        └─────────── HTTPS / JSON ──────────────┘
                            │
                  backend/ (Django + DRF)
            transação + select_for_update()
                            │  importa
                            ▼
                  dominio/ (Python puro)  ◄── importa ── simulacao/
                            │
                     PostgreSQL (fonte oficial)
```

### Princípios

1. **Regras em um lugar só.** `dominio/` é a única implementação da reserva.
   `backend/` e `simulacao/` **importam** o pacote; nenhum dos dois reimplementa regra.
   Por isso *a simulação executa a mesma lógica do sistema*.
2. **O domínio não conhece banco, HTTP, tela nem relógio.** Toda operação recebe
   `agora` em horas; no backend, `agora = timestamp_unix / 3600`. A simulação controla o
   relógio e os testes são reproduzíveis.
3. **Mudou uma regra?** Primeiro o teste, depois o código.
4. **Concorrência é do backend.** Toda escrita numa oferta: abre transação → trava a linha
   com `select_for_update()` → reconstitui a `Oferta` do domínio → chama a regra → grava.
5. **PostgreSQL é a fonte oficial**, inclusive da expiração. **Nunca SQLite**, nem em teste:
   lá o `select_for_update()` não trava nada e o teste de concorrência não provaria coisa alguma.
6. **Expiração sem worker separado:** antes de cada operação numa oferta, na vitrine (o livre
   já desconta as vencidas), ao abrir os painéis (varredura da loja) e numa rota diária
   protegida por token. A varredura é **idempotente**.
7. **Configuração só por variável de ambiente.** Nenhuma senha ou chave no código.
   Ver [.env.example](.env.example).

## 3. Regras do domínio

Em [dominio/src/dominio/\_\_init\_\_.py](dominio/src/dominio/__init__.py).

| Regra | Resumo |
|---|---|
| Lote | Separado fisicamente antes de publicar; `livre` nasce igual a `separado`. |
| Reserva | Por quantidade. Parcial automática: `min(pedido, livre)`. Livre = 0 → recusa (registrada). |
| Estados | `reservada → retirada \| expirada \| cancelada`. |
| Janela de reserva | Configurável pela loja; o prazo de retirada nunca passa do fim da oferta. |
| Devolução | Cancelamento e expiração devolvem ao livre **exatamente uma vez**. |
| Retirada | Tudo ou nada, com código; pagamento presencial. |
| Ajuste | A loja só reduz o livre, com motivo; unidade reservada não é ajustada. |
| Fim da oferta | 23:59 (Brasília) do dia validade − margem; sobra livre vira **perda**. |
| Invariante | `separado = livre + reservado + retirado + ajustado + perda`, conferida a cada operação. |

**Limitação declarada:** perda de unidade já reservada não é tratada.

| Operação da `Oferta` | O que faz |
|---|---|
| `reservar(pedido, agora)` | cria reserva (parcial se preciso) ou devolve `None` se não há livre |
| `cancelar(id_reserva, agora)` | cliente desiste; unidades voltam ao livre |
| `expirar_vencidas(agora)` | expira reservas cuja janela passou; devolve ao livre |
| `retirar(id_reserva, codigo, agora)` | confirma a retirada com o código |
| `ajustar_estoque(quantidade, motivo, agora)` | loja reduz o livre (avaria, erro de contagem…) |
| `encerrar(agora)` | fecha a oferta; sobra livre vira perda |
| `prazo_de_retirada(agora)` | até quando retirar se reservar agora |
| `reconstituir(...)` | remonta a oferta a partir do banco e recusa estado impossível |
| `verificar_invariantes()` | confere a conservação das unidades |

## 4. Funcionalidades

**Código de retirada.** 6 dígitos aleatórios (`secrets`), único entre as reservas ativas da
loja. O funcionário digita; a loja só vê o código mascarado na lista.

**Fitas coloridas.** 6 cores, uma por **bimestre de vencimento** (data absoluta, ciclo anual).
Grupo = **produto + cor + ano**: lote novo igual entra no grupo e a referência passa a ser a
data mais próxima; grupo que já virou oferta não recebe lote. **Colisão de ciclo** (mesma cor,
outro ano, ainda ativo) cria grupo novo e avisa, sem bloquear. O aviso sempre mostra a data exata.

**Avisos.** Só para a loja, com antecedência configurada (1–30 dias, maior que a margem). O
aviso pode ser adiado até a véspera do último dia da oferta, descartado ("não vai para
oferta", não conta como perda) ou publicado (separado ≤ recebido; preço normal sugerido = o
da última oferta do produto).

**Proximidade.** Consumidor escolhe localização do navegador ou CEP (o CEP também serve para
ver ofertas de outro lugar); a conversão em coordenada é feita no navegador e **nada é
gravado**. Distância por **Haversine em SQL**, sem PostGIS e sem mapa.

**Papéis — login único, papel por vínculo.**

| Quem | Vínculo | Pode |
|---|---|---|
| Consumidor | nenhum | reservar; ver e cancelar só as próprias reservas |
| Funcionário | loja X | operação da loja: lotes, avisos, ofertas, ajuste, retirada |
| Responsável | loja X | tudo do funcionário + configuração, equipe, painel, histórico, projeção |

Login por e-mail e senha; token do DRF. A loja nunca fica sem responsável.

**Painel do gestor.** Por período (padrão 30 dias, máx. 1 ano), lido do PostgreSQL: reservas
criadas; taxas de retirada e de expiração (sobre as encerradas; `null` se não houver);
compradores bloqueados = recusas + parciais; perda no encerramento; série semanal. Cada número
pela data do próprio evento.

**Projeção (G2).** Compara as janelas de reserva com os resultados **já calculados** da
simulação (`resultados_n5000`), filtrados por faixa de lote, de procura e tempo de chegada.
Não roda simulação no servidor. Sem filtro, mostra exatamente a Tabela 5 do artigo. Nenhum
texto recomenda uma janela.

**Simulação.** Monte Carlo que mede como a janela de reserva afeta desperdício e bloqueio de
compradores; cada ação passa pelo pacote `dominio`. O resultado é **cenário projetado**, não
previsão; os parâmetros entram como faixas, com procedência em
[simulacao/parametros.md](simulacao/parametros.md).

## 5. Estrutura do repositório

```
/
├── dominio/                  regras da reserva — Python puro, pacote instalável (tg-dominio)
│   ├── src/dominio/            Oferta, Reserva, estados, invariante, prazo de retirada
│   └── tests/                  regras, reconstituição, códigos de erro, prazo
├── backend/                  API Django + DRF
│   ├── config/                 configuração (só por ambiente), /health, formato dos erros
│   ├── contas/                 usuário (login por e-mail), token, porteiros por papel
│   └── ofertas/
│       ├── models.py             Loja, Vínculo, Produto, Lote, Grupo, Oferta, Reserva, Ajuste, Recusa
│       ├── servico*.py           escrita com transação + trava: reserva, lotes, equipe, varredura
│       ├── api_*.py              rotas por grupo do contrato
│       ├── consultas.py          vitrine em SQL com Haversine
│       ├── fita.py, calendario.py  cor da fita; fim às 23:59 de Brasília
│       ├── indicadores.py        painel do gestor
│       ├── projecao.py, dados/   projeção (G2) e o resumo da simulação
│       ├── management/commands/  popular_demo (dados do vídeo), resumir_projecao
│       └── test_*.py             testes
├── simulacao/                Monte Carlo, limiar de referência, parâmetros e resultados
├── spikes/spike_django/      prova inicial dos 3 critérios do framework (referência)
├── docs/
│   ├── api/contrato.md         contrato da API (dono: backend)
│   ├── api/pedidos-do-front.md pedidos do frontend para o contrato
│   ├── frontend/               especificação das telas, protótipos e briefing
│   ├── roteiro-de-testes-em-tela.md  testes manuais por tela
│   └── colinha-python.md
├── docker-compose.yml        só desenvolvimento local (PostgreSQL)
└── .env.example              variáveis necessárias, sem valores reais
```

O **frontend** (React + TypeScript + Vite, PWA) fica na branch
[`frontend`](../../tree/frontend), pasta `frontend/`, com README próprio.

## 6. Stack e hospedagem

| Camada | Escolha |
|---|---|
| Domínio | Python puro (só biblioteca padrão) |
| Backend | Django + Django REST Framework, gunicorn, psycopg |
| Banco | PostgreSQL 16 |
| Frontend | React + TypeScript, Vite, PWA |
| Simulação | Python + NumPy + Matplotlib |
| Ambiente local | Docker Engine no WSL 2 (só o PostgreSQL); Django roda no Windows |

Hospedagem planejada (plano gratuito, se houver tempo): **Vercel** (frontend + agendamento
diário da varredura), **Render** (API em imagem Docker; dorme após ~15 min, o front mostra
"carregando" enquanto acorda) e **Neon** (PostgreSQL, endereço direto com `sslmode=require`).

## 7. Como rodar

Comandos para PowerShell, no Windows, a partir da raiz do repositório.

**Uma vez:**

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
cd backend;   python -m pip install -r requirements.txt; cd ..   # domínio + Django/DRF/psycopg
cd simulacao; python -m pip install -r requirements.txt; cd ..   # domínio + NumPy/Matplotlib
copy .env.example .env                                           # preencha os valores
```

**Banco** (PostgreSQL no Docker do WSL 2):

```powershell
wsl docker compose up -d --wait     # liga e espera ficar pronto
wsl docker compose stop             # desliga (os dados ficam)
```

> O WSL desliga sozinho quando nenhum programa do Windows o usa, e o banco cai junto
> (a conexão **trava** em vez de dar erro). Deixe um terminal do Ubuntu aberto.

**Backend com dados de demonstração:**

```powershell
cd backend
python manage.py migrate
python manage.py popular_demo       # dados fictícios; rodar de novo não duplica
python manage.py runserver          # http://localhost:8000/health → {"status": "ok", "banco": "ok"}
```

Contas da demonstração (senha `demo1234`, tudo fictício): `carlos@example.com` (responsável do
Mercadinho Vila Nova), `juliana@example.com` (funcionária), `ana@example.com` e
`bruno@example.com` (consumidores), `rosa@example.com` (responsável do Empório São Jorge).
O cenário cobre reservas em todos os estados, parcial, recusa, avisos, colisão de fita e
4 semanas de histórico. Para recomeçar: `python manage.py flush` e `popular_demo` de novo.

> **"You don't have permission to access that port"?** O Windows às vezes reserva a faixa
> que inclui a 8000 (`netsh interface ipv4 show excludedportrange protocol=tcp`). Use outra
> porta: `python manage.py runserver 8765`.

**Frontend:** na branch `frontend`, `cd frontend; npm install; npm run dev`. A variável
`VITE_API` escolhe quem responde cada grupo (`mock`, `http` ou letras, ex.: `A,B`); o
`.env` do backend precisa de `CORS_ALLOWED_ORIGINS=http://localhost:5173`.

**Simulação:**

```powershell
cd simulacao
python simulacao.py              # N = 1000, semente 2026, gráficos em resultados/
python simulacao.py --n 5000     # mais repetições
python limiar_referencia.py      # limiar "sem plataforma"
```

## 8. Testes

| Suíte | Comando (de dentro da pasta) | Testes | Precisa de banco |
|---|---|---|---|
| Domínio | `python -m unittest discover -s tests -v` em `dominio/` | 53 | não |
| Simulação | `python -m unittest -v` em `simulacao/` | 16 | não |
| Backend | `python manage.py test` em `backend/` | 279 + 1 pulado | sim (cria e apaga `test_tg`) |

Regra da casa: **nenhum teste existente pode quebrar.**

**O que os testes do backend provam** (destaques):
- **Concorrência:** 20 pessoas ao mesmo tempo pela última unidade → exatamente 1 reserva e
  19 recusas, livre nunca negativo, conservação fechando (5 rodadas). O mesmo para 5 balcões
  com o mesmo código, 5 lotes simultâneos e dois responsáveis se removendo.
  **Controle negativo:** sem a trava, 20 de 20 recebem "reservado".
  ```powershell
  python manage.py test ofertas.test_concorrencia
  $env:CONTROLE_NEGATIVO="1"; python manage.py test ofertas.test_concorrencia.TestControleNegativo; Remove-Item Env:CONTROLE_NEGATIVO
  ```
- **Varredura idempotente:** rodar duas vezes não devolve estoque em dobro.
- **Painel:** cenário com números conhecidos (6 de 9 retiradas, perda 15…).
- **Projeção:** sem filtro = Tabela 5 do artigo, número por número; o resumo versionado é
  igual ao regenerado a partir do CSV da simulação (pulado se o CSV não estiver na máquina).
- **Permissões:** sem login → 401; sem papel na loja → 403; reserva de outra pessoa → 404.

**Testes em tela** (à mão, para a integração e o ensaio do vídeo):
[docs/roteiro-de-testes-em-tela.md](docs/roteiro-de-testes-em-tela.md).

## 9. API

O formato completo de cada rota (entradas, saídas, erros) está no
**[contrato da API](docs/api/contrato.md)**. Erros sempre como
`{"erro": "<frase>", "codigo": "<identificador>"}`; autenticação por
`Authorization: Token <chave>`.

| Grupo | Telas | Exemplos de rota | Quem |
|---|---|---|---|
| A · Acesso | A1–A5 | `POST /api/auth/conta`, `POST /api/auth/login`, `GET /api/eu` | todos |
| B · Consumidor | C2–C8 | `GET /api/ofertas?lat=&lng=`, `POST /api/ofertas/{id}/reservas`, `GET /api/minhas-reservas` | público / consumidor |
| C · Operação da loja | L1, L9–L13 | `GET /api/lojas/{id}/resumo-do-dia`, `POST .../ajustes`, `POST .../retiradas` | equipe da loja |
| D · Lote, fita e aviso | L2–L8 | `POST /api/lojas/{id}/lotes`, `GET .../avisos`, `POST .../avisos/{g}/publicar` | equipe da loja |
| E · Configuração | L14/G6 | `PATCH /api/lojas/{id}`, `POST .../vinculos` | ler: equipe · mudar: responsável |
| F · Gestor | G1, G3, G4 | `GET /api/lojas/{id}/indicadores`, `GET .../historico` | responsável |
| G · Projeção | G2 | `GET /api/lojas/{id}/projecao?lote=&procura=&chegada=` | responsável |
| Tarefa diária | — | `POST /tarefas/varrer` (com `CRON_TOKEN`) | agendador |

<details>
<summary>Exemplos com curl</summary>

```powershell
# conta e "eu"
curl.exe -X POST http://localhost:8000/api/auth/conta -H "Content-Type: application/json" -d '{\"nome\":\"Ana Souza\",\"email\":\"ana@email.com\",\"senha\":\"senha-boa-123\",\"aceite_termos\":true}'
curl.exe http://localhost:8000/api/eu -H "Authorization: Token <chave>"

# vitrine e reserva
curl.exe "http://localhost:8000/api/ofertas?lat=-20.8197&lng=-49.3794&categoria=laticinios"
curl.exe -X POST http://localhost:8000/api/ofertas/1/reservas -H "Authorization: Token <chave>" -H "Content-Type: application/json" -d '{\"pedido\":2}'

# balcão: prévia e retirada pelo código
curl.exe "http://localhost:8000/api/lojas/1/reservas/ativa?codigo=482917" -H "Authorization: Token <chave>"
curl.exe -X POST http://localhost:8000/api/lojas/1/retiradas -H "Authorization: Token <chave>" -H "Content-Type: application/json" -d '{\"codigo\":\"482917\"}'

# lote e publicação
curl.exe -X POST http://localhost:8000/api/lojas/1/lotes -H "Authorization: Token <chave>" -H "Content-Type: application/json" -d '{\"produto\":3,\"validade\":\"2026-12-18\",\"quantidade\":24}'
curl.exe -X POST http://localhost:8000/api/lojas/1/avisos/4/publicar -H "Authorization: Token <chave>" -H "Content-Type: application/json" -d '{\"separado\":10,\"preco_original\":\"4.49\",\"desconto\":30,\"janela_horas\":4,\"confirmou_separacao\":true}'

# painel e projeção
curl.exe "http://localhost:8000/api/lojas/1/indicadores?de=2026-10-01&ate=2026-10-31" -H "Authorization: Token <chave>"
curl.exe "http://localhost:8000/api/lojas/1/projecao?lote=15-24&chegada=4" -H "Authorization: Token <chave>"

# varredura (exige CRON_TOKEN no .env)
curl.exe -X POST http://localhost:8000/tarefas/varrer -H "Authorization: Bearer SEU_CRON_TOKEN"
```

Simulação refeita? Regenere o resumo da projeção: `python manage.py resumir_projecao`.
</details>

## 10. Escopo

**Fora de escopo:** Redis, cache, filas, Celery, worker separado; observabilidade
(Prometheus, Grafana) como entrega; CI/CD; PostGIS, mapa, rotas; integração com PDV,
importação de planilha, pagamento online, entrega, WhatsApp.

**Depois da v1:** notificação de oferta nova (Web Push), "esqueci minha senha" (exige envio de
e-mail), Dockerfile de produção e deploy.

**Limitações declaradas:** perda de unidade já reservada; o token de login não expira sozinho
("sair" o apaga).

---

## 11. Linha do tempo

Um item só entra como ✅ depois de existir **e** ter sido verificado (a coluna
"Verificação" diz como).

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
| 11/11/2026 | Backend (etapa 6): acesso — conta, login por e-mail, sair, "eu"; token do DRF; porteiros `EhDaLoja` e `EhResponsavel`; erros no formato do contrato | 16 testes (e-mail repetido com maiúscula, senha guardada só como hash, login errado sem revelar a conta, funcionário barrado no painel, vínculo de outra loja → 403) · backend: 71 ok + 1 pulado |
| 11/11/2026 | Backend (etapa 7): colunas do contrato — categoria do produto (lista única), janela padrão e antecedência do aviso na loja, `encerrada_em` e `retirada_por` na reserva; margem limitada a 0–7 dias; cor da fita calculada pela validade | 16 testes novos (expirada conta na hora em que **venceu**, não na que foi processada; travas novas; fita nos 12 meses) · migração aplicada, desfeita e reaplicada · backend: 87 ok + 1 pulado |
| 11/11/2026 | Backend (etapa 8): rotas do consumidor (grupo B) — vitrine com Haversine em SQL e filtros, detalhe, reservar (201 confirmada/parcial, 409 recusada), minhas reservas, ver e cancelar; CORS por variável de ambiente | 25 testes (distância igual à conta em Python; livre da vitrine desconta vencidas sem gravar; reserva de outra pessoa → 404; leitura expira a vencida antes de responder; CORS só para o frontend) · conferido ao vivo · backend: 112 ok + 1 pulado |
| 12/11/2026 | Backend (etapa 9): rotas da operação da loja (grupo C) — resumo do dia, ofertas da loja com estoque, detalhe com reservas (código mascarado), ajuste e retirada no balcão; cada recusa do domínio ganhou um **código** (`acima_do_livre`, `venceu`...) que a API traduz; retirada vencida já grava a expiração | Domínio: 16 testes novos (50 ok). Backend: 31 testes da loja (sem vínculo → 403; oferta de outra loja → 404; código inteiro nunca vai para a loja; vencido → 409 mesmo depois da ronda) + **5 balcões com o mesmo código ao mesmo tempo: 1 retira, 4 recusados, nada em dobro** (5 rodadas) · backend: 146 ok + 1 pulado |
| 12/11/2026 | Backend (etapa 10a): lote, fita e aviso (grupo D) — produtos, registro de lote com agrupamento por produto + cor + ano e aviso de colisão de ciclo, grupos de fita, avisos (adiar até a véspera do último dia, descartar), **publicação da oferta pelo domínio**; "conferir" calculado pela data, sem worker | 13 testes puros (fim 23:59 de Brasília; limite do adiar; novo/agrupado/colisão) + 37 da API (referência = data mais próxima; grupo publicado não recebe lote; separado acima do recebido → 400; publicada aparece na vitrine) + **5 lotes simultâneos do mesmo produto → 1 grupo só** (5 rodadas) · migração aplicada, desfeita e reaplicada · backend: 197 ok + 1 pulado |
| 13/11/2026 | Backend (etapa 10b): configuração da loja e equipe (grupo E) — ler/alterar as regras da loja (janela padrão, margem, antecedência, coordenadas), listar, adicionar e remover pessoas da equipe; **permissão por método** (ler = vínculo, mudar = responsável) | 33 testes da API (funcionário lê mas não altera → 403; erro em um campo não grava nenhum; antecedência ≤ margem → 400; mudança não mexe em aviso já agendado; e-mail sem conta → 404; já vinculado → 409; próprio vínculo → 409) + **2 responsáveis removendo um ao outro ao mesmo tempo → sobra 1** (5 rodadas; sem a trava, as 5 falham) · backend: 231 ok + 1 pulado |
| 13/11/2026 | Backend: dados de demonstração para o vídeo (`manage.py popular_demo`) — 2 lojas, equipe, consumidores e o cenário completo (reservas em todos os estados, parcial, recusa, avisos, colisão de fita), **criados pelos serviços reais** | 4 testes (rodar 2 vezes não duplica; conservação fecha em todas as ofertas; cenário do vídeo presente) · rodado no banco local e conferido pela API (login, resumo do dia, vitrine, avisos) · backend: 235 ok + 1 pulado |
| 13/11/2026 | Backend (etapa 11): painel do gestor (grupo F) — indicadores por período (reservas criadas, encerradas por estado, taxas de retirada e de expiração, compradores bloqueados = recusas + parciais, perda, série semanal) e histórico de reservas e recusas com filtros; **cada número pela data do próprio evento**; varredura antes de contar. `popular_demo` ganhou 4 semanas de passado | 18 testes (cenário de números conhecidos: 6/9 retiradas, 2 recusa+parcial, perda 15; abrir o painel varre e abrir de novo dá o mesmo número; criada às 22:00 e vencida às 02:00 conta em dias diferentes; taxa `null` sem encerradas; funcionário → 403) + painel da demonstração conferido contra a conta feita à mão (65 encerradas, perda 21) · backend: 254 ok + 1 pulado |
| 13/11/2026 | Backend: os 4 pedidos do frontend aceitos — `retirar_ate` na vitrine e no detalhe (o prazo se reservar agora, calculado pela nova função do domínio `prazo_de_retirada`, a mesma que grava o `expira_em`), `validade` na prévia da retirada, **trocar o papel** de alguém da equipe (`PATCH` do vínculo, com a trava da loja) e o `aguardando_retirada` documentado como reservas | Domínio: 3 testes novos (o prazo mostrado = o `expira_em` gravado; nunca passa do fim) · 53 ok. Backend: 12 testes dos pedidos + **2 responsáveis se rebaixando ao mesmo tempo → sobra 1** (5 rodadas) · backend: 267 ok + 1 pulado · simulação: 16 ok |
| 14/11/2026 | Backend (etapa 13): projeção (grupo G, tela G2) — comando `resumir_projecao` (só lê o CSV da simulação, biblioteca padrão) gera um resumo versionado de 525 células com **somas e contagens**; a rota filtra por faixa de lote, faixa de procura e chegada, soma e divide uma vez; não roda simulação no servidor | 12 testes (**sem filtro = Tabela 5**, número por número; faixas somam 5000 rodadas; chegada 1 h e 4 h diferem; soma-e-divide ≠ média de médias; resumo versionado = regenerado do CSV; filtro = média lida direto do CSV) · controle negativo: um número alterado no resumo → os 2 testes de consistência falham · backend: 279 ok + 1 pulado |

### Próximos passos

| Status | Entrega |
|---|---|
| 🔄 | Frontend: trocar o mock pela API real, grupo por grupo (A → B → C → F/G → E → D) |
| ⏳ | Rodar o [roteiro de testes em tela](docs/roteiro-de-testes-em-tela.md) com a API real |
| ⏳ | Ensaio e gravação do vídeo do sistema |
| ⏳ | **17/11 a 02/12/2026** — apresentação final, com o vídeo |
| ⏳ | Dockerfile de produção + deploy (Render, Neon, Vercel) — se sobrar tempo |
| ⏳ | Notificação de oferta nova (Web Push) |
