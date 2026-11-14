# Roteiro de testes em tela

Testes **feitos à mão, nas telas**, com o sistema rodando local. Servem para três coisas:
1. conferir a integração do front com a API real (grupo por grupo);
2. ensaiar o vídeo da apresentação (17/11 a 02/12/2026);
3. saber explicar na banca **qual regra cada tela prova**.

Eles **não substituem** os testes automáticos (`manage.py test`): concorrência, idempotência
da varredura e a conta da Tabela 5 só são provadas de verdade lá. Aqui se confere que a tela
mostra o que o backend decidiu.

> **Situação em 14/11/2026:** todas as telas existem no front (F0–F9), mas **só contra o mock**
> (`FABRICAS_HTTP` vazio em `frontend/src/api/index.ts`). Até cada grupo ganhar sua
> implementação http, estes testes rodam no mock, onde várias regras são **fingidas**
> (`mock/regras-fingidas.ts`). Os itens marcados **🔌** só valem com a API real.

---

## 0 · Preparação (uma vez por sessão de testes)

```powershell
# terminal 1 — banco (deixe também um terminal do Ubuntu aberto: WSL desligado = banco caído)
wsl docker compose up -d --wait

# terminal 2 — backend, dados de demonstração do zero
cd backend
..\.venv\Scripts\python manage.py flush --noinput      # APAGA o banco local (só dados de demo)
..\.venv\Scripts\python manage.py popular_demo
..\.venv\Scripts\python manage.py runserver

# terminal 3 — frontend (worktree Codigo-frontend), apontando para a API real
#   .env.local:  VITE_API=http   (ou só as letras já integradas, ex.: A,B)
#                VITE_API_URL=http://localhost:8000
npm run dev                                              # http://localhost:5173
```

No `.env` da raiz: `CORS_ALLOWED_ORIGINS=http://localhost:5173` (sem isso o navegador
bloqueia todas as chamadas).

**Contas** (senha de todas: `demo1234`, tudo fictício):

| Conta | Papel | Para testar |
|---|---|---|
| `ana@example.com` | consumidora | C1–C9 (tem reserva ativa e uma parcial) |
| `bruno@example.com` | consumidor | segunda pessoa disputando estoque |
| `juliana@example.com` | funcionária do Mercadinho Vila Nova | L1–L13 (não vê painel) |
| `carlos@example.com` | responsável do Mercadinho Vila Nova | L14, G1–G6 |
| `rosa@example.com` | responsável do Empório São Jorge | isolamento entre lojas |

Use **duas janelas** (normal + anônima) para ter duas pessoas logadas ao mesmo tempo.

---

## 1 · Acesso (grupo A)

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| A-1 | A1 | Abrir o app com o `runserver` **desligado**; ligar depois | Mostra "carregando/servidor acordando", sem travar; entra sozinho quando a API volta | Front aguenta a API dormindo (Render) |
| A-2 | A2 | Entrar com `ana@example.com` / senha errada | Mensagem de erro, sem dizer se o e-mail existe | Login só por e-mail e senha |
| A-3 | A2 | Entrar com `ANA@EXAMPLE.COM` / `demo1234` | Entra (e-mail não diferencia maiúscula) | — |
| A-4 | A3 | Criar conta com e-mail já usado | `409`, mensagem "já existe" | Uma tabela de usuários só |
| A-5 | A4 | Entrar como `carlos` | Oferece consumidor **e** a loja; `juliana` só a loja (operação); `ana` vai direto à vitrine | Papel por vínculo, login único |
| A-6 | C9 | "Sair" e recarregar | Volta para A2; o token antigo não funciona mais 🔌 | Sair apaga o token |

## 2 · Consumidor (grupo B)

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| B-1 | C1 | Permitir localização **e**, depois, digitar um CEP de outra cidade | Vitrine reordena pela distância do CEP; nada fica gravado (recarregar pergunta de novo) | Proximidade sem gravar a posição |
| B-2 | C2 | Ver a vitrine perto do Vila Nova | Ofertas ordenadas por distância; Empório a ~3 km depois das do Vila Nova 🔌 | Haversine em SQL |
| B-3 | C2/C3 | Filtrar por categoria; filtrar algo sem resultado | Lista filtrada; estado "vazio" amigável | — |
| B-4 | C4 | Abrir o iogurte | Mostra "Retire até HH:MM" = agora + janela, **nunca depois do fim da oferta** 🔌 | Janela nunca passa do fim (`prazo_de_retirada`, domínio) |
| B-5 | C4→C5 | Ana pede **mais do que o livre** | Resultado "parcial": leva `min(pedido, livre)` | Reserva parcial automática |
| B-6 | C5 | Bruno tenta reservar o **pão** (esgotado) | Resultado "recusada"; nada é reservado | livre = 0 → recusa |
| B-7 | C6 | Abrir a reserva confirmada | Código de **6 dígitos** grande + "retire até" | Código estilo MFA |
| B-8 | C7/C8 | Cancelar uma reserva ativa; abrir "minhas reservas" | Estado `cancelada`; o livre da oferta **sobe** a mesma quantidade (conferir na L10) 🔌 | Cancelamento devolve ao livre exatamente uma vez |
| B-9 | C8 | Ver o requeijão do Bruno | Aparece `expirada` sem ninguém ter mexido 🔌 | Expiração sem worker (varredura preguiçosa) |
| B-10 | C8 | Logado como Bruno, tentar abrir a URL de uma reserva da Ana | `404`/sem acesso 🔌 | Consumidor vê só as próprias reservas |

## 3 · Operação da loja (grupo C) — como `juliana`

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| C-1 | L1 | Abrir o início | Resumo do dia: aguardando retirada, avisos para conferir | — |
| C-2 | L9/L10 | Abrir a oferta do iogurte | Separado, livre, reservado, retirado; **a soma fecha** | Invariante `separado = livre + reservado + retirado + ajustado + perda` |
| C-3 | L10 | Ver a lista de reservas | Código **mascarado** (a loja não vê o código inteiro) | Código só a cliente mostra |
| C-4 | L11 | Ajustar −2 com motivo "avaria" | Livre cai 2, "ajustado" sobe 2; tentar ajustar mais que o livre → recusa | Ajuste só reduz o livre; unidade reservada não é ajustada |
| C-5 | L12→L13 | Digitar o código da Ana (ver na C6 dela) | Prévia com produto, quantidade e **validade com a fita**; confirmar → `retirada` | Retirada tudo ou nada, com código |
| C-6 | L12 | Digitar o mesmo código de novo | "Não encontrada" (já não está ativa) | Código vale para reserva **ativa** |
| C-7 | L12 | Logada como `rosa` (Empório), digitar um código do Vila Nova | Não encontra 🔌 | Código procurado só **naquela loja** |
| C-8 | L1 | Funcionária tenta abrir G1 pela URL | Bloqueado (`403`) 🔌 | Painel só do responsável |

## 4 · Lote, fita e aviso (grupo D) — **tem de aparecer no vídeo**

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| D-1 | L2→L3 | Cadastrar produto novo e um lote | A tela mostra a **cor da fita** da validade e a data exata | Fita = bimestre da validade (data absoluta) |
| D-2 | L3 | Novo lote de **leite** com validade no mesmo bimestre de um grupo ativo | Entra no grupo existente; a referência vira a **data mais próxima** | Grupo = produto + cor + ano |
| D-3 | L3/L4 | Ver o **feijão** | Aviso de **colisão de ciclo** (mesma cor, outro ano); não bloqueia | Colisão avisa e não bloqueia |
| D-4 | L4/G5 | Lista de lotes e fitas | Grupos com cor, ano, quantidade e situação | — |
| D-5 | L5→L6 | Abrir o aviso do **presunto** ("conferir") | Conferência mostra a fita **e** a data exata | A fita acelera, mas o aviso sempre traz a data |
| D-6 | L8 | Adiar um aviso além da véspera do último dia | Recusa; até a véspera → aceita | Adiar no máximo até a véspera |
| D-7 | L7 | Publicar com `separado` maior que o recebido | `400 acima_do_recebido` | Separado ≤ recebido |
| D-8 | L7 | Publicar certo | Oferta nasce com `livre = separado`, fim = **23:59 de (validade − margem)** | Fim automático pela margem |
| D-9 | L7 | Abrir "publicar" de outro produto que já teve oferta | Preço normal **sugerido** = o da última oferta | Preço sugerido |
| D-10 | L5 | "Não vai para oferta" (descartar) | Grupo encerrado; **não** aparece como perda no G1 | Descarte não conta como perda |
| D-11 | L3 | Lote novo de um produto cujo grupo **já virou oferta** | Abre grupo novo (mesma cor e ano) | Grupo em oferta não recebe lote |

## 5 · Configuração e equipe (grupo E) — como `carlos`

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| E-1 | L14/G6 | Mudar margem para 2 dias | Ofertas **novas** usam 2 dias; as antigas mantêm o fim | Fim gravado na publicação |
| E-2 | L14 | Antecedência do aviso ≤ margem | `400 antecedencia_menor_que_margem` | Aviso nunca chega depois do último dia |
| E-3 | L14 | Mudar o endereço | Busca a coordenada (Nominatim) ao salvar; distância da vitrine muda 🔌 | Coordenada da loja no cadastro |
| E-4 | G6 | Adicionar `bruno@example.com` como funcionário; promover; rebaixar | Lista atualiza; Bruno passa a ver/deixar de ver o painel | Papel por vínculo |
| E-5 | G6 | Carlos tenta remover/rebaixar a si mesmo | `409 proprio_vinculo` | — |
| E-6 | G6 | Remover o último responsável | `409 ultimo_responsavel` | Loja nunca fica sem responsável |
| E-7 | L14 | Como `juliana`, tentar salvar | Lê, mas não salva (`403`) | Ler = vínculo; mudar = responsável |

## 6 · Gestor (grupos F e G) — como `carlos`

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| F-1 | G1 | Abrir o painel (últimos 30 dias) | Reservas criadas, taxa de retirada (~72%), expiração, bloqueados = recusas + parciais (com a divisão), perda, série semanal 🔌 | Indicadores de negócio lidos do PostgreSQL |
| F-2 | G1 | Período sem reservas encerradas | Taxas aparecem como "—" (não 0%) | Taxa `null` sem encerradas |
| F-3 | G1 | Período de mais de 1 ano | Mensagem de período inválido | Máx. 1 ano |
| F-4 | G3 | Histórico filtrado por `recusa`; buscar pelo final de um código | Lista coerente com o G1 | — |
| F-5 | G4 | Ofertas no computador | Mesmos números da L9/L10 | — |
| G-1 | G2 | Abrir sem filtro, chegada 2 h | **Exatamente a Tabela 5** do artigo; "baseado em 5000 rodadas" | Tela e artigo dizem a mesma coisa |
| G-2 | G2 | Filtrar lote `15-24`, procura `1.3-1.8` | Números mudam; "baseado em N rodadas" com N < 5000 | Recorte das rodadas, sem simular |
| G-3 | G2 | Chegada 1 h e 4 h | Números diferentes (no mock davam erro `501`) 🔌 | — |
| G-4 | G2 | Ler todos os textos da tela | **Nenhuma frase recomenda uma janela** | Decisão de 05/11 |

## 7 · Concorrência e expiração vistas na tela (opcional, bom para o vídeo)

| # | Passos | Esperado |
|---|---|---|
| X-1 | Juliana ajusta o livre de uma oferta até **1**. Ana e Bruno (duas janelas) clicam "reservar" quase juntos | Um recebe "confirmada", o outro "recusada"; L10 mostra livre 0 e a soma fechando 🔌 |
| X-2 | Carlos põe janela de 1 h; Ana reserva; espera 1 h; abre L10 ou G1 | Reserva vira `expirada`, o livre volta **uma vez só** 🔌 |

> Na tela, o X-1 depende de reflexo (os cliques raramente caem no mesmo milissegundo). A
> **prova** é o teste automático `test_concorrencia` (20 clientes × 5 rodadas → 1 sucesso).
> Na banca: "a tela mostra o efeito; o teste prova a garantia".

---

## Registro das execuções

| Data | Quem | Grupos com API real | Falhou | Observação |
|---|---|---|---|---|
| | | | | |

---

## Próximos passos e melhorias (14/11/2026)

### Para a v1 (antes de gravar o vídeo) — em ordem

1. **Integração do front com a API real** (maior risco). Hoje nenhum grupo tem implementação
   http no front. Sugestão de ordem, do mais simples ao mais delicado: **A** (acesso) → **B**
   (vitrine e reserva) → **C** (balcão) → **F** e **G** (só leitura) → **E** → **D** (o mais
   comprido). A cada grupo: `VITE_API` com a letra + rodar a seção deste roteiro.
2. **Rodar este roteiro inteiro** com `VITE_API=http` e anotar no registro acima. Divergência
   entre tela e contrato → pedido em `pedidos-do-front.md` (se for do backend) ou correção no front.
3. **Ensaio do vídeo**: `flush` + `popular_demo` no dia da gravação (as datas são relativas a
   hoje), roteiro curto cobrindo C2→C4→C6→L12→L13, a fita (D-1 a D-5), G1 e G2.

### Depois da v1 (já decidido que fica para depois)

- **Dockerfile de produção + deploy** (Render + Neon + Vercel), só se sobrar tempo. Conferir que a
  imagem leva `backend/ofertas/dados/projecao_resumo.json` (o CSV não vai).
- **Web Push** (VAPID) na publicação de oferta.
- **"Esqueci minha senha"** (exige envio de e-mail).

### Melhorias possíveis (não decididas — perguntar antes)

- Teste de ponta a ponta automatizado (navegador real contra a API real) para os caminhos do
  vídeo; hoje a integração só é conferida à mão por este roteiro.
- Limite de tentativas no login e no código de retirada (6 dígitos = 1 milhão de combinações
  por loja; sem limite, dá para tentar em série).
- Expiração do token (hoje não expira sozinho; decisão de 06/11).
- Perda de unidade **já reservada** (limitação declarada do protótipo).
