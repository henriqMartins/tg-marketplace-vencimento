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
| F8b · Mock do grupo D | ✅ |
| F8c · L4 lotes, L3 cadastro do lote, L2 novo produto | ✅ |
| F8d · L5 avisos, L6 conferência, L8 adiar, L7 publicar | ✅ |
| F8e · G5 lotes e fitas no computador | ✅ |
| F8f · Endereço → coordenada (Nominatim) na L14/G6 | ✅ |
| F9 · PWA (manifesto, service worker, instalação) | ✅ |
| F10 · Parceria: A4 (muda), A6, A7, P1–P3 e mock do grupo I ([`docs/parceria.md`](../docs/parceria.md)) | ✅ · grupo I na API real (falta conferir com o servidor) |

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
| 13/11/2026 | Mock do grupo D (`mock/grupo-d.ts`) copia `backend/ofertas/api_lotes.py` e `servico_lotes.py`: mesma ordem de validação, códigos e frases. Regras em `regras-fingidas.ts`: "conferir" calculado (nunca gravado), agrupado/novo/colisão, grupo em oferta não recebe lote, lote mais próximo puxa a referência e desfaz adiamento além do limite, adiar até a véspera do último dia, preço meio para cima em centavos inteiros |
| 13/11/2026 | Semente do D (`mock/semente-lotes.ts`): os 5 avisos e os grupos do protótipo com datas relativas a hoje; as ofertas 1, 2, 5 e 6 têm grupo; a cor sai sempre da validade. `avisos_para_conferir` passa a ser contado (4 na semente: o achocolatado está adiado). Publicar cria a oferta de verdade (L9, G4 e vitrine) |
| 13/11/2026 | Todos os grupos (A–G) têm mock; o `pendente` saiu. Chave do mock `tg.mock.v4` |
| 13/11/2026 | L3: o card da fita aparece **depois** de salvar, com o resultado da API (agrupado, novo grupo ou colisão com `role=alert`), a instrução "Cole a fita preta…" e "Cadastrar outro lote" / "Ver lotes e fitas" (decisão 1a da F8: a cor é calculada só no backend e não há rota de prévia). Antes de salvar, o card só explica de onde vem a cor |
| 13/11/2026 | L3: validade digitada com máscara "dd/mm/aaaa" (`util/data-digitada.ts`); a tela só confere se a data existe no calendário, e "já venceu" vem da API (`validade_passada`) embaixo do campo |
| 13/11/2026 | L2 ↔ L3: "+ Novo produto" leva o texto da busca (`?nome=`) e salvar volta para a L3 com o produto escolhido (`?produto=id`). Os dois formulários são componentes (`FormLote`, `FormProduto`) para o modal da G5 |
| 13/11/2026 | L4: grupos `encerrado` não aparecem (já saíram da gôndola); aviso leva à L6 e grupo em oferta à L10; filtro de cor na URL (`?cor=`), pedido à API |
| 13/11/2026 | `AmostraFita` ganhou o tamanho `destaque` (64 px, L3) e a `BolinhaFita` decorativa (só ao lado do nome da cor, nos chips) |
| 13/11/2026 | L6 só conta (como a especificação decidiu em 05/11, apesar de a prancha ainda mostrar o desconto); o máximo é o `recebido` do grupo. A contagem vai para a L7 pela URL (`?separado=N`); sem ela, a L7 volta para a L6 |
| 13/11/2026 | L8 (adiar): Amanhã / Em 2 dias / Em 3 dias / Escolher data; opções depois do `adiar_ate_max` da API ficam desabilitadas. As datas das opções saem do relógio do aparelho, mas o limite e a validação são da API |
| 13/11/2026 | L7: preço sugerido da API, desconto 30% marcado de início (como no protótipo), janela padrão da loja; prévia "De R$ 4,49 por R$ 3,14" com a mesma conta do backend (`previaDesconto`, meio centavo para cima), avisando que o valor final é o gravado. `409 fim_ja_passou` vira a frase da especificação |
| 13/11/2026 | Oferta publicada **sem** a frase "Quem ativou os avisos de oferta foi notificado": o push (grupo H) está fora até 09/11, e a frase seria falsa |
| 13/11/2026 | Todas as rotas da especificação têm a tela de verdade: a tela "em construção" saiu |
| 13/11/2026 | G5 na mesma rota da L4 (`/loja/:id/lotes`), como a G4 e a L9. Situação na URL (`?situacao=`), pedida à API; grupos encerrados ficam de fora, como na L4. "+ Cadastrar lote" abre a L3 num modal, e "+ Novo produto" troca o conteúdo do modal pela L2, que devolve o produto criado |
| 13/11/2026 | Calendário de fitas da G5: a contagem por cor soma a lista de grupos que a API devolveu; o destaque do bimestre atual sai do mês de hoje (`bimestreDoMes`). É conta de calendário, não a cor de um produto: a cor de cada grupo e lote continua vindo só da API |
| 14/11/2026 | Mock do grupo F alinhado ao contrato da main (F ✅): cada número usa a data do próprio evento — criadas, parciais e recusas pela criação; encerradas, taxas e semanas pelo encerramento (a expirada na hora em que venceu); perda pelo fim. Isso responde às duas perguntas abertas da F7a (semana do gráfico e totais da G3). Período padrão de 30 dias, `400 periodo_invalido` e `400 estado_invalido` |
| 14/11/2026 | Endereço → coordenada pelo **Nominatim** (OpenStreetMap), no navegador (`localizacao/endereco.ts`, injetado como o CEP; nos testes, um mapa falso). Conferido em 14/11: 200, CORS liberado (`*`), `lat`/`lon`/`display_name`. Uma busca só ao salvar e só se o endereço mudou (política de uso: sem autocompletar), restrita ao Brasil |
| 14/11/2026 | Achou → a barra mostra **onde** achou e pede confirmação ("Salvar com esta localização" / "Corrigir endereço"): o endereço da loja não tem campo de cidade, e uma rua com o mesmo nome em outra cidade daria distâncias erradas sem ninguém ver. Não achou → "Salvar sem localização" (latitude e longitude `null`) ou "Corrigir endereço" (decisão 2a da F8). Crédito "© colaboradores do OpenStreetMap" junto do resultado (licença ODbL) |
| 14/11/2026 | `mensagemDeErro` mostra também as frases de `ErroCep` e `ErroEndereco` (escritas para a pessoa); qualquer outro erro continua com a frase genérica |
| 14/11/2026 | PWA com `vite-plugin-pwa` 2.0.0 (versão exata; aceita Vite 8). Manifesto em `src/app/pwa.ts` (nome de `marca.ts`, pt-BR, standalone, cores primary/bg, ícones 192, 512 e maskable). O build gera `manifest.webmanifest` e `sw.js`; conferido no Chrome: service worker ativo e o app abre sem internet depois da primeira visita |
| 14/11/2026 | O service worker guarda **só os arquivos do app**; a API, o CEP e o mapa vão sempre à rede (nada de estoque ou código velho no aparelho). Sem service worker no `npm run dev` e nos testes |
| 14/11/2026 | Versão nova: toast "Nova versão disponível · Atualizar" (decisão 2a da F9), sem recarregar no meio de uma reserva ou conferência |
| 14/11/2026 | C9 "Instalar na tela inicial": botão com o pedido do navegador (`beforeinstallprompt`, guardado em `app/instalacao.ts` ao abrir o app); "App instalado neste aparelho" quando já instalado; no iPhone, a instrução Compartilhar → Adicionar à Tela de Início (decisão 3a) |
| 14/11/2026 | Ícone **provisório** (etiqueta branca sobre o verde, `public/icone.svg` → PNGs gerados com o Chrome), como o nome. Trocar = substituir os arquivos de `public/` |
| 14/11/2026 | `npm audit`: 6 avisos (2 baixos, 4 moderados) em dependências do `workbox-build`, que só roda no build para gerar o service worker; nada disso vai para o aparelho |
| 14/11/2026 | Merge do `origin/main` com todos os grupos ✅ e os 4 pedidos **aceitos** (conflito no `pedidos-do-front.md` resolvido com a versão da main, que tem as decisões e o pedido 4) |
| 14/11/2026 | Grupo G na API real (`http/projecao.ts`), testado com `fetch` falso (URL, token, filtros, 403). Ainda não conferido contra o servidor: o backend não estava no ar e esta máquina não tem Python |
| 14/11/2026 | Contrato G: combinação sem rodadas → `rodadas: 0` e números `null`. Tipo `Projecao` aceita `null`; a G2 avisa "Nenhuma rodada simulada com essa combinação" e `formatarPercentual(null)` = "—" |
| 14/11/2026 | Clientes http de todos os grupos (A–G), um arquivo por grupo em `src/api/http/`, com as rotas do `backend/*/urls.py`. A recusa da reserva (409 `{status: "recusada"}`) volta como resultado, como no mock; os outros 409 continuam erro. `com_lotes` vai como `1`. Testados com `fetch` falso (método, rota e corpo); falta conferir contra o servidor |
| 14/11/2026 | PEDIDO-API 4 aceito: G6 com `select` de papel para os outros (selo para você), `PATCH …/vinculos/{id}`; o mock segue a ordem e as frases do backend (papel inválido, não encontrado, o próprio acesso, último responsável; mesmo papel = 200 sem mudar) |
| 14/11/2026 | **Conferido contra o servidor** (`VITE_API=http`, backend local com `popular_demo`, front na porta 5173 por causa do CORS): G2 sem filtro = Tabela 5 (5.000 rodadas) e com lote 5–14, procura 2,3–3,0, chegada 4 h = 218 rodadas; 13 telas abertas com Carlos (G1, G2, G3, G4, G5, G6), Juliana (L1, L5, L4, L9, L12) e Ana (C2, C8, C9), sem erro no console nem resposta 4xx/5xx. Contas de demonstração: carlos@, juliana@ e ana@example.com, senha demo1234 |
| 14/11/2026 | **L14/G6: a funcionária consulta as configurações, sem editar** (decisão do Henrique: em mercadinho pequeno, quem atende o balcão costuma ser quem gerencia). A rota `config` saiu do bloco "só responsável"; para quem não é responsável, a tela mostra os valores em texto (nome, endereço, janela, margem, antecedência), a equipe só com selos e o aviso "Só o responsável da loja muda estas configurações" — sem campos, contadores, `select`, Remover, Adicionar nem "Ver projeção". A L1 mostra o atalho para os dois papéis. A API já permitia ler com qualquer vínculo e recusa salvar (403). **Diverge da especificação** ("L14 só o responsável"): atualizar lá e no Contexto mestre |
| 14/11/2026 | **Deploy na Vercel** preparado: `vercel.json` (rewrite das rotas do app, agendamento diário da varredura, `maxDuration` 120 s), função `api/varrer.ts` (confere `CRON_SECRET`, chama o backend com `CRON_TOKEN`, até 90 s, uma nova tentativa se o Render estiver acordando), `engines` Node 22.12+ e `.env.example` com a parte de produção. Ver "Deploy na Vercel" |
| 14/11/2026 | **Roteiro de testes em tela** (`docs/roteiro-de-testes-em-tela.md`) executado contra a API real, automatizado no Chrome (Playwright, scripts fora do repositório): **50 de 50 itens executados passaram** (A 5, B 10, C 8, D 11, E 6, F 5, G 4, X-1). Fora: A-1 (desligar o servidor no meio), E-6 (último responsável só é alcançável por concorrência; provado no teste automático do backend) e X-2 (esperar 1 h). Adaptações: D-2 com o feijão (o grupo aberto de leite já virou oferta), D-9 com um lote novo de iogurte (os avisos da semente nunca tiveram oferta). A loja de demonstração foi restaurada (margem, antecedência, endereço, coordenada, equipe); as reservas, ajustes, lotes e a oferta do presunto criados ficam no banco até o próximo `flush` + `popular_demo` |
| 18/11/2026 | **A4 sempre depois de entrar** (`docs/parceria.md`): saíram as regras "sem vínculo → vitrine" e "computador com um vínculo → loja" do `destino.ts`. Só `?voltar=` e a escolha lembrada pulam a A4. A escolha lembrada ganhou `plataforma` ("Tenho um mercado" não é lembrado: é ação de uma vez). O C9 mostra "Ao abrir o app · Escolher de novo" também para quem não tem loja |
| 18/11/2026 | Grupo I no mock (`mock/grupo-i.ts`), com a Receita fingida por uma tabela de CNPJs (ver "Mock"). `VITE_API=http` passou a ligar só os grupos ✅ (`GRUPOS_PRONTOS` em `cliente.ts`): o I fica no mock até o backend publicar, senão o deploy quebraria |
| 18/11/2026 | `Eu.plataforma` e `Eu.interesse` **opcionais no tipo** enquanto o backend não tiver o grupo I: sem `interesse` no `Eu`, a A4 esconde "Tenho um mercado" (não adianta mostrar uma ação que a API ainda não atende) |
| 18/11/2026 | **PEDIDO-API 5, 6 e 7** (abertos): `Eu.interesse` com o interesse inteiro (A6 em leitura mostra os dados enviados); `codigo` do convite pendente em `LojaPlataforma` (P2 "Copiar link"); formato `{vinculo: {loja: {id, nome}, papel}}` no aceite. Simulados no mock; sem eles, a A6 mostra só estado e data e a P2 só "Gerar novo convite" |
| 18/11/2026 | Conta criada pelo link do convite (`/criar-conta?voltar=/convite/…`) volta **direto** para a A7, sem passar pela C1 (localização) |
| 18/11/2026 | A7: depois do aceite, espera o `Eu` novo (`invalidateQueries(['eu'])`) antes de abrir a L14; senão a loja abriria em "Sem acesso" |
| 18/11/2026 | Área da plataforma: menu lateral no computador (o mesmo CSS do gestor) e **navegação inferior** no celular (Interessados · Lojas · Nova loja), com as listas empilhadas em cartões |
| 18/11/2026 | P3 reaproveita a busca no mapa da L14, extraída para `localizacao/useBuscaNoMapa.ts` + `TextoConfirmacao.tsx`. Nome de exibição padrão = o nome que o dono deu no pedido (vindo da P1); sem pedido, o nome fantasia da Receita. "Copiar" usa `navigator.clipboard`; se o navegador recusar, o texto fica selecionado |
| 23/11/2026 | Nome **Pé de Preço** e ícones definitivos (`public/icons/` + `favicon.ico`), no lugar dos provisórios. A A1 usa o selo branco `abertura-selo.svg`; o manifesto ganhou o maskable 192 e o fundo verde (`background_color` = primary), para a abertura do Android emendar na A1 |
| 23/11/2026 | Mock alinhado ao grupo I publicado no contrato (🔧): `Eu.interesse` só com o pedido em aberto; PATCH só `novo → em_conversa` e `novo`/`em_conversa → descartado`, com motivo obrigatório; CNPJ que a Receita não conhece **bloqueia** a criação; `interesse_id` fechado → `estado_invalido`; `403 email_diferente` traz `email_convite` mascarado, que a A7 usa |
| 23/11/2026 | **Grupo I na API real** (`http/parceria.ts`, rotas do `backend/parceria/urls.py`) e em `GRUPOS_PRONTOS`: `VITE_API=http` liga todos os grupos. O código do convite vai com `encodeURIComponent` (vem de um link). Testado com `fetch` falso; ainda **não conferido contra o servidor** (esta máquina não tem Python) |
| 23/11/2026 | `Eu.plataforma` e `Eu.interesse` agora **obrigatórios** no tipo (a API sempre manda); a A4 não esconde mais "Tenho um mercado" |
| 23/11/2026 | Mock com os detalhes do grupo I ✅: erro de campo com `campo` e `campo_longo` (limites e frases do `servico.py`), telefone só com dígitos, `interesse_id` inexistente → 404, loja antiga sem convite → `409 sem_convite`. Na P3, o telefone passou a ser **obrigatório** (o backend exige; antes o mock aceitava vazio) |
| 23/11/2026 | PEDIDO-API 7 atendido pelo contrato. PEDIDO-API 5 e 6 aguardam decisão do Henrique (o backend recomendou aceitar); até lá, a A6 e a P2 seguem no modo reduzido e o mock continua simulando o 6 |
| 23/11/2026 | **PEDIDO-API 5, 6 e 7 aceitos** (main `d5540b6`). `Eu.interesse` é o `Interesse` inteiro: a A6 em modo leitura mostra também mercado, cidade, telefone e mensagem. `LojaPlataforma.convite.codigo` é `string | null` (só pendente tem código): a P2 copia o link de novo. O tipo `InteresseEu` saiu; no mock, os comentários `PEDIDO-API` saíram |
| 11/11/2026 | A4: "Lembrar minha escolha" começa **desmarcado** (a prancha mostra marcado), porque trocar a escolha (C9, L1) só existe a partir da F5/F6 |

## Comandos

Requer Node 22.12+ (`engines` no `package.json`; o Vitest 5 e o Vite 8 pedem isso). Testado com Node 24.11 / npm 11.6. Dentro de `frontend/`:

| Comando | O que faz |
|---|---|
| `npm install` | instala as dependências (uma vez) |
| `npm run dev` | servidor de desenvolvimento em `http://localhost:5173` |
| `npm test` | roda os testes uma vez (Vitest + Testing Library, ambiente jsdom) |
| `npm run test:watch` | testes em modo observação |
| `npm run build` | confere os tipos (`tsc -b`) e gera `dist/` |
| `npm run preview` | serve o `dist/` gerado |
| `npm run lint` | lint com oxlint (vem no modelo do Vite) |

**Windows:** rode os testes num terminal aberto em `C:\…` (letra do drive **maiúscula**). Aberto
em `c:\…` (comum no terminal do VS Code), o Vitest carrega o `src/test/setup.ts` duas vezes e
todo arquivo falha com "Vitest failed to find the current suite".

## Deploy na Vercel

O front é um site estático (o `dist/` do Vite) mais **uma função** (`api/varrer.ts`). A API
fica no Render (`https://SEU-SERVICO.onrender.com`), que dorme depois de ~15 min parado e leva
~1 min para acordar: a faixa "Conectando ao servidor…" do app cobre essa espera.

**Projeto na Vercel** (importar o repositório):

| Campo | Valor |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` (padrão do preset) |
| Output Directory | `dist` (padrão do preset) |
| Node.js | 22.x ou 24.x (o `engines` pede 22.12+) |

**Variáveis** (Settings → Environment Variables; nenhuma vai para o git — modelo em
[`.env.example`](.env.example)):

| Variável | Onde vale | Valor |
|---|---|---|
| `VITE_API` | código do navegador (build) | `http` |
| `VITE_API_URL` | código do navegador (build) | endereço do Render, sem barra no fim |
| `BACKEND_URL` | só a função `/api/varrer` | o mesmo endereço do Render |
| `CRON_TOKEN` | só a função | o mesmo `CRON_TOKEN` do backend |
| `CRON_SECRET` | só a função | segredo longo e aleatório |

- **Mudou uma `VITE_*`? Faça Redeploy.** Elas entram no JavaScript na hora do build; mudar no
  painel não afeta o site que já está no ar. `BACKEND_URL`, `CRON_TOKEN` e `CRON_SECRET`
  são lidas a cada execução da função.
- **CORS:** o domínio da Vercel (ex.: `https://SEU-APP.vercel.app`) precisa estar no
  `CORS_ALLOWED_ORIGINS` do backend, senão o navegador bloqueia todas as chamadas à API.

**O que o `vercel.json` faz:**
- **Rotas do app:** tudo que não começa com `/api/` e não é arquivo do `dist/` vira
  `/index.html` (o React Router decide a tela). Sem isso, recarregar `/loja/1/painel` dá 404.
- **Varredura diária:** o agendamento chama `/api/varrer` às 7h UTC (4h de Brasília), 1×/dia
  (limite do plano Hobby). A Vercel manda `Authorization: Bearer <CRON_SECRET>`; a função
  confere, faz `POST {BACKEND_URL}/tarefas/varrer` com `Bearer <CRON_TOKEN>` e espera até 90 s
  (`maxDuration` 120 s). Se o Render responder 502/503/504 ou a conexão cair enquanto acorda,
  tenta mais uma vez no mesmo prazo. Devolve `{status, tentativas, resumo}`; o log fica em
  Logs → Functions (ou Settings → Cron Jobs → "Run" para disparar à mão).
- A função roda no **servidor** da Vercel (Node): lê `process.env`, nunca `import.meta.env`,
  e não entra no bundle do app (conferido: nada dela no `dist/`). Testes em `testes-vercel/`
  (fora de `api/`, onde todo arquivo vira função).

**Service worker e API:** o `sw.js` só guarda os arquivos do app e tem uma única rota, a de
navegação, com `/api/`, `/health` e `/tarefas/` de fora (`FORA_DO_APP` em
`src/app/pwa.ts`). As chamadas ao Render são de outro domínio e passam direto, sem cache.

**Gravar o vídeo no ambiente live:** `flush` + `popular_demo` no backend no dia (as datas
são relativas a hoje); abrir o site uma vez antes de gravar para acordar o Render.

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
`configuracao` (E), `gestor` (F), `projecao` (G), `parceria` (I). Os tipos em [`tipos.ts`](src/api/tipos.ts)
espelham `docs/api/contrato.md` com os mesmos nomes de campo.

- **Quem atende cada grupo:** variável `VITE_API` (ver [`.env.example`](.env.example)):
  `mock` (padrão), `http` (= os grupos ✅, lista `GRUPOS_PRONTOS`; hoje A–G e I)
  ou letras, ex.: `A,B` = só A e B na API real.
  Grupo marcado como `http` sem implementação real → erro na hora de abrir o app
  (nunca cai no mock em silêncio). Implementação real pronta para **todos os grupos (A–G e I)** (`src/api/http/`).
- **Login manda na mistura:** o token vem do grupo A. Com A no mock, o backend real responde
  `401` a qualquer rota que exige login (e a sessão é limpa). Ou seja, `VITE_API=G` sozinho
  não serve para a G2: ela também usa A (`eu`), C (resumo no layout da loja) e E (janela
  padrão). Na prática, ligar a API real = `VITE_API=http` com todos os grupos implementados.
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
- **Receita fingida** (grupo I, `mock/grupo-i.ts`): `11.222.333/0001-81` ativa (minimercado),
  `CNPJ_NAO_ALIMENTAR` ativa fora do varejo (papelaria, só alerta), `CNPJ_INATIVA` baixada
  (bloqueia), `CNPJ_FORA_DO_AR` → 503; qualquer outro CNPJ válido → 404 (e bloqueia a criação).
  Os números estão no topo do arquivo.

| Usuário do mock | E-mail | Senha | Papel |
|---|---|---|---|
| Ana Souza | `ana@email.com` | `12345678` | consumidora (tem a reserva ativa 31, código 482917) |
| Carlos Lima | `carlos@vilanova.com.br` | `12345678` | responsável do Mercadinho Vila Nova |
| Juliana Prado | `juliana.prado@email.com` | `12345678` | funcionária do Mercadinho Vila Nova |
| Equipe da Plataforma | `equipe@example.com` | `12345678` | equipe da plataforma (`plataforma: true`; P1–P3) |
| Marcos Lima | `marcos@example.com` | `12345678` | consumidor com pedido de parceria "novo" (Mercearia São Jorge) |

Cena do vídeo no mock: o Marcos vê "Pedido de parceria recebido" na A4 → a equipe abre a P1,
"Cadastrar loja", CNPJ `11.222.333/0001-81`, cadastra e copia o link → o Marcos abre o link (A7) e aceita.

## Casca (`src/app/`)

| Peça | O que faz |
|---|---|
| `ProvedorApp` | junta cliente da API (`useApi`), TanStack Query, sessão (`useSessao`) e toast |
| `consultas.ts` | nova tentativa só sem resposta ou 5xx (1→10 s); `RECARGA_30S` para as telas de estado fresco (para com a aba oculta, recarrega ao voltar); **401 em qualquer chamada encerra a sessão** |
| `sessao/` | token em `localStorage` (ou `sessionStorage` sem "manter conectado"); `/api/eu`; `entrar`, `criarConta`, `sair`, `papelNaLoja` |
| `FaixaServidor` | observa todas as chamadas: "Conectando…" após 2 s; "O servidor não respondeu" + Tentar de novo aos 90 s; "Sem internet" |
| `rotas.tsx` | mapa de rotas da especificação; telas não feitas aparecem como "em construção (etapa)"; galeria em `/dev/componentes` só no `npm run dev` |
| `protecao.tsx` | `ExigeLogin` (→ `/entrar?voltar=…`), `ExigeVinculo` (loja e papel) e `ExigePlataforma` (`eu.plataforma`). Conforto, não segurança: quem barra é o backend (401/403) |
| `layouts/` | consumidor e loja com navegação inferior; gestor (responsável, ≥ 1024 px) com menu lateral — mesma rota, troca o layout; plataforma (P1–P3) com menu lateral no computador e navegação inferior no celular |
| `parceria.ts` | regras de exibição da parceria: interesse em aberto, link do convite (`${origem}/convite/${codigo}`) e a mensagem do WhatsApp |
| `telas/A1Abertura` | `/health` → `/entrar`, `/escolher` ou `/vitrine`; 90 s → Tentar de novo |

### Para onde cada um vai depois de entrar (`app/destino.ts`)

Uma regra só, usada na A1 e depois do login (o guarda `SoVisitante` leva). Desde 18/11/2026
a A4 aparece **para todo mundo**, inclusive sem vínculo e no computador:
1. `?voltar=` (só caminho interno: começa com `/`, não com `//` — evita *open redirect*);
2. escolha lembrada na A4, se ainda vale (o vínculo existe; `plataforma` só para a equipe);
   a loja abre no painel (G1) para o responsável no computador e na L1 nos outros casos;
3. senão → `/escolher` (A4).

A4: Comprar com desconto · Minhas lojas (com vínculo) · Equipe da plataforma (`eu.plataforma`) ·
Tenho um mercado (vira "Pedido de parceria recebido" com pedido em aberto). Celular: tela cheia;
computador: coluna de 560 px.

Depois de criar conta → `/boas-vindas` (C1), levando o `?voltar`; vindo de um convite
(`?voltar=/convite/…`), volta direto para a A7.

### Parceria (`src/telas/parceria/` e `src/telas/plataforma/`)

| Rota | Tela | Quem |
|---|---|---|
| `/parceiro` | A6 · formulário, "Recebemos seu pedido", ou leitura com pedido em aberto | logado |
| `/convite/:codigo` | A7 · aceitar → L14 da loja; erros 403, 404, 409 e 410 com o que fazer | logado (sem login → entrar e volta) |
| `/plataforma/interessados` | P1 · abas por estado (`?estado=`), marcar em conversa, descartar com motivo, cadastrar loja | equipe |
| `/plataforma/lojas` | P2 · CNPJ, responsável ou situação do convite, copiar link, gerar novo convite | equipe |
| `/plataforma/lojas/nova?interesse=` | P3 · CNPJ → dados → convite (link, Copiar, mensagem do WhatsApp) | equipe |

O link do convite é montado no front com a origem do app. O sistema não envia e-mail
(`docs/parceria.md`, seção 1): a equipe copia e manda pelo WhatsApp.

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
- `endereco.ts` + `useBuscaNoMapa.ts` + `TextoConfirmacao.tsx`: endereço → coordenada (Nominatim),
  uma busca por clique, e a confirmação "Localização encontrada: …. É aqui?". Usados na L14/G6 e na P3.

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
| `Campo`, `CampoSenha`, `CampoTexto`, `CaixaSelecao` | rótulo + caixa de 52 px + dica + erro ligado por `aria-describedby`; mostrar senha |
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

O nome do app é **Pé de Preço** (`NOME_DO_APP` em `src/app/marca.ts`). Os ícones (toldo + broto + sorriso) estão em `public/icons/`, com o `favicon.ico` na raiz de `public/`.
