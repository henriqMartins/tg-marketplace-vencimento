# Frontend: o que seguir

Pasta de referência para construir o frontend (React + TypeScript + Vite, PWA). Consolidada em 04/11/2026.

## Ordem de autoridade

Quando houver conflito, vale o primeiro item desta lista:

1. **Regras do domínio** em `CLAUDE.md` (raiz do repositório) e o pacote `dominio/`.
2. **`especificacao-telas.md`**: telas, rotas, textos, estados, definições dos indicadores e chamadas de API.
3. **`referencia/claude-design/`**: protótipo navegável, a referência **visual e de interação** principal.
4. **`referencia/artboards/`**: pranchas estáticas, com os componentes e tokens (`Componentes.dc.html`), o mapa de fluxos e estados (`Fluxos.dc.html`) e os estados de cada tela lado a lado.

## Como usar os arquivos `.dc.html`

Eles **não são React**: são o formato do canvas de design, ou seja, HTML com `<sc-for>`, `<sc-if>` e uma classe `Component`. Use-os para:

- copiar medidas, cores, textos e a ordem dos elementos;
- entender a interação (o que cada botão faz, quais estados existem).

Não copie o código como está. Escreva componentes React próprios.

### O que aproveitar do protótipo do Claude Design

`referencia/claude-design/Main.dc.html` tem dois trechos úteis:

- **`seed()`**: dados de exemplo coerentes entre si. Servem de base para os mocks do frontend enquanto a API não existe.
- **`act`**: as ações `reservar`, `cancelar`, `retirar`, `ajustar`, `publicar`, `adiar`, `cadastrarLote` e `novoProduto`. Mostram a entrada e a saída que cada tela espera e funcionam como **rascunho do contrato da API**.

As regras de verdade (reserva parcial, expiração limitada ao fim da oferta, conservação, código único por loja) ficam **no backend**. A tela só exibe o que a API devolve.

## Decisões de 04/11/2026 (já aplicadas na especificação)

- **Compradores bloqueados** = recusas totais + reservas parciais, igual ao `simulacao.py` e à Tabela 5 do artigo. O painel mostra o total e a divisão entre os dois.
- **Taxas de retirada e de expiração**: calculadas sobre as reservas **encerradas** (retiradas + expiradas + canceladas).
- **Projeção (G2)**: sem frase que recomende uma janela. Os números do mock são os da Tabela 5 (`resultados_n5000`).
- **`expira_em`** vem sempre do backend (`mín(agora + janela, fim da oferta)`).

## Ainda em aberto

Ver a seção "Pendências e suposições" no fim de `especificacao-telas.md`. Entre os itens: login, push, CEP para coordenada, permissões por papel e as tabelas que faltam no banco (lote e grupo de fita, aviso, categoria).
