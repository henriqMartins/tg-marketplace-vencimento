# Frontend — TG Marketplace de produtos próximos ao vencimento

PWA em React + TypeScript + Vite. Construído na worktree `Codigo-frontend` (branch
`frontend`), seguindo `docs/frontend/BRIEFING-agente.md`.

## Etapa atual

| Etapa | Situação |
|---|---|
| F0 · Esqueleto (Vite + React + TS, Vitest, fonte, tokens) | ✅ |
| F1 · Contrato + mock (tipos A–G; mock dos grupos A e B) | ✅ |
| F2 · Componentes (botão, contador, chip, folha, toast, esqueleto, vazio, selo, fita) | ✅ |
| F3 · Casca (sessão, consultas, faixa do servidor, rotas, layouts, proteção, A1) | ✅ |
| F4 · Acesso (A2 entrar, A3 criar conta, A4 escolher, A5 entrar no computador) | ✅ |
| F5a · Localização e vitrine (C1, C2, C3) | ✅ |
| F5b · Reservar (C4–C7) | ✅ |
| F5c · Minhas reservas e perfil (C8, C9) | ✅ |
| F6a · Mock do grupo C + L1, L9, L10 | ✅ |
| F6b · Ajuste e retirada (L11, L12, L13) | ✅ |
| F7a · Mock do grupo F + G1 painel, G3 histórico | ✅ |
| F7b · G4 ofertas no computador | ✅ |
| F7c · Mock do grupo G + G2 projeção | ✅ |
| F7d · Mock do grupo E + G6/L14 configurações | ✅ |
| F8a · Mock alinhado ao contrato da main (A, B, C) | ✅ |
| F8b · Mock do grupo D | — |
| F8c · L4 lotes, L3 cadastro do lote, L2 novo produto | — |
| F8d · L5 avisos, L6 conferência, L8 adiar, L7 publicar | — |
| F8e · G5 lotes e fitas no computador | — |
| F8f · Endereço → coordenada (Nominatim) na L14/G6 | — |
| F9 · PWA | — |

## Decisões do frontend

| Data | Decisão |
|---|---|
| 10/11/2026 | Estilo com CSS Modules + variáveis CSS; fonte hospedada no app (`@fontsource`) |
| 11/11/2026 | Mock por grupo: A e B na F1; C–G junto com as telas deles (F6–F8) |
| 11/11/2026 | Datas do mock relativas ao momento em que o app abre (não fixas em 22/10) |
| 11/11/2026 | TanStack Query para buscar dados (recarga de 30 s, nova tentativa, cache) e React Router |
| 11/11/2026 | Faixa "Conectando ao servidor…" só depois de 2 s de espera (resposta rápida não pisca a faixa) |
| 11/11/2026 | Responsável no computador: menu lateral em todas as rotas da loja + item "Operação da loja" (→ L1), **acréscimo à especificação**; telas de operação ficam no centro, na largura de celular |
| 11/11/2026 | Visitante: navegação inferior Vitrine · Entrar |
| 11/11/2026 | "Esqueci minha senha" **fora da tela** até a recuperação existir (em aberto no contrato) |
| 11/11/2026 | Estado do mock guardado no `sessionStorage` (recarregar mantém login e reservas; fechar a aba recomeça) |
| 12/11/2026 | CEP → coordenada pela **AwesomeAPI** (testada: coordenada de rua, 404 para CEP inexistente, CORS liberado, sem chave; a BrasilAPI devolveu o centro da cidade e a ViaCEP não traz coordenada) |
| 12/11/2026 | `/boas-vindas` (C1) pública; o local escolhido fica **só na memória** da aba |
| 12/11/2026 | **PEDIDO-API 1** (aberto): `retirar_ate` em `GET /api/ofertas/{id}`, para a C4 mostrar "Retire até hoje, 20:00" sem calcular; simulado no mock; sem o campo, a C4 mostra a janela e o fim da oferta |
| 12/11/2026 | Depois de cancelar, a reserva mostra o desfecho "Você cancelou…" (a especificação não define essa tela) |
| 12/11/2026 | **PEDIDO-API 2** (aberto): `aguardando_retirada` conta **reservas** (clientes), não unidades |
| 12/11/2026 | **PEDIDO-API 3** (aberto): `validade` em `RetiradaPrevia`, para a amostra da fita da L13 sair com a data; sem o campo, a L13 mostra cor e bimestre |
| 12/11/2026 | L12 também aceita o teclado físico (números, ⌫, Enter) no computador |
| 12/11/2026 | `avisos_para_conferir` no mock é fixo em 5 (o do protótipo) até o mock do grupo D (F8) |
| 12/11/2026 | Push (C1 tela 2, C3, C9) **só desenhado**, botão "em breve" — grupo H depois de 09/11 |
| 13/11/2026 | Mock gera ~35 dias de **histórico determinístico** da loja 1 (`mock/historico.ts`, sorteio com semente fixa): 12 ofertas encerradas com retiradas, expiradas, canceladas, parciais e recusas — G1 e G3 coerentes entre si |
| 13/11/2026 | Indicadores da G1 **só formatados**: taxa `null` vira "—"; o teste usa números incoerentes de propósito para provar que a tela não refaz a conta |
| 13/11/2026 | Período do gestor (7 dias · 30 dias · mês atual) na URL (`?periodo=`), contado a partir de hoje em Brasília; o mesmo controle na G1 e na G3 |
| 13/11/2026 | Gráfico semanal sem biblioteca (HTML/CSS). As cores da especificação têm pouco contraste com o branco (cinza 1,7:1, laranja 2,5:1); compensado com legenda, total sobre cada barra, dica no foco/mouse e tabela equivalente ("Ver como tabela") |
| 13/11/2026 | G1 "Reservas em andamento": uma leitura de `GET …/ofertas/{id}` por oferta ativa (grupo C, como o contrato indica) |
| 13/11/2026 | G4 na mesma rota da L9 (`/loja/:id/ofertas`): responsável com tela ≥ 1024 px vê a G4 (`useVisaoGestor`, o mesmo critério do layout); no celular continua a L9. Aba e oferta escolhida na URL (`?aba=encerradas&oferta=2`); o G1 abre a oferta direto no painel |
| 13/11/2026 | Cartões da G4: Livres agora, Reservadas aguardando e Encerram em 48 h **somados da lista de ativas** que a API devolve (não há endpoint de resumo de ofertas); Perda no mês vem dos indicadores (grupo F, mesmo cache do G1) |
| 13/11/2026 | Coluna "Perda / ajuste" da G4 = perda + ajustado, a mesma soma que a barra de estoque já mostrava; na tabela o fim aparece só como dia ("amanhã", "18/11") e o horário completo fica no painel |
| 13/11/2026 | Formulário da L11 extraído para `FormAjuste`: a L11 (celular) e o modal da G4 usam o mesmo componente, com o mesmo tratamento do 409 `acima_do_livre`. O modal é a `FolhaInferior` com `forma="modal"` (mesma captura de foco) |
| 13/11/2026 | Corrigido: os estilos dos motivos da L11 (grade 2 × 2) não existiam desde a F6b; agora são ladrilhos com o rádio real por baixo |
| 13/11/2026 | Mock da projeção com **números reais**: `scripts/resumir-rodadas.mjs` (`npm run mock:projecao`) só lê `simulacao/resultados_n5000/rodadas.csv` e grava `src/api/mock/projecao-resumo.ts` com somas e contagens por faixa de lote × faixa de procura × janela, como o contrato descreve para o backend. Sem filtro dá exatamente a Tabela 5 (testado) |
| 13/11/2026 | Faixas no resumo: lote fechado nas duas pontas (5–14 …); procura ÷ lote em [a, b), a última fechada (2,3–3,0). Bloqueados e retirada têm contagem própria (350 rodadas sem comprador ficam fora dessas duas médias) |
| 13/11/2026 | Chegada de 1 h ou 4 h no mock responde 501 `chegada_so_na_api` ("disponível só com a API real"): o `rodadas.csv` só tem a chegada de 2 h |
| 13/11/2026 | G2: os controles só valem ao clicar "Atualizar projeção"; o cenário aplicado fica na URL (`?lote=&procura=&chegada=`). Janela inicial de 4 h, sem nenhum texto de recomendação (testado) |
| 13/11/2026 | Gráfico da G2: verde `primary` × laranja `discount` ficam a ΔE 6,1 para protanopia (validador do dataviz); compensado com textura diagonal na barra de bloqueados, valores escritos, legenda e tabela |
| 13/11/2026 | `git merge main` antes do grupo E: o contrato do E já estava ✅ no main (PATCH parcial que não grava nada se um campo falha, `antecedencia_menor_que_margem`, antecedência 1–30, coordenadas juntas ou `null`, `email_invalido`/`papel_invalido`). O mock E segue essas regras com as frases do backend |
| 13/11/2026 | L14 e G6 são **uma tela** (`ConfiguracoesLoja`): cartões lado a lado a partir de ~800 px; no celular o e-mail e o papel ficam embaixo do nome. Dados e regras salvam juntos pela barra "Alterações não salvas" (só aparece com mudança; o PATCH leva só o que mudou); a equipe muda na hora, com confirmação para remover |
| 13/11/2026 | Papel na equipe só como selo: trocar o papel não tem rota no contrato (PEDIDO-API 4) |
| 13/11/2026 | Endereço → coordenada (Nominatim) continua para a F8: ao editar o endereço, a tela avisa que a distância segue o endereço anterior |
| 13/11/2026 | G2 começa pela janela padrão da loja (grupo E); sem ela, 4 h |
| 13/11/2026 | Mock alinhado ao contrato da main (A, B e C ✅), com as frases e a ordem de validação do backend: vitrine sem ofertas esgotadas (o detalhe responde); `400 parametro_invalido`; loja sem coordenada no fim da lista por distância; `409 venceu` também na **prévia** da retirada, por até 24 h depois do prazo (antes: 30 min e só na confirmação); código fora do formato → 404; ofertas da loja sem `estado` = ativas e depois encerradas; reservas da oferta encerrada por `criada_em`; ajuste com `quantidade_invalida`/`motivo_longo`; criar conta com `sem_nome`/`email_invalido` |
| 13/11/2026 | `409 acima_do_livre` agora com a frase do backend ("Só dá para ajustar unidades livres; as reservadas não entram."); a L11 continua baixando o máximo pelo `livre` do corpo |
| 13/11/2026 | A3: `sem_nome` e `email_invalido` da API aparecem embaixo do campo, como o `email_em_uso` |
| 11/11/2026 | A4: "Lembrar minha escolha" começa **desmarcado** (a prancha mostra marcado), porque trocar a escolha (C9, L1) só existe a partir da F5/F6 |

## Comandos

Requer Node 24+ (testado com Node 24.11 / npm 11.6). Dentro de `frontend/`:

| Comando | O que faz |
|---|---|
| `npm install` | instala as dependências (uma vez) |
| `npm run dev` | servidor de desenvolvimento em `http://localhost:5173` |
| `npm test` | roda os testes uma vez (Vitest + Testing Library, ambiente jsdom) |
| `npm run test:watch` | testes em modo observação |
| `npm run build` | confere os tipos (`tsc -b`) e gera `dist/` |
| `npm run preview` | serve o `dist/` gerado |
| `npm run lint` | lint com oxlint (vem no modelo do Vite) |

## Estilo

- **CSS Modules + variáveis CSS** (decidido 10/11/2026). Cada componente tem seu
  `Nome.module.css` e usa só `var(--token)`; nada de hex solto em componente.
- **Tokens** (cor, fitas, tipografia, raios, medidas) ficam em
  [`src/estilos/tokens.css`](src/estilos/tokens.css), copiados da seção "0 · Base" de
  `docs/frontend/especificacao-telas.md`. Mudou a especificação → muda aqui.
  - Cores com fundo e texto viram par: `--warn-bg` / `--warn-text`, `--danger-bg` / `--danger-text`…
  - Tipografia como atalho de `font`: `font: var(--texto-titulo-tela);`.
- **Base global** em [`src/estilos/base.css`](src/estilos/base.css): reset leve, fonte, foco
  visível; classe `.numeros` (`tabular-nums`) e `.so-leitor` (texto só para leitor de tela).
- **Fonte:** Plus Jakarta Sans hospedada no app (`@fontsource-variable/plus-jakarta-sans`,
  decidido 10/11/2026), para funcionar offline na PWA. Um arquivo variável cobre os
  pesos 400–800; o navegador só baixa o subconjunto latino.

## Cliente da API (`src/api/`)

As telas falam só com a interface `ClienteApi` ([`cliente.ts`](src/api/cliente.ts)), dividida
pelos grupos do contrato: `acesso` (A), `consumidor` (B), `operacao` (C), `lotes` (D),
`configuracao` (E), `gestor` (F), `projecao` (G). Os tipos em [`tipos.ts`](src/api/tipos.ts)
espelham `docs/api/contrato.md` com os mesmos nomes de campo.

- **Quem atende cada grupo:** variável `VITE_API` (ver [`.env.example`](.env.example)):
  `mock` (padrão), `http` ou letras, ex.: `A,B` = só A e B na API real.
  Grupo marcado como `http` sem implementação real → erro na hora de abrir o app
  (nunca cai no mock em silêncio).
- **Erros:** os métodos rejeitam com `ErroApi` (`status`, `codigo`, `message` = frase para a
  pessoa, `corpo`). `status 0` = sem resposta (servidor acordando / sem rede).
  Exceção: `consumidor.reservar` devolve a recusa (409) como resultado `{status: 'recusada', …}`.
- **Base http:** [`http/requisitar.ts`](src/api/http/requisitar.ts) põe o token
  (`Authorization: Token …`), envia/lê JSON e converte erros. As implementações http de cada
  grupo entram quando o grupo virar ✅ no contrato (lista `FABRICAS_HTTP` em `index.ts`).

### Mock

- Estado em memória a partir do `seed()` do protótipo ([`mock/semente.ts`](src/api/mock/semente.ts)),
  com datas relativas a "agora" e atraso artificial (`VITE_MOCK_ATRASO_MS`, padrão 400 ms).
- O que só o backend calcula (parcial, `expira_em`, expiração, fim, fita, código) é **fingido**
  em [`mock/regras-fingidas.ts`](src/api/mock/regras-fingidas.ts), isolado.
- **Nenhuma tela importa o mock:** o oxlint barra (`no-restricted-imports`); só `src/api/index.ts` pode.
- Grupos C–G ainda sem mock: qualquer chamada rejeita dizendo em que etapa entra.

| Usuário do mock | E-mail | Senha | Papel |
|---|---|---|---|
| Ana Souza | `ana@email.com` | `12345678` | consumidora (tem a reserva ativa 31, código 482917) |
| Carlos Lima | `carlos@vilanova.com.br` | `12345678` | responsável do Mercadinho Vila Nova |
| Juliana Prado | `juliana.prado@email.com` | `12345678` | funcionária do Mercadinho Vila Nova |

## Casca (`src/app/`)

| Peça | O que faz |
|---|---|
| `ProvedorApp` | junta cliente da API (`useApi`), TanStack Query, sessão (`useSessao`) e toast |
| `consultas.ts` | nova tentativa só sem resposta ou 5xx (1→10 s); `RECARGA_30S` para as telas de estado fresco (para com a aba oculta, recarrega ao voltar); **401 em qualquer chamada encerra a sessão** |
| `sessao/` | token em `localStorage` (ou `sessionStorage` sem "manter conectado"); `/api/eu`; `entrar`, `criarConta`, `sair`, `papelNaLoja` |
| `FaixaServidor` | observa todas as chamadas: "Conectando…" após 2 s; "O servidor não respondeu" + Tentar de novo aos 90 s; "Sem internet" |
| `rotas.tsx` | mapa de rotas da especificação; telas não feitas aparecem como "em construção (etapa)"; galeria em `/dev/componentes` só no `npm run dev` |
| `protecao.tsx` | `ExigeLogin` (→ `/entrar?voltar=…`) e `ExigeVinculo` (loja e papel). Conforto, não segurança: quem barra é o backend (401/403) |
| `layouts/` | consumidor e loja com navegação inferior; gestor (responsável, ≥ 1024 px) com menu lateral — mesma rota, troca o layout |
| `telas/A1Abertura` | `/health` → `/entrar`, `/escolher` ou `/vitrine`; 90 s → Tentar de novo |

### Para onde cada um vai depois de entrar (`app/destino.ts`)

Uma regra só, usada na A1 e depois do login (o guarda `SoVisitante` leva):
1. `?voltar=` (só caminho interno: começa com `/`, não com `//` — evita *open redirect*);
2. escolha lembrada na A4, se o vínculo ainda existe;
3. sem vínculo → `/vitrine`;
4. computador com um vínculo só → responsável `/loja/:id/painel` (G1), funcionário `/loja/:id` (L1);
5. celular ou vários vínculos → `/escolher` (A4).

Depois de criar conta → `/boas-vindas` (C1), levando o `?voltar`.

### Usando o mock no navegador

`npm run dev`, abra `/` e entre com um usuário da tabela acima. O mock guarda reservas e login
**na aba** (`sessionStorage`): recarregar mantém tudo; fechar a aba recomeça da semente. Para
zerar sem fechar a aba: `/dev/componentes` → "Reiniciar dados do mock".

## Localização (`src/localizacao/`)

- `cep.ts`: CEP → `{lat, lng, bairro}` na AwesomeAPI, no navegador. Erros: `invalido`, `nao_encontrado`,
  `sem_conexao`. Trocar de serviço = mexer só aqui.
- `posicao.ts`: `navigator.geolocation` em Promise (`negada` / `indisponivel`).
- `ProvedorLocal`: guarda o local na memória (recarregar = sem local, vitrine sem ordem de distância).
  Os dois serviços entram por injeção: nos testes são falsos (nenhum teste chama a internet).

## Componentes (`src/componentes/`)

Para ver todos no navegador: `npm run dev` e abra `/dev/componentes`.

| Componente | Uso e garantias (testadas) |
|---|---|
| `Botao`, `BotaoIcone` | primário 56 px, secundário e perigo 52 px; `carregando` trava e mostra "Enviando…"; ícone exige `rotulo` (aria-label) |
| `Contador` | tamanhos `consumidor` 60, `cadastro` 72, `ajuste` 80, `conferencia` 96; respeita mín./máx. (botão a 40%); **nunca abre teclado** (sem `<input>`); segurar repete |
| `Chip` | pílula com `aria-pressed`; área de toque de 44 px |
| `FolhaInferior` | `role="dialog"` + `aria-modal`, nome = título; foco preso dentro; Esc e véu fecham; foco volta para quem abriu |
| `ProvedorToast` + `useToast()` | um toast por vez, 4 s, região `role="status"`; ação opcional ("Desfazer") |
| `Esqueleto`, `EsqueletoCartao`, `EsqueletoLista` | blocos decorativos; a lista anuncia "Carregando…" uma vez |
| `EstadoVazio` | ícone + frase + **uma** ação (obrigatória) |
| `Selo`, `SeloReserva`, `SeloOferta`, `SeloGrupo` | textos e cores da seção 0 a partir dos estados do contrato |
| `CartaoOferta`, `SeloDesconto`, `Preco` | card da vitrine; preço original riscado lido como "antes" |
| `CodigoRetirada` | 6 caixas (3 + 3); leitor de tela ouve os dígitos de uma vez; variante riscada (expirada) |
| `Abas` | `tablist` com setas ← →; o painel usa `idAba`/`idPainel` (`abasIds.ts`) |
| `Interruptor` | `role="switch"` com rótulo clicável |
| `Campo`, `CampoSenha`, `CaixaSelecao` | rótulo + caixa de 52 px + dica + erro ligado por `aria-describedby`; mostrar senha |
| `AmostraFita` | quadrado de cor (decorativo) **sempre** com nome da cor e data exata — `data` é obrigatória no tipo |

Diferença consciente do protótipo: a ação do toast é **branca sublinhada**, não laranja —
o laranja `#C2410C` sobre o fundo `ink` não chega ao contraste de 4,5:1 exigido na seção 0.

## Estrutura

```
frontend/
├── index.html            # lang pt-BR, theme-color = primary
├── vite.config.ts        # Vite + configuração do Vitest
└── src/
    ├── main.tsx          # monta o React; importa fonte, tokens e base
    ├── App.tsx           # ProvedorApp + roteador
    ├── api/              # cliente da API: tipos, interface, config, http/, mock/
    ├── app/              # casca: provedores, sessão, consultas, rotas, layouts, proteção, A1
    ├── componentes/      # componentes base (F2) + toast/
    ├── galeria/          # vitrine dos componentes (/dev/componentes, só em desenvolvimento)
    ├── util/             # classes(), formatar (datas)
    ├── estilos/          # tokens.css e base.css
    └── test/setup.ts     # comparadores do jest-dom + limpeza entre testes
```

O nome do app ainda está em aberto: aparece como "[Nome do app]" (`NOME_DO_APP` em `App.tsx`).
