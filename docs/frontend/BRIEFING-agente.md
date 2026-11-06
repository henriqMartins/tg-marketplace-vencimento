# Briefing do agente do frontend

Você constrói o `frontend/` do TG (React + TypeScript + Vite, PWA) numa **worktree
separada** (pasta `Codigo-frontend`, branch `frontend`). O backend é feito em paralelo
na pasta principal (`Codigo`, branch `main`), com outro ritmo. Escrito em 05/11/2026.

## Leia antes de começar

1. `CLAUDE.md` da pasta principal (importado pelo `CLAUDE.md` desta worktree): regras do
   domínio e decisões. **Vale acima de tudo.**
2. `docs/frontend/README.md`: ordem de autoridade das referências de tela.
3. `docs/frontend/especificacao-telas.md`: telas, rotas, textos e estados.
4. `docs/api/contrato.md`: **o que cada tela recebe e envia**. É a fronteira com o backend.
5. `docs/frontend/referencia/claude-design/Main.dc.html` (`seed()` e `act`) e as pranchas:
   referência visual e de interação. Não são React; não copie o código.

## Regras desta worktree

- **Sem parte manual.** O modo aprendizado (`TODO(human)`) do CLAUDE.md vale para a
  sessão do backend. Aqui você escreve o código inteiro e explica o essencial.
- **Mostre o plano de cada etapa e espere o ok** antes de escrever código. Passos pequenos.
- **Só mexa em `frontend/`** e em `docs/api/pedidos-do-front.md`. Não altere `backend/`,
  `dominio/`, `simulacao/`, `docs/api/contrato.md` nem o `README.md` da raiz.
  Documente o frontend em `frontend/README.md`.
- **Precisa de algo fora do contrato?** Registre em `docs/api/pedidos-do-front.md` e
  simule no mock com `// PEDIDO-API n`. Não invente rota nem campo sem registrar.
- **A tela só exibe o que a API devolve.** Reserva parcial, `expira_em`, fim da oferta,
  cor da fita, preço com desconto, conservação, código único e indicadores vêm prontos.
  O protótipo calcula essas coisas no navegador (`fitaDe`, `expiraDe`, `menosUmDia`,
  `Math.min(pedido, livre)`) só para simular — no React, não.
- **O mock segue o contrato.** O mock pode fingir uma regra (ex.: devolver `parcial`) para
  a tela ter o que mostrar, mas fica isolado na implementação mock do cliente da API e
  nunca é importado por uma tela.
- Commits pequenos, um por etapa, em português, no estilo do repositório
  ("Cria …", "Adiciona …"). **Sem linha de coautoria de IA** (`Co-Authored-By`).
- Não proponha nada da lista "Fora de escopo" do CLAUDE.md (CI/CD, Redis, mapa…).
- Responda em português brasileiro.

## Arquitetura pedida

- **Cliente da API com duas implementações:** `mock` (dados a partir do `seed()`,
  adaptados aos nomes do contrato) e `http` (fetch na API real). A escolha é feita por
  variável de ambiente (`VITE_API=mock|http`) e, depois, **por grupo do contrato**
  (A, B, C…), para ligar o real aos poucos.
- **Tipos TypeScript** espelhando o contrato (nomes de campo iguais aos do JSON).
- **Tokens** de cor, tipografia e medida da seção 0 da especificação num lugar só.
- **Comportamentos globais** (seção 0, itens 1–5) implementados uma vez, na casca:
  faixa "Conectando ao servidor…", recarga a cada 30 s com a tela visível, erros de
  regra virando mensagem, acessibilidade, navegações inferiores.
- Testes com Vitest + Testing Library. Escolha de biblioteca de dados (ex.: TanStack
  Query ou hooks próprios) e de roteador: proponha com trade-offs e pergunte.

## Etapas (nesta ordem)

A ordem vai das telas estáveis às que dependem de mais decisões. Cada etapa termina
com testes passando, `npm run build` ok, `frontend/README.md` atualizado e um commit.

| Etapa | Entrega | Teste mínimo |
|---|---|---|
| F0 · Esqueleto | Vite + React + TS, Vitest, fonte, tokens | renderiza o App; build passa |
| F1 · Contrato + mock | tipos do contrato, interface do cliente, mock a partir do `seed()` | o mock devolve `confirmada`, `parcial` e `recusada` no formato do contrato |
| F2 · Componentes | botão, contador −/+, chip, folha inferior, toast, esqueleto, estado vazio, selo, amostra de fita | contador respeita mín./máx. e não abre teclado; folha com `role="dialog"`; amostra sempre com nome da cor e data |
| F3 · Casca | rotas do mapa, layouts (consumidor, loja, gestor ≥ 1024 px), proteção por papel, servidor acordando, recarga de 30 s | relógio falso: faixa com API lenta; 90 s → "Tentar de novo"; aba oculta não recarrega |
| F4 · Acesso | A1–A5 | redirecionamento por papel após entrar |
| F5 · Consumidor | C1–C9 (C1: localização do navegador **e** CEP; conversão do CEP no navegador; push só desenhado) | C5 nos 3 estados conforme a resposta; C6 conta a partir do `expira_em` recebido e muda para C7 quando o estado muda |
| F6 · Operação da loja | L1, L9–L13 | teclado da L12; L13 nos 3 estados; 409 do ajuste vira mensagem na L11 |
| F7 · Gestor | G1, G3, G4, G2, G6 | G1 exibe os números recebidos sem recalcular; bloqueados com total e divisão; G2 sem filtro = Tabela 5 e mostra "baseado em N rodadas" |
| F8 · Lote, fita e aviso | L2–L8, L4, G5 | L3 nos 3 resultados vindos da API; L7 bloqueada sem confirmar a separação; "Não vai para oferta" na L6 |
| F9 · PWA | manifesto, service worker, instalação | build gera o manifesto |

## Integração com o backend

- Quando um grupo do contrato virar ✅, o Henrique avisa nesta sessão. Aí você faz
  `git merge main`, liga aquele grupo no cliente `http` e testa com o backend local
  (`http://localhost:8000`; o Vite em `http://localhost:5173`).
- Antes disso, tudo roda no mock.

## Decisões que já estão no contrato (não reabrir)

- Categorias: lista única `mercearia, enlatados, laticinios, leite, frios, doces`.
- Faixas de desconto da vitrine: `ate30` (≤ 30), `30a50` (> 30 e < 50), `50mais` (≥ 50).
- Reserva parcial é sucesso (201, `status: parcial`); só a recusa é 409.
- Retirada por loja + código (`POST /api/lojas/{lojaId}/retiradas {codigo}`).
- L6 só conta; preço normal (sugerido pela última oferta) e desconto ficam na L7.
- L6 tem a ação "Não vai para oferta".
- Adiar aviso: no máximo até `adiar_ate_max` que a API devolve.
- Fim da oferta às 23:59 do dia (validade − margem), vindo da API.
- Projeção: filtros por faixa; números vêm da API; sem frase que recomende janela.
