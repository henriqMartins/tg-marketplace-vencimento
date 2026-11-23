# Especificação técnica das telas — TG Marketplace de produtos próximos ao vencimento

Versão 3.1 (05/11/2026): decisões de 05/11 aplicadas (ver "Decisões de 05/11/2026" no fim). **Rotas e formatos da API: vale `docs/api/contrato.md`** (prefixo `/api/`); as rotas citadas nas telas abaixo são indicativas.

Versão 3 (04/11/2026), consolidada com o protótipo do Claude Design. Versão 2 de 26/10/2026. Substitui a versão anterior, que cobria só as 7 telas do artigo.
Este arquivo traz o desenho completo do frontend: **37 artboards**, que somam 33 telas e mais 16 estados, organizados em 5 páginas no canvas "Telas TG — Marketplace".

Fontes usadas:
- artigo (seção 4: Figuras 2 a 6);
- Contexto mestre (decisões 16 a 46 e seção 6.4, Projeção);
- `Codigo/CLAUDE.md` (decisões de 23/10: login único, papéis, margem);
- `backend/ofertas/models.py`.

**Como usar no Claude Design:** cole primeiro o bloco **0 · Base** e depois o bloco da tela. Cada código (A1, C4, L6…) é igual ao título do artboard no canvas.

---

## 0 · Base (colar antes de qualquer tela)

**Produto:** PWA em português do Brasil (React + TypeScript + Vite). Mercadinhos de bairro publicam lotes de produtos embalados perto do vencimento, com desconto. O consumidor reserva pelo celular, retira e paga na loja informando um código de 6 dígitos que o lojista digita. Não há pagamento online, entrega nem mapa.

**Nome do app:** ainda não definido. Use o espaço reservado "[Nome do app]".

**Perfis (login único, decidido em 23/10):**
- **Consumidor:** qualquer conta sem vínculo com loja.
- **Funcionário** (vínculo com uma loja): opera o dia a dia.
- **Responsável** (vínculo com uma loja): é lojista e gestor ao mesmo tempo. Faz o que o funcionário faz e ainda vê painéis, projeção e configurações.

**Dispositivos:**
- Consumidor e lojista: celular, artboard de 390 × 844. Sem barra de status falsa.
- Gestor: desktop, página fluida com 1440 px de referência e conteúdo com largura máxima de 1240 px. Em telas estreitas, o menu lateral empilha em cima.

**Tipografia:** Plus Jakarta Sans (Google Fonts), pesos 400, 500, 600, 700 e 800. Números com `tabular-nums`.

| Uso | Tamanho / peso |
|---|---|
| Título de lista | 24 / 800 |
| Título de tela | 20 / 700 |
| Título de card | 16 / 700 |
| Corpo | 15 / 400, entrelinha 1,45 |
| Rótulo | 14 / 600 |
| Legenda | 13 / 400 |
| Sobrelinha | 12 / 700, maiúsculas, espaçamento 0,06 em |
| Números de contador | 44 a 64 / 800 |

**Cores (paleta oficial: original verde):**

| Token | Hex | Uso |
|---|---|---|
| `bg` | #F6F5F1 | fundo da tela |
| `surface` | #FFFFFF | cards, campos, cabeçalhos |
| `ink` | #1B1F1C | texto |
| `muted` | #5B635D | texto secundário |
| `muted-2` | #4A4F4B | rótulos sobre cinza |
| `line` | #E3E1DA | borda de card |
| `line-strong` | #C9C6BC | borda de campo e botão secundário |
| `primary` | #1E6A48 | ação principal, preço com desconto, item ativo |
| `primary-dark` | #14503A | texto sobre `primary-soft` |
| `primary-soft` | #E3F0E8 | destaque suave, botão "−" |
| `discount` | #C2410C | selo de desconto (texto branco) |
| `placeholder` | #EDEBE4 / ícone #8A8678 | imagem de produto (o escopo não tem foto) |
| `neutral` | #ECEBE5 | esqueleto de carregamento, fundo de quadros de estado |
| `warn` | #FEF3C7 / texto #6B3F00 | parcial, colisão, compromisso |
| `danger` | #FDE8E7 / texto #8A1C13; forte #A3261B; borda #E7B4AE | erro, cancelar |
| `urgent` | #B42318 | prazo curto, contador de avisos |
| `success` | #E4F1E4 / texto #1F5B2A | retirada, oferta ativa |
| `pending` | #FBEFD0 / texto #6B4A00 | reservada, servidor acordando |
| `chart-expirada` | #E8913A | gráfico do painel |

**Selos de estado (pílula, 12 / 700):**
- Reservada: `pending`
- Retirada: `success`
- Expirada: `neutral` com texto `muted-2`
- Cancelada: `danger`
- Oferta ativa: `success`
- Oferta encerrada: `neutral`
- Aviso adiado: `warn`
- Conferir: `danger`
- Aguardando aviso: `primary-soft`

**Fitas (6 cores fixas, uma por bimestre de vencimento, ciclo anual):**

| Bimestre | Cor | Hex |
|---|---|---|
| jan–fev | Vermelho | #D7263D |
| mar–abr | Amarelo | #F4C430 |
| mai–jun | Verde | #2E9E4F |
| jul–ago | Azul | #1F5FBF |
| set–out | Branco | #FFFFFF, borda #9A968A |
| nov–dez | Preto | #1B1B1B |

A amostra da fita aparece sempre junto com o nome da cor e a data exata, nunca só a cor (por causa de daltonismo e iluminação).

**Medidas:**
- Margem lateral de 16 px.
- Raio: campo e botão 12–14, card 16, bloco de destaque 20, folha inferior 24 (cantos de cima).
- Toque mínimo de 44 px.
- Botão primário: 56 px de altura, largura total.
- Botão secundário: 52 px, fundo branco, borda 1,5 px `line-strong`.
- Botão de perigo: 52 px, borda `danger` e texto #A3261B.

**Componentes (artboard "Componentes e tokens"):**
- **Contador −/+** em três tamanhos: 60 px (consumidor), 72 px (cadastro) e 96 px (conferência). Nunca abre teclado. No limite, o botão fica com 40% de opacidade.
- **Chips:** 36–40 px, pílula. Ativo com fundo `primary` e texto branco.
- **Seletor em grade:** janela de reserva e desconto.
- **Card de oferta.**
- **Folha inferior (bottom sheet):** puxador de 40 × 4 e fundo com véu `rgba(27,31,28,.45)`.
- **Toast:** fundo `ink`, aparece por 4 s.
- **Esqueleto de carregamento.**
- **Estado vazio:** ícone + frase + uma ação.

**Comportamentos globais:**
1. **Servidor acordando.** O Render gratuito dorme depois de cerca de 15 min sem uso e leva cerca de 1 min para acordar. Toda tela que chama a API mostra a faixa `pending` com o texto "Conectando ao servidor… pode levar até 1 minuto" e esqueletos. Ela nunca trava.
2. **Estado sempre fresco.** A expiração é conferida em toda leitura do backend. Por isso, as telas de reserva, código, oferta e painel recarregam ao abrir e a cada 30 s enquanto estão visíveis.
3. **Erros de regra viram mensagens, não códigos HTTP** (formatos em `docs/api/contrato.md`):
   - reserva: parcial é sucesso (`201`, `status: parcial`); só a recusa vem como `409` (C5);
   - ajuste acima do livre: mensagem inline em L11;
   - código inexistente: L13 "não encontrado".
4. **Acessibilidade:**
   - botões reais e `aria-label` em botões só de ícone;
   - `role="dialog"` nas folhas e `role="alert"` nos erros;
   - contraste de pelo menos 4,5:1;
   - cor nunca é o único sinal.
5. **Navegação inferior:**
   - consumidor: Vitrine · Reservas · Perfil;
   - lojista: Início · Lotes · Avisos (com contador) · Retirada.

**Dados de exemplo:** loja "Mercadinho Vila Nova", Rua das Palmeiras, 410 · Boa Vista. "Hoje" = 22/10/2026. Os números são fictícios.

---

## Mapa de rotas sugerido (React Router)

| Código | Tela | Rota | Perfil |
|---|---|---|---|
| A1 | Abertura | `/` (antes de resolver a sessão) | todos |
| A2 | Entrar | `/entrar` | todos |
| A3 | Criar conta | `/criar-conta` | todos |
| A4 | Escolher como entrar | `/escolher` | quem tem vínculo |
| A5 | Entrar no computador | `/entrar` (≥ 1024 px) | todos |
| C1 | Localização e avisos | `/boas-vindas` | consumidor |
| C2 / C3 | Vitrine e estados | `/vitrine` | consumidor (e visitante) |
| C4 | Reserva da quantidade | `/oferta/:ofertaId` | consumidor |
| C5 | Resultado da reserva | `/reserva/:id/resultado` | consumidor |
| C6 / C7 | Código e desfechos | `/reservas/:id` | consumidor |
| C8 | Minhas reservas | `/reservas` | consumidor |
| C9 | Perfil | `/perfil` | consumidor |
| L1 | Início da loja | `/loja/:lojaId` | funcionário, responsável |
| L2 | Novo produto | `/loja/:lojaId/produtos/novo` | idem |
| L3 | Cadastro do lote | `/loja/:lojaId/lotes/novo` | idem |
| L4 | Lotes e fitas | `/loja/:lojaId/lotes` | idem |
| L5 | Avisos | `/loja/:lojaId/avisos` | idem |
| L6 | Conferência | `/loja/:lojaId/avisos/:avisoId` | idem |
| L7 | Revisar e publicar | `/loja/:lojaId/avisos/:avisoId/publicar` | idem |
| L8 | Adiar / publicada | folha em L6 / `/loja/:lojaId/ofertas/:id?nova=1` | idem |
| L9 | Ofertas | `/loja/:lojaId/ofertas` | idem |
| L10 | Detalhe da oferta | `/loja/:lojaId/ofertas/:id` | idem |
| L11 | Ajuste | `/loja/:lojaId/ofertas/:id/ajuste` | idem |
| L12 / L13 | Validar retirada e resultado | `/loja/:lojaId/retirada` | idem |
| L14 | Configurações | `/loja/:lojaId/config` | responsável |
| G1 | Painel | `/loja/:lojaId/painel` | responsável |
| G2 | Projeção | `/loja/:lojaId/projecao` | responsável |
| G3 | Histórico de reservas | `/loja/:lojaId/reservas` | responsável |
| G4 | Ofertas (desktop) | `/loja/:lojaId/ofertas` (≥ 1024 px) | responsável |
| G5 | Lotes e fitas (desktop) | `/loja/:lojaId/lotes` (≥ 1024 px) | responsável |
| G6 | Configurações (desktop) | `/loja/:lojaId/config` (≥ 1024 px) | responsável |

---

# Página 1 · Acesso

## A1 · Abertura (servidor acordando)
**Objetivo:** mostrar que o app está carregando enquanto a API do Render acorda e a sessão é verificada.

**Layout:** a tela inteira em `primary`, com o conteúdo centralizado:
- ícone do app (104 × 104, raio 30, fundo branco, ícone de casinha em `primary`);
- "[Nome do app]" (40 / 800, branco);
- "[Slogan a definir]" (18, #CFE6DA).

No rodapé, uma faixa #14503A com spinner, "Conectando ao servidor…" e, na linha de baixo, "Na primeira abertura do dia pode levar até 1 minuto". Abaixo dela, o link "Pular para o login".

**Comportamento:**
1. Faz `GET /health`.
2. Depois de responder, se há token: vai para A4 (se a conta tem vínculo) ou para C2.
3. Sem token: vai para A2.
4. Depois de 90 s sem resposta: mostra "O servidor não respondeu. Tentar de novo".

## A2 · Entrar
**Layout:**
- ícone 56 × 56;
- "Entrar" (28 / 800);
- texto: "Uma conta só para comprar e, se você trabalha numa loja parceira, para operar a loja";
- campo E-mail (`type=email`, `autocomplete=email`);
- campo Senha com botão de olho "Mostrar senha";
- link "Esqueci minha senha", alinhado à direita.

No rodapé: botão primário "Entrar", botão secundário "Criar conta" e o link "Só olhar as ofertas, sem entrar".

**Estado de erro** (ajuste `erro`): caixa `danger`, "E-mail ou senha incorretos. Confira e tente de novo."

**API:** `POST /auth/login` → token. Login por e-mail e senha com token do DRF ainda está **a confirmar**.

## A3 · Criar conta
**Layout:**
- cabeçalho com voltar e "Criar conta";
- campos Nome, E-mail e Senha (dica: "Pelo menos 8 caracteres");
- caixa de seleção "Li e aceito os termos de uso. Meus dados são usados só para as reservas";
- caixa informativa `primary-soft`: "Trabalha numa loja parceira? Crie a conta normalmente. O responsável da loja vincula você pelo seu e-mail";
- botão "Criar conta", que leva a C1.

**Validação inline:** e-mail já usado, senha curta e termos não aceitos (botão desabilitado).

## A4 · Escolher como entrar
**Mudou em 18/11/2026:** aparece sempre depois de entrar (inclusive sem vínculo e no computador) e ganha os cartões "Equipe da plataforma" e "Tenho um mercado". Telas novas A6, A7 e P1–P3 e as regras: ver [`docs/parceria.md`](../parceria.md). Onde divergir, vale o `parceria.md`.


**Layout:**
- "Olá, Ana" e o título "Como você quer entrar?" (26 / 800);
- card **Comprar com desconto** (ícone de vitrine em `primary-soft`), que leva a C2;
- sobrelinha "MINHAS LOJAS";
- um card por vínculo: ícone da loja, nome e selo do papel (Responsável em `primary-soft`, Funcionário em `neutral`). Leva a L1;
- caixa "Lembrar minha escolha neste aparelho", que grava em `localStorage`. Dá para trocar no Perfil (C9) e em L1.

---

# Página 2 · Consumidor

## C1 · Localização e avisos de oferta (2 telas)
**1. Localização** (primeiro acesso):
- ícone de pino e o título "Ofertas perto de você";
- texto: "Usamos sua localização só para ordenar as lojas pela distância. Nada fica gravado";
- botão "Usar minha localização" (`navigator.geolocation`);
- divisor "ou";
- campo CEP com botão "Buscar" e a dica "Se o navegador negar a localização, o CEP é o caminho";
- link "Ver todas sem ordenar por distância".

**2. Avisos de oferta nova** (folha inferior sobre a vitrine):
- ícone de sino e o título "Quer saber das ofertas novas?";
- texto: "Avisamos só quando uma loja publicar uma oferta. Nada de lembrete de reserva nem propaganda";
- nota sobre iPhone: "Adicione à Tela de Início";
- botão "Ativar avisos" (pede permissão de Notification e se inscreve no Web Push);
- link "Agora não".

**Regras:**
- A coordenada do consumidor nunca é gravada: ela vai na consulta, a API ordena por Haversine e descarta.
- O push é só para oferta nova e só se o consumidor permitir.
- **A confirmar:** o serviço de push e o serviço de CEP para coordenada.

## C2 · Vitrine com filtros (Figura 4)
**Muda com o grupo J (pedido, 23/11/2026):** ícone de sacola com a contagem de itens do pedido; a tela nova **C10 · Meu pedido** (carrinho por loja, só no aparelho). Regras e telas: ver [`docs/pedido.md`](../pedido.md); rotas: seção J do contrato. Onde divergir, vale o `pedido.md`.

**Cabeçalho branco:**
- "Ofertas perto de você" e o botão de local com pino `primary`: "Boa Vista · CEP 15025-000 ▾" (abre C1);
- busca de 46 px;
- chips de categoria: Todos, Mercearia, Enlatados, Laticínios, Leite, Frios, Doces (linha rolável; **lista única**, a mesma da L2);
- chips de desconto: Todas, Até 30% (≤ 30), 30–50% (> 30 e < 50), 50%+ (≥ 50).

**Lista:** começa com "N ofertas · ordenadas por distância". Cada card leva a C4 e tem:
- imagem placeholder de 84 × 84 com o selo "−30%" em `discount`;
- nome (15 / 700) e "loja · distância" (13, `muted`);
- preço com desconto (18 / 800, `primary`) e o preço original riscado;
- "Vence 28/10 · **12** disponíveis".

**Navegação inferior:** Vitrine ativa.

**API:** `GET /api/ofertas?lat=&lng=&categoria=&faixa_desconto=&q=` (ver contrato, grupo B). Retorna oferta, produto, loja, `distancia_km`, `preco`, `preco_original`, `livre` (já descontando as vencidas) e `validade`. `lat`/`lng` vêm da localização do navegador ou do CEP convertido **no navegador**.

**Dados de exemplo:** ver o artboard (iogurte 30%, presunto 40%, biscoito 25%, molho 50%).

## C3 · Vitrine — estados
1. **Carregando:** cabeçalho, faixa "Conectando ao servidor…" e 4 cards esqueleto.
2. **Vazio:** chips ativos (Frios, 50%+), ícone, "Nenhuma oferta com esses filtros", o texto "As lojas publicam ofertas ao longo do dia…", o botão "Limpar filtros" e o link "Ativar avisos de oferta".
3. **CEP não encontrado:** campo com borda `danger`, "Não encontramos esse CEP. Confira os números", e os botões "Buscar de novo" e "Usar minha localização". Nota: sem local, a vitrine aparece sem ordem de distância.

## C4 · Reserva da quantidade (Figura 4)
**Muda com o grupo J (pedido, 23/11/2026):** "Adicionar ao pedido" (principal) e "Reservar só este agora" (secundário). Regras e telas: ver [`docs/pedido.md`](../pedido.md); rotas: seção J do contrato. Onde divergir, vale o `pedido.md`.

**Layout:**
- imagem de 165 px de altura, com o selo de desconto à direita e o botão voltar redondo à esquerda;
- título do produto (22 / 800) e preço (24 / 800, `primary`), com o original riscado e "· vence 28/10/2026";
- loja com endereço e distância;
- "Quantidade" com "12 disponíveis" à direita e contador de 60 px (mínimo 1, máximo = livre);
- card de janela: "Retire até **hoje, 20:00** (janela de 4 h). O pagamento é feito na loja, na retirada";
- botão "Reservar 2 · R$ 6,28", que recalcula ao mudar a quantidade.

**Estados** (ajuste `estado`):
- **normal**;
- **poucas unidades:** caixa `warn` "Restam só 2 unidades. Se alguém reservar antes de você, reservamos o que sobrar…";
- **esgotada:** caixa `danger`, sem contador, botão desabilitado "Indisponível".

**API:** `POST /ofertas/:id/reservas {pedido}`. A resposta traz `quantidade`, `pedido`, `codigo` e `expira_em`, ou o motivo da recusa. Vai para C5.

**Regras:**
- `expira_em = mín(agora + janela, fim da oferta)`, calculado **só no backend**. A tela exibe o horário que o servidor devolve e nunca calcula a expiração sozinha. O protótipo do Claude Design calcula "agora + janela" localmente só para simular; isso não vale para o código.
- O consumidor precisa estar logado. Se não estiver, reservar leva a A2 e depois volta para cá.

## C5 · Resultado da reserva (3 estados)
**Muda com o grupo J (pedido, 23/11/2026):** resultado por item (tudo confirmado, algo mudou, nada sobrou). Regras e telas: ver [`docs/pedido.md`](../pedido.md); rotas: seção J do contrato. Onde divergir, vale o `pedido.md`.

1. **Confirmada:** círculo `primary-soft` com ✓, "Reservado!", "2 × Iogurte natural 170 g · Mercadinho Vila Nova", "Retire até hoje, 20:00. Você paga R$ 6,28 na loja", botão "Ver código de retirada" (vai para C6).
2. **Parcial:** círculo `warn` com "!", "Reservamos 2 de 3", "Alguém reservou antes e só restavam 2 unidades. Elas já estão separadas para você", um card com o item e o total, botão "Manter as 2 unidades" (C6) e botão de perigo "Cancelar a reserva" (C7, folha).
3. **Recusada:** círculo `danger` com ×, "Esgotou agora há pouco", o texto explicando que a oferta volta se alguém cancelar ou deixar expirar, e o botão "Ver outras ofertas". O backend grava isso como **Recusa**, que entra em "compradores bloqueados". A reserva parcial também entra (ver G1).

## C6 · Código de retirada (Figura 4)
**Muda com o grupo J (pedido, 23/11/2026):** um código por pedido, com a lista dos itens ativos e o prazo do primeiro que vence. Regras e telas: ver [`docs/pedido.md`](../pedido.md); rotas: seção J do contrato. Onde divergir, vale o `pedido.md`.

**Layout:**
- cabeçalho "Sua reserva";
- card central com:
  - pílula "✓ Reserva confirmada";
  - "Código de retirada";
  - 6 caixas de 46 × 62 com dígitos de 34 / 800, em dois grupos de 3;
  - contagem regressiva "3 h 42 min" (28 / 800, `primary`) e, embaixo, "para retirar · até hoje, 20:00";
  - instrução: "Informe este código no balcão. O lojista digita o código e você paga na retirada";
- card de detalhes: item e quantidade, "A pagar na loja: R$ 6,28", loja e endereço;
- botão de perigo "Cancelar reserva" (abre a folha de C7).

**Regras:**
- O código tem 6 dígitos e é único entre as reservas ativas da loja.
- A contagem é local, mas o estado é revalidado a cada 30 s. Se a reserva virar expirada ou retirada, a tela muda para o estado de C7.

## C7 · Reserva — desfechos (3 estados)
**Muda com o grupo J (pedido, 23/11/2026):** desfechos por pedido. Regras e telas: ver [`docs/pedido.md`](../pedido.md); rotas: seção J do contrato. Onde divergir, vale o `pedido.md`.

1. **Confirmar cancelamento** (folha sobre C6): "Cancelar esta reserva?", o texto "As 2 unidades… voltam para a vitrine na hora… Não dá para desfazer", o botão de perigo sólido "Sim, cancelar" e o secundário "Manter reserva". **API:** `POST /reservas/:id/cancelar`.
2. **Expirada:** selo Expirada, o código riscado em `placeholder`, o texto "O prazo terminou hoje às 20:00 sem retirada. As unidades voltaram para a vitrine e este código não vale mais", e o botão "Ver se ainda tem na vitrine".
3. **Retirada:** círculo `success` com ✓, selo Retirada, "Retirada hoje às 18:12 · Obrigado por evitar desperdício!", o valor pago, "Você economizou R$ 2,70" e o botão "Voltar para a vitrine".

## C8 · Minhas reservas
**Muda com o grupo J (pedido, 23/11/2026):** um cartão por pedido. Regras e telas: ver [`docs/pedido.md`](../pedido.md); rotas: seção J do contrato. Onde divergir, vale o `pedido.md`.

**Layout:** título "Minhas reservas" e abas **Ativas (n)** e **Histórico** (sublinhado de 3 px em `primary`). Cada card de reserva tem:
- produto e selo de estado;
- "quantidade · loja";
- separador;
- nas ativas: o código em 22 / 800 e o tempo restante (`primary`, ou `urgent` quando falta menos de 30 min);
- no histórico: "Retirada em…", "Expirou em…" ou "Cancelada em…".

Tocar no card leva a C6 ou C7. Navegação inferior com Reservas ativa.

**API:** `GET /minhas-reservas?estado=ativa|encerrada`.

## C9 · Perfil e preferências
**Layout:**
- cabeçalho com avatar de iniciais, nome e e-mail;
- seção PREFERÊNCIAS:
  - Localização (CEP atual, "não fica gravado"), que abre C1;
  - interruptor "Avisos de oferta nova";
  - "Instalar na tela inicial" (prompt `beforeinstallprompt`);
- seção MINHAS LOJAS, só com vínculo: card da loja com o papel e "entrar como loja", que leva a L1;
- botão de perigo "Sair da conta".

---

# Página 3 · Lojista

Telas comuns a Funcionário e Responsável, salvo L14. No celular, a navegação inferior tem Início · Lotes · Avisos (contador `urgent`) · Retirada.

## L1 · Início da loja
**Cabeçalho `primary`:**
- data ("Sexta, 23 de outubro"), nome da loja (22 / 800) e selo do papel;
- botões de 44 px: Configurações (só para o responsável) e Trocar perfil (vai para A4).

**Corpo:**
- três indicadores do dia: reservas aguardando retirada, que expiram em menos de 1 h (`urgent`) e ofertas ativas;
- botão grande **Validar retirada** (largura total, 96 px, `primary`), que leva a L12;
- grade 2 × 2 de atalhos: Cadastrar lote (L3), Avisos de validade ("5 para conferir", L5), Ofertas (L9), Lotes e fitas (L4);
- faixa `primary-soft`: "Painel e projeção (melhor no computador)", que leva a G1 (só para o responsável).

**API:** `GET /lojas/:id/resumo-do-dia`.

## L2 · Novo produto
Usado quando o produto não existe na busca de L3.

**Campos:**
- Nome do produto, com a dica "Inclua o tamanho da embalagem";
- Categoria (chips únicos): Mercearia, Enlatados, Laticínios, Leite, Frios, Doces (**lista única**, a mesma da vitrine C2);
- card "Fim da oferta antes da validade": opção "Usar a margem da loja (1 dia)" ou "Margem própria deste produto", com o exemplo "validade 18/12 e margem de 1 dia → sai em 17/12. Mudar depois vale só para ofertas novas".

Caixa `warn` com o escopo: "Só produtos embalados e fechados, vendidos por unidade. Nada vendido a peso no balcão, hortifrúti ou pão."

Botão "Salvar e cadastrar o lote", que volta para L3 com o produto selecionado.

**API:** `POST /api/lojas/:id/produtos {nome, categoria, margem_fim_dias}` (contrato, grupo D).

## L3 · Cadastro do lote (Figura 3)
Já descrito na versão 1.

**Campos:**
- Produto (busca no catálogo da loja, com a opção "+ Novo produto", que abre L2);
- Validade impressa (dd/mm/aaaa, teclado numérico);
- Quantidade recebida (contador de 72 px).

**Card "Cor da fita":** amostra de 64 × 64, o nome da cor (26 / 800), "Bimestre de vencimento: nov–dez" e uma de três caixas (ajuste `estado`):
- **agrupado:** "Agrupado ao grupo Preto ativo. Data de referência do grupo: 09/12/2026 (a mais próxima)";
- **novo grupo:** "Novo grupo Preto criado…";
- **colisão** (`warn`, `role=alert`): "ainda há lote Preto do ano anterior ativo para este produto (validade 22/12/2025). Separe as zonas antes de colar a fita".

Instrução final: "Cole a fita preta na caixa e posicione a divisória na zona Preto da gôndola".

Botão "Salvar lote e agendar aviso". O aviso é agendado pela antecedência da loja.

**Regras** (calculadas no backend; a tela mostra o `resultado` de `POST /api/lojas/:id/lotes`):
- A cor vem do bimestre da data **absoluta** de validade.
- Grupo = produto + cor + **ano do bimestre**. Mesmo produto, mesma cor e mesmo ano de um grupo ativo = agrega ao grupo, e a referência passa a ser a data mais próxima.
- Colisão = grupo ativo do mesmo produto e mesma cor, mas de outro ano: cria grupo novo, avisa e não bloqueia. Exemplo realista: lote novo de feijão com validade 18/12/2027 chegando enquanto ainda há o grupo Preto de 2026 (validade 09/12/2026).

## L4 · Lotes e fitas
**Layout:**
- título e subtítulo "Grupos por produto e cor · referência = data mais próxima";
- chips de filtro por cor, com bolinha da cor (Todas, Branco, Preto, Vermelho…);
- cards de grupo, cada um com:
  - amostra de 44 px, produto e selo do estado (Em oferta, Adiado, Conferir, Aguardando);
  - "Fita **Cor** · ref. data · n lotes";
  - linha de situação ("Aviso em 29/11 (antecedência de 10 dias)" e similares);
  - selo `warn` de colisão, quando houver;
- botão flutuante "+ Cadastrar lote" (56 px, pílula), que leva a L3.

## L5 · Lista de avisos (Figura 3)
Já descrito na versão 1.

**Layout:** cabeçalho com "5 avisos · antecedência da loja: 10 dias" e uma lista ordenada pelo vencimento mais próximo. Cada card leva a L6 e tem:
- amostra de 48 px;
- produto;
- "Fita **Cor** · vence data";
- prazo: urgente em `urgent` quando faltam até 7 dias, normal em `muted`, ou adiado em `warn` ("Adiado · volta amanhã").

Estado vazio: "Nenhum aviso agora. Você será avisado conforme a antecedência configurada."

## L6 · Conferência na gôndola (Figura 3)
**Layout:**
- card do produto: amostra de 72 px, "Zona **Branco** · set–out" e "Data mais próxima: **28/10/2026**";
- instrução "Vá à zona Branco da gôndola e conte as unidades que vão para a oferta";
- contador de **96 px**, sem digitação (aqui **só se conta**; preço e desconto ficam na L7, decidido 05/11/2026);
- botão "Continuar para publicar" (L7);
- botão "Adiar aviso", que abre a folha de L8;
- link "Não vai para oferta" (decidido 05/11/2026): abre uma folha com o motivo — "Não sobrou nenhuma unidade" ou "Outro destino" — e o botão "Encerrar aviso". Encerra o grupo sem criar oferta e **não conta como perda** no painel. **API:** `POST /api/lojas/:id/avisos/:avisoId/descartar {motivo}`.

## L7 · Revisar e publicar oferta
**Layout:**
- resumo: amostra da fita, produto, "Fita Branco · validade 28/10/2026" e "12 separadas" (o número da contagem);
- duas colunas: Preço normal (campo, **pré-preenchido com o preço original da última oferta do produto**, `preco_sugerido` da API; vazio na primeira oferta) e Preço na oferta (`primary-soft`, com o desconto em `discount`);
- desconto: 4 botões (20/30/40/50%) com a prévia do preço ("De ~~R$ 4,49~~ por R$ 3,14"). O valor oficial é o que a API devolve ao publicar (arredondamento no backend);
- Janela de reserva em grade de 6 opções (1, 2, 4, 8, 12 e 24 h). Vem marcada com o padrão da loja (4 h) e tem a dica "Janelas curtas fazem quem mora longe perder a reserva";
- card de fim: "Sai da vitrine em 27/10/2026, 23:59 · Validade menos 1 dia de margem. Nenhuma reserva passa desse horário; o que sobrar livre vira perda";
- caixa de seleção `warn` obrigatória: "**Separei as 12 unidades** na área de reservas e não vou vendê-las no balcão";
- botão "Publicar oferta". Sem a caixa marcada, ele fica desabilitado com o texto "Confirme a separação".

**API:** `POST /api/lojas/:id/avisos/:avisoId/publicar {separado, preco_original, desconto, janela_horas, confirmou_separacao}`. O backend calcula o preço, o `fim` (23:59 do dia validade − margem efetiva) e grava.

**Regras:**
- `livre = separado` no início.
- O preço da oferta precisa ser maior que 0 e menor que o original (trava do banco).
- **Estado de erro:** se o fim já passou (validade próxima demais), a API responde `409 fim_ja_passou`; a tela mostra "Essa validade está perto demais: a oferta acabaria antes de começar".

## L8 · Adiar aviso e oferta publicada
1. **Adiar** (folha sobre L6): "Lembrar de novo quando?", produto, zona e vencimento, uma grade com Amanhã, Em 2 dias, Em 3 dias e Escolher data, e o botão "Adiar aviso" (volta para L5). **Limite (decidido 05/11/2026):** até a véspera do último dia da oferta (`adiar_ate_max` da API). Ex.: validade 05/11, margem 1 dia → a oferta iria até 04/11, 23:59 → adiar até 03/11. Opções além do limite ficam desabilitadas, com a dica "Depois disso não dá tempo de ofertar".
2. **Oferta publicada:** ✓ "Oferta na vitrine", um card com quantidade, preço, janela e "Sai da vitrine 27/10, 23:59", o texto "Quem ativou os avisos de oferta foi notificado", e os botões "Ver a oferta" (L10) e "Próximo aviso" (L5).

## L9 · Ofertas da loja
**Layout:** abas **Ativas (n)** e **Encerradas**. Cada card leva a L10 e tem:
- bolinha da fita, produto e preço;
- **barra empilhada de estoque**: retirado #14503A, reservado #E9B23A, livre #9CC9A0, perda/ajuste #A3261B;
- resumo ("6 livres · 4 reservadas · 2 retiradas") e fim ("até 27/10", em `urgent` quando é hoje ou amanhã).

Legenda da barra no fim da lista.

## L10 · Detalhe da oferta
**Cabeçalho:** produto, "Fita · preço · janela" e selo Ativa ou Encerrada.

**Ativa** (ajuste `estado = ativa`):
- card de fim ("Sai da vitrine em 27/10, 23:59…");
- card **Estoque** com "Unidades separadas: 12" e 5 caixas coloridas: livre 6, reservado 4, retirado 2, ajustado 0, perda 0. Embaixo, a fórmula "Separado = livre + reservado + retirado + ajustado + perda";
- lista "Reservas aguardando retirada", com código mascarado (••• 917), quantidade e "expira em…";
- rodapé com os botões "Ajustar estoque" (L11) e "Validar retirada" (L12).

**Encerrada:** caixa `danger` "Encerrada em 27/10, 23:59. 3 unidades livres foram registradas como perda. Tire-as da área de reservas e dê o destino", as caixas com perda 3 e a lista de reservas com o estado final de cada uma. Sem botões.

## L11 · Ajuste de estoque
**Layout:**
- caixa `primary-soft`: "Só dá para tirar do estoque livre (6 un.). As 4 unidades reservadas estão prometidas a clientes e não entram no ajuste";
- contador de 80 px, com mínimo 1 e máximo = livre. Ao tentar passar do máximo, aparece "Máximo: 6, o estoque livre agora";
- Motivo (obrigatório) em grade 2 × 2: Danificada, Extraviada, Vendida no balcão, Outro. "Outro" abre um campo de texto;
- rodapé com a prévia "Depois do ajuste: livre X · ajustado Y" e o botão "Registrar ajuste de N un.".

**API:** `POST /ofertas/:id/ajustes {quantidade, motivo}`. A resposta 409 vira mensagem inline.

## L12 · Validar retirada
**Muda com o grupo J (pedido, 23/11/2026):** o código é do pedido (a prévia é `GET /api/lojas/{lojaId}/pedidos/ativo`). Regras e telas: ver [`docs/pedido.md`](../pedido.md); rotas: seção J do contrato. Onde divergir, vale o `pedido.md`.

**Layout:**
- cabeçalho "Validar retirada · 6 aguardando";
- texto "Digite o código de 6 dígitos que o cliente mostra no celular";
- 6 caixas de 48 × 64. A caixa atual fica com borda `primary` de 2 px e anel `primary-soft`;
- **teclado numérico próprio** em grade 3 × 4 (teclas de 64 px): 1–9, Limpar, 0, ⌫;
- botão "Buscar reserva", que só aparece com os 6 dígitos. Antes disso, fica desabilitado com "Faltam N dígitos".

**API:** `GET /lojas/:id/reservas/ativa?codigo=` procura a reserva ativa **daquela loja**.

## L13 · Retirada — resultado (3 estados)
**Muda com o grupo J (pedido, 23/11/2026):** lista dos itens ativos do pedido e "Cobrar no caixa: R$ X". Regras e telas: ver [`docs/pedido.md`](../pedido.md); rotas: seção J do contrato. Onde divergir, vale o `pedido.md`.

1. **Encontrada:**
   - "Código 482 917", cliente "Ana S." e selo "Reservada · expira em 3 h 42";
   - item com amostra da fita e "Zona Branco · área de reservas";
   - "Cobrar no caixa: **R$ 6,28**" (30 / 800);
   - caixa `warn`: "Retirada tudo ou nada: entregue as 2 unidades. Se o cliente quiser menos, ele cancela no app e reserva de novo";
   - botão "Entreguei e cobrei · confirmar" (`POST /api/lojas/:id/retiradas {codigo}`: a retirada é por loja + código, não pelo id da reserva) e botão "Voltar".
2. **Não encontrado:** caixa `danger` "Nenhuma reserva ativa com esse código nesta loja", com as causas possíveis (digitado errado, expirada ou cancelada, de outra loja), o aviso "Não entregue o produto sem validar" e o botão "Digitar de novo".
3. **Confirmada:** ✓ "Retirada registrada", item, valor, hora, quem registrou e "A oferta agora tem 6 livres e 2 reservadas", e os botões "Validar outro código" e "Início".

## L14 · Configurações da loja (só o responsável)
Tela rolável de 390 × 1300; no desktop, centralizada com largura máxima de 560 px.

**Dados da loja:**
- Nome;
- Endereço, com a confirmação "✓ Localização encontrada · usada para calcular a distância" (geocodificação feita uma vez).

**Regras das ofertas:**
- Janela de reserva padrão (grade de 6 opções), com o link "Ver projeção" (G2);
- Margem antes da validade (contador em dias, padrão 1);
- Antecedência do aviso (contador em dias);
- nota: "Mudanças valem para lotes e ofertas novos".

**Equipe:**
- lista de vínculos (avatar, nome, papel, botão "Remover", exceto para a própria pessoa);
- caixa tracejada "Adicionar pessoa pelo e-mail da conta", com a escolha Funcionário ou Responsável e o botão "Adicionar à equipe".

Botão "Salvar alterações".

---

# Página 4 · Gestor (Responsável, desktop)

**Menu lateral** (232 px, branco), com o item ativo em `primary-soft`: Painel · Projeção · Ofertas · Lotes e fitas · Reservas · Configurações. Ofertas, Lotes e Configurações têm versão desktop própria (G4, G5, G6). Mesma rota do celular: a partir de 1024 px o layout troca para a versão com menu lateral.

## G1 · Painel de acompanhamento (Figura 6)
Já descrito na versão 1.

**Layout:**
- título e "Indicadores lidos do banco · período";
- controle de período: 7 dias, 30 dias, Mês atual;
- 5 cartões: Reservas criadas, Taxa de retirada (`primary`), Taxa de expiração (#B4530C), Compradores bloqueados, Perda no encerramento;
- **definições (decididas em 04/11/2026):**
  - **Taxa de retirada** = retiradas ÷ reservas **encerradas** (retiradas + expiradas + canceladas). Reservas ainda em andamento ficam fora da conta. Nota do cartão: "das reservas encerradas".
  - **Taxa de expiração** = expiradas ÷ reservas encerradas.
  - **Compradores bloqueados** = recusas totais (pediu e levou 0, tabela `Recusa`) **+** reservas parciais (`quantidade < pedido`). É a mesma definição do `simulacao.py` (`bloqueados = bloq_total + bloq_parcial`) e da Tabela 5 do artigo. O cartão mostra o total grande e, embaixo, a divisão: "17 sem nada · 6 levaram menos do que pediram".
  - **Perda no encerramento** = soma da sobra livre das ofertas encerradas no período (unidades).
- gráfico de barras empilhadas por semana: retiradas `primary`, expiradas #E8913A, canceladas `line-strong`;
- tabelas **Ofertas ativas** (produto, fita, livre, reservado, retirado, fim) e **Reservas em andamento** (código mascarado, produto, quantidade, expira em; menos de 1 h em #B4530C, menos de 30 min em `urgent`).

**API:** `GET /lojas/:id/indicadores?de=&ate=`. Antes de calcular, o backend varre as reservas vencidas. A captura da Figura 6 deve sair do sistema rodando.

## G2 · Projeção da janela de reserva
**Objetivo:** responder "quanto tempo devo dar de reserva?" com o **mesmo motor** da simulação (seção 6.4, nível 1).

**Layout:**
- título e o subtítulo "Compare perda e compradores bloqueados para cada janela";
- faixa `warn` fixa: "**Cenário projetado, não previsão.** Os números vêm de milhares de ofertas simuladas pelo mesmo motor de regras do sistema… Servem para comparar janelas, não para prometer resultado";
- card **Parâmetros do cenário** (decidido 05/11/2026: os controles **filtram as rodadas já simuladas**; nada é simulado na hora):
  - controle deslizante Tamanho do lote, com paradas nas faixas 5–14, 15–24, 25–34, 35–44, 45–60 e a posição "Todos" (padrão);
  - controle deslizante Procura esperada, com paradas nas faixas 0,3–0,8, 0,8–1,3, 1,3–1,8, 1,8–2,3, 2,3–3,0 × o lote e a posição "Todas" (padrão);
  - Tempo típico até o cliente chegar: 1, 2 (padrão) ou 4 h;
  - botão "Atualizar projeção";
  - a frase "Baseado em N rodadas simuladas" (N vem da API), e a nota de que os demais valores seguem as faixas do estudo;
  - com tudo no padrão, a tela mostra exatamente a Tabela 5;
- card **Resultado**:
  - seletor de janela: 30 min, 1, 2, 4, 8, 12 e 24 h;
  - 3 cartões: Perda projetada (`primary-soft`), Compradores bloqueados (#FBE9DE / #8A3108; total + parcial, em % dos compradores) e Taxa de retirada (`neutral`);
  - gráfico de barras agrupadas por janela (perda em `primary`, bloqueados em `discount`), com a janela escolhida em destaque e as outras a 55% de opacidade;
  - texto de leitura: "Janela curta demais: o cliente não chega a tempo e a reserva expira… Janela longa: unidades ficam presas…".
  - **Proibido:** qualquer frase que recomende uma janela ("a janela X equilibra", "a melhor janela é…"). Recomendação de janela é trabalho futuro (nível 3 da seção 6.4); a tela só compara.

**Valores do mock:** os mesmos da Tabela 5 do artigo (`simulacao/resultados_n5000/rodadas.csv`, 5.000 rodadas por janela, cenário base). Assim a tela e o artigo mostram o mesmo número.

| Janela | Perda (% do lote) | Bloqueados (% dos compradores) | Retirada (%) |
|---|---|---|---|
| 0,5 h | 92,6 | 0,6 | 4,6 |
| 1 h | 74,2 | 1,3 | 16,1 |
| 2 h | 48,4 | 5,4 | 34,7 |
| 4 h | 31,3 | 13,8 | 53,3 |
| 8 h | 24,9 | 19,5 | 64,5 |
| 12 h | 23,7 | 21,2 | 67,4 |
| 24 h | 24,4 | 21,8 | 67,4 |

**API:** `GET /api/lojas/:id/projecao?lote=&procura=&chegada=` (contrato, grupo G). Lê um resumo pré-calculado de `simulacao/resultados_n5000/`; não roda a simulação.

## G3 · Histórico de reservas
**Layout:**
- título "Reservas" e "período · 148 reservas · 17 recusas";
- busca "Produto ou final do código";
- chips de estado: Todas, Reservadas, Retiradas, Expiradas, Canceladas, Recusas;
- tabela com as colunas Criada em, Código (mascarado), Produto, Reservado / pedido ("2 / 3" quando parcial; "0 / 1" na recusa), Cliente (nome e inicial), Estado (selo) e Encerrada em;
- nota: "Recusa = tentativa com estoque livre zero. Compradores bloqueados = recusas + reservas parciais (reservado menor que o pedido)".

**Fonte:** tabelas `Reserva` e `Recusa`.

## G4 · Ofertas (desktop)
**Objetivo:** acompanhar todas as ofertas de uma vez. A oferta continua nascendo da conferência de um aviso, no celular (L6 → L7). No desktop não existe o botão "nova oferta".

**Layout:**
- título e subtítulo: "Ofertas nascem da conferência de um aviso, no celular. Aqui você acompanha e ajusta";
- à direita, controle segmentado **Ativas (n)** / **Encerradas (n)**;
- linha de 4 cartões: Livres agora (un.), Reservadas aguardando (un.), Encerram em 48 h (`urgent`), Perda no mês (un.);
- **mestre-detalhe**: tabela à esquerda (flex 3) e painel à direita (flex 2), que empilham em telas estreitas.

**Tabela:**
- colunas: Produto (bolinha da fita + nome), Preço (oferta em `primary` + original riscado), Estoque (barra empilhada retirado/reservado/livre/perda com "N un." embaixo), Livre, Reservado, Perda, Fim;
- o fim fica em `urgent` quando é hoje ou amanhã;
- a linha selecionada fica com fundo `primary-soft`;
- legenda da barra abaixo da tabela.

**Painel de detalhe** (a oferta selecionada; a primeira por padrão):
- nome, "Fita · validade · janela" e selo Ativa ou Encerrada;
- 5 caixas (livre, reservado, retirado, ajustado, perda) e a fórmula de conservação;
- card de fim ("Sai da vitrine em… (validade − 1 dia)" ou "Encerrada em… N unidades registradas como perda");
- lista de reservas aguardando (código mascarado, quantidade, "expira em…");
- botões "Ajustar estoque" (abre L11 em modal, com o mesmo componente) e "Ver reservas" (G3 filtrado).

**API:** `GET /lojas/:id/ofertas?estado=ativa|encerrada` e `GET /ofertas/:id` (com reservas ativas).

## G5 · Lotes e fitas (desktop)
**Layout:**
- título, subtítulo "Grupos por produto e cor. A referência do grupo é a validade mais próxima" e botão "+ Cadastrar lote" (abre L3 em modal);
- **Calendário de fitas**: 6 cartões em linha, um por bimestre, com amostra de 28 px, nome da cor, bimestre e quantos grupos ativos tem;
  - o bimestre do mês atual fica com borda `primary` de 2 px e anel `primary-soft`;
  - nota: "A cor depende da data de validade, não do tempo que falta";
- chips de situação: Todos, Conferir, Adiado, Em oferta, Aguardando aviso.

**Tabela de grupos:**
- colunas: Produto, Fita (bolinha + nome), Referência, Lotes, Recebido (un.), Aviso ("disparado 21/10", "adiado para 23/10", "em 29/11"), Situação (selo + selo `warn` "Colisão de ciclo" quando houver), ›;
- clicar na linha **expande** os lotes do grupo ("Recebido em 22/10 · Validade 18/12/2026 · 24 un.") e, se houver colisão, a frase "Ainda há um lote Preto do ciclo anterior (validade 22/12/2025)…".

**Regra:** todos os lotes de um grupo têm a mesma cor, ou seja, validade no mesmo bimestre.

## G6 · Configurações da loja (desktop)
Mesmo conteúdo de L14, reorganizado para tela larga.

**Layout:**
- duas colunas de cards (`auto-fit`, mínimo de 380 px):
  - **Dados da loja**: nome, endereço e a confirmação "Localização encontrada";
  - **Regras das ofertas**: janela padrão (grade de 6), margem antes da validade (contador em dias, 0–7) e antecedência do aviso (contador em dias);
- card largo **Equipe**:
  - tabela com Pessoa, E-mail da conta, Papel (selo para você, `select` para os outros) e "Remover";
  - linha tracejada "Adicionar pessoa pelo e-mail da conta" com o `select` de papel e o botão "Adicionar";
  - nota: "A pessoa precisa ter criado a conta antes. Uma pessoa tem no máximo um vínculo por loja";
- barra final "Alterações não salvas" com os botões "Descartar" e "Salvar alterações". Ela aparece só quando há mudança.

---

# Acesso no computador

## A5 · Entrar no computador
**Layout:** página dividida em duas metades que empilham em telas estreitas.
- **Esquerda**, faixa `primary`:
  - ícone e "[Nome do app]";
  - título "Produtos perto da validade, com desconto, no mercadinho do bairro." (40 / 800);
  - três linhas com ícone: "Para quem compra…", "Para a loja…", "Para o responsável…";
  - rodapé: "Uma conta só: as telas da loja aparecem para quem tem vínculo com ela".
- **Direita**, cartão de 420 px centralizado:
  - "Entrar" e "Use o e-mail e a senha da sua conta";
  - faixa "Conectando ao servidor…" enquanto a API acorda;
  - E-mail e Senha, com o link "Esqueci minha senha" na mesma linha do rótulo;
  - caixa "Manter conectado neste computador";
  - botão "Entrar";
  - "Não tem conta? Criar conta".

**Destino depois de entrar:** responsável vai para G1. Funcionário vai para L1 em versão responsiva. Consumidor vai para C2 centralizada.

---

## Decisões de 05/11/2026 (aplicadas acima e em `docs/api/contrato.md`)

- **Login:** só e-mail e senha. **Permissões:** funcionário faz L1–L13; responsável faz tudo isso, mais L14 e G1–G6; o consumidor vê e cancela só as próprias reservas.
- **Visitante:** "Só olhar as ofertas, sem entrar" fica; reservar exige login.
- **Fita:** grupo = produto + cor + ano do bimestre; colisão cria grupo novo e avisa.
- **Aviso:** adiar até a véspera do último dia da oferta; "Não vai para oferta" encerra o grupo sem oferta.
- **Publicação:** L6 só conta; preço normal (sugerido pela última oferta) e desconto na L7; fim às 23:59 do dia (validade − margem).
- **Categorias:** lista única (Mercearia, Enlatados, Laticínios, Leite, Frios, Doces).
- **Localização:** navegador ou CEP, as duas opções; o CEP também serve para ver outro lugar; conversão no navegador.
- **Projeção:** controles filtram as rodadas já simuladas (resumo de `resultados_n5000`); sem filtro = Tabela 5.
- **Push:** Web Push padrão, implementado depois de 09/11. Na C1 e na C9 o botão fica desenhado.
- **Figuras do artigo:** saem dos protótipos. O sistema real aparece no vídeo da apresentação final.

## Ainda em aberto

1. Tipo de token da API (recomendação: token do DRF) e se "Esqueci minha senha" entra (exige envio de e-mail).
2. Serviço que converte CEP e endereço da loja em coordenada (testar antes de escolher).
3. Nome e slogan do app: usar espaço reservado.
