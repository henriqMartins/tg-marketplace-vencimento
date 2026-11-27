# Roteiro de testes em tela

Testes **feitos à mão, nas telas**, com o sistema rodando local. Servem para três coisas:
1. conferir a integração do front com a API real (grupo por grupo);
2. ensaiar o vídeo da apresentação (17/11 a 02/12/2026);
3. saber explicar na banca **qual regra cada tela prova**.

Eles **não substituem** os testes automáticos (`manage.py test`): concorrência, idempotência
da varredura e a conta da Tabela 5 só são provadas de verdade lá. Aqui se confere que a tela
mostra o que o backend decidiu.

> **Situação em 25/11/2026:** todas as telas existem no front (até F11) e **todos os grupos
> (A–G, I · Parceria e J · Pedido) têm implementação http** (`frontend/src/api/http/`). Com
> `VITE_API=http` o front fala com a API real; sem ela, usa o mock, onde várias regras são
> **fingidas** (`mock/regras-fingidas.ts`). Os itens marcados **🔌** só valem com a API real.
> A–G já rodaram inteiros contra a API real (14/11). **As seções de pedido (J) e parceria (I)
> ainda não rodaram** pelo roteiro: o caminho feliz do pedido (confirmar → código → balcão)
> nunca foi visto em tela contra o servidor.

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

# terminal 3 — frontend (pasta frontend/ da main ou worktree Codigo-frontend), API real
#   .env.local:  VITE_API=http   (ou só as letras já integradas, ex.: A,B)
#                VITE_API_URL=http://localhost:8000
npm run dev                                              # http://localhost:5173
```

No `.env` da raiz: `CORS_ALLOWED_ORIGINS=http://localhost:5173` (sem isso o navegador
bloqueia todas as chamadas).

**Contas** (senha de todas: `demo1234`, tudo fictício):

| Conta | Papel | Para testar |
|---|---|---|
| `ana@example.com` | consumidora | C1–C10 (tem um **pedido de 2 itens** — iogurte + leite, um código só — e uma reserva parcial de requeijão) |
| `bruno@example.com` | consumidor | segunda pessoa disputando estoque |
| `juliana@example.com` | funcionária do Mercadinho Vila Nova | L1–L13 (não vê painel) |
| `carlos@example.com` | responsável do Mercadinho Vila Nova | L14, G1–G6 |
| `rosa@example.com` | responsável do Empório São Jorge | isolamento entre lojas |
| `equipe@example.com` | equipe da plataforma (`is_staff`) | P1–P3 (interessados, lojas, convites) |
| `marcos@example.com` | pediu parceria ("Mercearia São Jorge", estado `novo`); sem loja | A6, A7 (aceitar o convite) |

Use **duas janelas** (normal + anônima) para ter duas pessoas logadas ao mesmo tempo.

---

## 1 · Acesso (grupo A)

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| A-1 | A1 | Abrir o app com o `runserver` **desligado**; ligar depois | Mostra "carregando/servidor acordando", sem travar; entra sozinho quando a API volta | Front aguenta a API dormindo (Render) |
| A-2 | A2 | Entrar com `ana@example.com` / senha errada | Mensagem de erro, sem dizer se o e-mail existe | Login só por e-mail e senha |
| A-3 | A2 | Entrar com `ANA@EXAMPLE.COM` / `demo1234` | Entra (e-mail não diferencia maiúscula) | — |
| A-4 | A3 | Criar conta com e-mail já usado | `400 email_em_uso`, mensagem "já existe" embaixo do e-mail | Uma tabela de usuários só |
| A-5 | A4 | Entrar como `carlos` | Oferece consumidor **e** a loja; `juliana` só a loja (operação); `ana` vai direto à vitrine | Papel por vínculo, login único |
| A-6 | C9 | "Sair" e recarregar | Volta para A2; o token antigo não funciona mais 🔌 | Sair apaga o token |

## 2 · Consumidor (grupo B)

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| B-1 | C1 | Permitir localização **e**, depois, digitar um CEP de outra cidade | Vitrine reordena pela distância do CEP; nada fica gravado (recarregar pergunta de novo) | Proximidade sem gravar a posição |
| B-2 | C2 | Ver a vitrine perto do Vila Nova | Ofertas ordenadas por distância; Empório a ~3 km depois das do Vila Nova 🔌 | Haversine em SQL |
| B-3 | C2/C3 | Filtrar por categoria; filtrar algo sem resultado | Lista filtrada; estado "vazio" amigável | — |
| B-4 | C4 | Abrir o iogurte | Mostra "Retire até HH:MM" = agora + janela, **nunca depois do fim da oferta** 🔌 | Janela nunca passa do fim (`prazo_de_retirada`, domínio) |
| B-5 | C4→C10 | Ana põe 2 itens da mesma loja no carrinho; fecha e reabre o app | O carrinho continua lá (fica no aparelho); na L10 o livre **não mudou** | Nada é reservado antes de confirmar |
| B-6 | C10→C5 | Confirmar com um item pedindo **mais do que o livre** | Pedido criado; esse item volta "parcial" com `min(pedido, livre)`, o outro "confirmada" 🔌 | Reserva parcial automática, **por item** |
| B-7 | C4/C10 | Bruno tenta pôr o **pão** (esgotado) no carrinho | Aparece esgotado e não entra no pedido; nada é reservado | livre = 0 → recusa |
| B-8 | C10→C5 | Ana e Bruno põem a **última unidade** de algo no carrinho (duas janelas); Bruno confirma, depois Ana | Bruno: confirmado. Ana: "tudo esgotado", **sem código**; o item fica marcado no carrinho 🔌 | `409 tudo_esgotado`; recusa gravada (conta nos bloqueados do G1) |
| B-9 | C6 | Abrir o pedido confirmado | **Um** código de 6 dígitos grande para o pedido inteiro, a lista dos itens e o "retire até" | Um código por pedido (grupo J), estilo MFA |
| B-10 | C7 | Cancelar **um item** do pedido | Só esse item vira `cancelada`; o código vale para os outros; o livre daquela oferta sobe (L10) 🔌 | Cancelamento devolve ao livre exatamente uma vez |
| B-11 | C7/C8 | Cancelar o pedido inteiro; abrir "minhas reservas" | Todos os itens ativos `cancelada`; o cartão do pedido sai dos ativos 🔌 | Cancelar o pedido = cancelar cada item ativo |
| B-12 | C8 | Ver o requeijão do Bruno | Aparece `expirada` sem ninguém ter mexido 🔌 | Expiração sem worker (varredura preguiçosa) |
| B-13 | C8 | Logado como Bruno, abrir a URL de um pedido da Ana (`/pedidos/{id}`) | `404`/sem acesso 🔌 | Consumidor vê só os próprios pedidos |

## 3 · Operação da loja (grupo C) — como `juliana`

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| C-1 | L1 | Abrir o início | Resumo do dia: aguardando retirada, avisos para conferir | — |
| C-2 | L9/L10 | Abrir a oferta do iogurte | Separado, livre, reservado, retirado; **a soma fecha** | Invariante `separado = livre + reservado + retirado + ajustado + perda` |
| C-3 | L10 | Ver a lista de reservas | Código **mascarado** (a loja não vê o código inteiro) | Código só a cliente mostra |
| C-4 | L11 | Ajustar −2 com motivo "avaria" | Livre cai 2, "ajustado" sobe 2; tentar ajustar mais que o livre → recusa | Ajuste só reduz o livre; unidade reservada não é ajustada |
| C-5 | L12→L13 | Digitar o código do **pedido de 2 itens** da Ana (ver na C6 dela) | Prévia com **os 2 itens** (produto, quantidade, **validade com a fita**) e a **soma a cobrar**; confirmar → os dois `retirada`; L10 de cada oferta: retirado sobe 🔌 | Retirada tudo ou nada **do pedido**, com um código |
| C-6 | L12 | Digitar o mesmo código de novo | "Não encontrado" (o pedido já não tem item ativo) | Código vale para pedido **ativo** |
| C-7 | L12 | Logada como `rosa` (Empório), digitar um código do Vila Nova | Não encontra 🔌 | Código procurado só **naquela loja** |
| C-8 | L1 | Funcionária tenta abrir G1 pela URL | Bloqueado (`403`) 🔌 | Painel só do responsável |
| C-9 | L12→L13 | Pedido com um item já vencido e outro ativo (o iogurte da Ana vence antes do leite: esperar, ou janela curta) | A prévia mostra **só o ativo**; o vencido virou `expirada` e não é cobrado 🔌 | Cada item tem o próprio prazo |
| C-10 | L12 | Código de um pedido cujos itens **todos** venceram há pouco | "Venceu" (não "não encontrado") 🔌 | `409 venceu` (últimas 24 h) |

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

## 4b · Parceria (grupo I) — entrada de mercados por convite

Cena da demonstração: **Marcos pede → equipe cadastra a loja → Marcos aceita o convite**.
O CNPJ é conferido na Receita (BrasilAPI) **pelo backend**: use o CNPJ real de um mercado
(consulta pública). Sem internet, a loja é criada com "CNPJ não verificado".

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| I-1 | A6 | Como `marcos`, abrir "quero ser parceiro" | Mostra o pedido já feito ("Mercearia São Jorge", `novo`); não deixa pedir outro 🔌 | Um interesse em aberto por pessoa (`409 interesse_em_aberto`) |
| I-2 | P1 | Como `equipe`, ver os interessados; mudar o do Marcos para "em conversa"; tentar **descartar sem motivo** | Lista com o Marcos; "em conversa" aceito; descartar sem motivo → erro no campo 🔌 | Só `novo → em_conversa` e `→ descartado` com motivo |
| I-3 | P3 | Cadastrar a loja do Marcos: CNPJ com **dígito errado** | Erro "CNPJ inválido" **sem** consultar a Receita | Dígito verificador conferido antes |
| I-4 | P3 | CNPJ válido de um mercado | A tela mostra razão social, situação e se é comércio de alimentos (só alerta, não bloqueia) 🔌 | Consulta pelo backend, limite de 5 s |
| I-5 | P3→P2 | Concluir com o e-mail `marcos@example.com` | Loja criada **e** convite gerado juntos; o link `/convite/{codigo}` aparece para copiar; o interesse vira `virou_loja` (P1) 🔌 | Loja + convite + interesse numa transação |
| I-6 | P3 | Cadastrar de novo o mesmo CNPJ | `409 cnpj_ja_cadastrado` 🔌 | CNPJ único |
| I-7 | P2 | Gerar **novo convite** para a loja; abrir o link **antigo** | Link antigo → "convite vencido" 🔌 | Novo convite invalida o anterior (`410`) |
| I-8 | A7 | Abrir o link novo logado como `ana` | "Este convite é para m…@example.com" (e-mail mascarado); não aceita 🔌 | Aceite só com o mesmo e-mail (`403 email_diferente`) |
| I-9 | A7→A4 | Abrir o link como `marcos` e aceitar; abrir o link de novo | Marcos vira **responsável** da loja nova (aparece na escolha de papel); segunda vez → "convite já usado" 🔌 | Convite de uso único; vínculo `responsavel` |
| I-10 | P1 | Como `ana` (sem `is_staff`), abrir `/plataforma/...` pela URL | Bloqueado (`403`) 🔌 | Rotas da plataforma só para a equipe |

## 5 · Configuração e equipe (grupo E) — como `carlos`

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| E-1 | L14/G6 | Mudar margem para 2 dias | Ofertas **novas** usam 2 dias; as antigas mantêm o fim | Fim gravado na publicação |
| E-2 | L14 | Antecedência do aviso ≤ margem | `400 antecedencia_menor_que_margem` | Aviso nunca chega depois do último dia |
| E-3 | L14 | Mudar o endereço | Busca a coordenada (Nominatim) ao salvar; distância da vitrine muda 🔌 | Coordenada da loja no cadastro |
| E-4 | G6 | Adicionar `bruno@example.com` como funcionário; promover; rebaixar | Lista atualiza; Bruno passa a ver/deixar de ver o painel | Papel por vínculo |
| E-5 | G6 | Carlos tenta remover/rebaixar a si mesmo | `409 proprio_vinculo` | — |
| E-6 | G6 | Remover o último responsável | `409 ultimo_responsavel` | Loja nunca fica sem responsável |
| E-7 | L14 | Como `juliana`, abrir as configurações | Vê dados, regras e equipe **só para leitura** (sem campos nem botões); salvar pela API → `403` | Ler = vínculo; mudar = responsável (decidido 14/11/2026) |

## 6 · Gestor (grupos F e G) — como `carlos`

| # | Tela | Passos | Esperado | Regra que prova |
|---|---|---|---|---|
| F-1 | G1 | Abrir o painel (últimos 30 dias) | Reservas criadas, taxa de retirada (≈ 2/3; varia com o dia, porque as datas da demonstração são relativas a hoje), expiração, bloqueados = recusas + parciais (com a divisão), perda, série semanal 🔌 | Indicadores de negócio lidos do PostgreSQL |
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
| X-3 | Juliana e Carlos (duas janelas, a mesma loja) digitam o **mesmo código** de pedido na L12 e confirmam quase juntos | Um vê "retirado"; o outro, "não encontrado"; retirado na L10 sobe **uma vez só** 🔌 |

> Na tela, o X-1 e o X-3 dependem de reflexo (os cliques raramente caem no mesmo
> milissegundo). A **prova** está nos testes automáticos: `test_concorrencia` (20 clientes ×
> 5 rodadas → 1 sucesso) e `test_concorrencia_pedidos` (Ana pede iogurte + leite e Bruno
> leite + iogurte ao mesmo tempo → sem deadlock, nada vendido a mais; 5 balcões com o mesmo
> código → 1 retirada). Na banca: "a tela mostra o efeito; o teste prova a garantia".

---

## Registro das execuções

| Data | Quem | Grupos com API real | Falhou | Observação |
|---|---|---|---|---|
| 14/11/2026 | front (automatizado no Chrome) | A–G (`VITE_API=http`) | nenhum | 50/50 executados. Fora: A-1 (desligar o servidor), E-6 (só por concorrência; provado no teste automático) e X-2 (esperar 1 h). D-2 feito com o feijão (o grupo aberto de leite já tinha virado oferta) e D-9 com um lote novo de iogurte (os avisos da semente nunca tiveram oferta). A loja foi restaurada; reservas, ajustes e lotes criados ficam até o próximo `flush` + `popular_demo` |

---

## Próximos passos e melhorias (atualizado em 25/11/2026)

### Para a v1 (antes de gravar o vídeo) — em ordem

1. ~~**Integração do front com a API real**~~ — feito em 14/11/2026: todos os grupos (A–G) em
   `frontend/src/api/http/`. Atenção: o login vem do grupo A, então misturar grupos (ex.:
   `VITE_API=G`) não serve para telas com login; use `VITE_API=http`.
2. ~~**Rodar este roteiro inteiro**~~ com `VITE_API=http` — feito em 14/11/2026 (registro acima).
   Divergência entre tela e contrato → pedido em `pedidos-do-front.md` (se for do backend) ou
   correção no front.
3. **Rodar as seções novas** com `VITE_API=http`: pedido (B-5 a B-13, C-5 a C-10, X-3) e
   parceria (I-1 a I-10), depois de `flush` + `popular_demo` (as ofertas da demonstração
   vencem com o tempo). Registrar acima.
4. **Ensaio do vídeo**: `flush` + `popular_demo` no dia da gravação (as datas são relativas a
   hoje), roteiro curto cobrindo C2→C4→**C10**→C5→C6→L12→L13 (o **pedido de 2 itens** da Ana:
   um código, dois itens), a fita (D-1 a D-5), G1 e G2; se couber, a cena da parceria
   (I-5 → I-9).

### Depois da v1 (já decidido que fica para depois)

- ~~**Dockerfile de produção + deploy**~~ — o front está na Vercel (publicado a cada push na
  `main`); o backend vai pela imagem de `backend/Dockerfile` no Render. Para testar em
  produção, o Neon precisa de ofertas ativas (`popular_demo`; ver "Dia da gravação" no README).
- **Web Push** (VAPID) na publicação de oferta.
- **"Esqueci minha senha"** (exige envio de e-mail).

### Melhorias possíveis (não decididas — perguntar antes)

- Teste de ponta a ponta automatizado (navegador real contra a API real) para os caminhos do
  vídeo; hoje a integração só é conferida à mão por este roteiro.
- Limite de tentativas no login e no código de retirada (6 dígitos = 1 milhão de combinações
  por loja; sem limite, dá para tentar em série).
- Expiração do token (hoje não expira sozinho; decisão de 06/11).
- Perda de unidade **já reservada** (limitação declarada do protótipo).
