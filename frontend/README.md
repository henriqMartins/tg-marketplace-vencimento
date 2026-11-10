# Frontend — TG Marketplace de produtos próximos ao vencimento

PWA em React + TypeScript + Vite. Construído na worktree `Codigo-frontend` (branch
`frontend`), seguindo `docs/frontend/BRIEFING-agente.md`.

## Etapa atual

| Etapa | Situação |
|---|---|
| F0 · Esqueleto (Vite + React + TS, Vitest, fonte, tokens) | ✅ |
| F1 · Contrato + mock | — |

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

## Estrutura

```
frontend/
├── index.html            # lang pt-BR, theme-color = primary
├── vite.config.ts        # Vite + configuração do Vitest
└── src/
    ├── main.tsx          # monta o React; importa fonte, tokens e base
    ├── App.tsx           # placeholder (a casca entra na F3)
    ├── estilos/          # tokens.css e base.css
    └── test/setup.ts     # comparadores do jest-dom + limpeza entre testes
```

O nome do app ainda está em aberto: aparece como "[Nome do app]" (`NOME_DO_APP` em `App.tsx`).
