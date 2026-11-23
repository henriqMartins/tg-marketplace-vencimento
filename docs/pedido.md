# Pedido: várias reservas de uma loja com um código só

Versão 1 (18/11/2026). Ideia de Henrique; formato escolhido: **carrinho como lista** (versão B).
O carrinho não segura estoque. Ao confirmar, a API reserva todos os itens daquela loja de uma
vez e gera **um código por loja**. Este arquivo é a fonte da regra até ela ser incorporada em
`docs/api/contrato.md` (grupo J, dono: backend) e em `docs/frontend/especificacao-telas.md`.

## 1. O problema e a decisão

Hoje cada reserva tem o seu código: quem reserva 5 produtos na mesma loja mostra 5 códigos no
balcão. A solução agrupa as reservas de **uma pessoa em uma loja** num **Pedido**, e o código
passa a ser do pedido.

Decidido:
- **Sem reserva provisória.** O carrinho fica só no aparelho; nada é preso antes de confirmar.
  Assim a máquina de estados da reserva, o módulo `dominio` e a simulação **não mudam**.
- **Um pedido = uma pessoa + uma loja + um código.** Carrinho com duas lojas vira dois pedidos.
- **Cada item continua sendo uma `Reserva`**, com o próprio estado, a própria janela e o próprio
  `expira_em` (= mín(agora + janela da oferta, fim da oferta)).
- **Retirada tudo ou nada passa a valer para o pedido:** uma confirmação no balcão retira todos
  os itens ainda ativos.

## 2. Fluxo em tela

### Cliente (celular)
1. **C2 Vitrine:** ícone de sacola no topo com a contagem de itens no carrinho.
2. **C4 Oferta:** dois botões:
   - **"Adicionar ao pedido"** (principal) → volta à vitrine com aviso
     "Iogurte ×2 adicionado · Ver pedido";
   - **"Reservar só este agora"** (secundário) → caminho atual, vira um pedido de 1 item.
   Se o item já está no carrinho, o botão vira "Atualizar no pedido".
3. **C10 Meu pedido (nova):** itens agrupados por loja (nome e distância), cada um com contador,
   preço e remover; total por loja; botão **"Confirmar pedido nesta loja"** por loja.
   - Aviso fixo: "Os itens só ficam guardados para você quando você confirma".
   - Item que esgotou desde que foi adicionado: apagado, "Esgotou · remover"
     (a tela confere o `livre` atual ao abrir e a cada 30 s).
   - Carrinho vazio: "Seu pedido está vazio" e "Ver ofertas".
   - O carrinho fica no aparelho (`localStorage`), por conta logada; some ao sair da conta.
   - Visitante pode montar o carrinho; confirmar exige login e volta para C10 depois.
4. **C5 Resultado (agora por item):**
   - **Tudo confirmado:** ✓ "Pedido confirmado · N itens · R$ X" → "Ver código".
   - **Algo mudou:** lista por item (✓ confirmado, ! "pediu 2, reservamos 1", × esgotou),
     total do que ficou, botões "Manter o pedido" e "Cancelar o pedido".
   - **Nada sobrou (409):** "Esgotou tudo agora há pouco"; o carrinho volta com os itens marcados.
   - Os itens confirmados saem do carrinho; os recusados ficam marcados como esgotados.
5. **C6 Código (um por pedido):** código de 6 dígitos; "Retire até HH:MM (o primeiro item vence
   às HH:MM)"; lista dos itens ativos; total; botões "Cancelar um item" e "Cancelar o pedido".
   Item vencido some da lista com a nota "Presunto expirou e voltou para a vitrine"; o código
   continua valendo para o resto.
6. **C7 Desfechos:** por pedido. Expirado = todos os itens expiraram; Retirado = retirada feita.
7. **C8 Minhas reservas:** um cartão por pedido (loja, código, nº de itens, prazo mais próximo).

### Loja (balcão)
8. **L12 Validar retirada:** igual (6 dígitos).
9. **L13 Resultado:** "Código 482 917 · Ana S.", lista dos itens ativos (produto, quantidade,
   fita e "zona de reservas"), "Cobrar no caixa: R$ X", botão "Entreguei e cobrei · confirmar".
   Itens vencidos ou cancelados não aparecem. Se o cliente desistir de um item no balcão, ele
   cancela o item no app e o lojista digita o código de novo.
10. **Confirmada:** "N itens · R$ X · HH:MM" e os estoques das ofertas atualizados.

### Telas sem mudança de regra
L10/G4 (reservas aguardando: mostram o código do pedido mascarado), G1 (indicadores por item,
como hoje), G3 (histórico por item, com o código do pedido).

## 3. Modelo (backend)

- **`Pedido`:** `cliente`, `loja`, `codigo` (6 dígitos), `criado_em`. Estado **derivado** das
  reservas: ativo se alguma está `reservada`; retirado; encerrado (expiradas/canceladas).
- **`Reserva`** ganha `pedido` (obrigatório). O **código sai da Reserva e vai para o Pedido**.
- **Unicidade:** código único entre os **pedidos ativos da mesma loja** (mesma regra de hoje,
  mudando de tabela). Sorteio repetido quando colide, como hoje.
- **Migração sem perda:** cada reserva existente vira um pedido de 1 item com o código dela.
- Todas as reservas de um pedido são da mesma loja e do mesmo cliente (trava no serviço e, se
  possível, no banco).

## 4. Contrato — grupo J · Pedido (📝 combinado)

| Método e rota | Entrada | Saída | Erros |
|---|---|---|---|
| `POST /api/pedidos` | `{loja_id, itens: [{oferta_id, pedido}]}` | `201 Pedido` (com `status` por item) | `400 itens_vazios`, `400 oferta_de_outra_loja`, `400 item_repetido`, `400 pedido_invalido`, `409 tudo_esgotado` (com os itens e o motivo) |
| `GET /api/pedidos?estado=ativo\|encerrado` | — | `200 [Pedido]` | — |
| `GET /api/pedidos/{id}` | — | `200 Pedido` | `404` (só o dono vê) |
| `POST /api/pedidos/{id}/cancelar` | — | `200 Pedido` | `409 nada_ativo` |
| `POST /api/pedidos/{id}/itens/{reservaId}/cancelar` | — | `200 Pedido` | `409 ja_encerrado` |
| `GET /api/lojas/{lojaId}/pedidos/ativo?codigo=` | — | `200 PedidoNoBalcao` | `404 nao_encontrado` |
| `POST /api/lojas/{lojaId}/retiradas` | `{codigo}` | `200 RetiradaFeita` (agora com a lista de itens) | `404 nao_encontrada`, `409 venceu` |

```jsonc
// Pedido
{ "id": 12, "codigo": "482917",
  "loja": { "id": 1, "nome": "Mercadinho Vila Nova", "endereco": "..." },
  "estado": "ativo",                      // ativo | retirado | encerrado (derivado)
  "expira_em_proximo": "2026-11-18T20:00:00-03:00",   // menor expira_em entre os itens ativos
  "total": "7.88",                        // soma dos itens ativos
  "itens": [
    { "reserva_id": 40, "oferta_id": 3, "produto": "Iogurte natural 170 g",
      "pedido": 2, "quantidade": 2, "status": "confirmada",   // confirmada | parcial | recusada
      "estado": "reservada", "expira_em": "...", "preco": "3.14", "subtotal": "6.28" },
    { "reserva_id": null, "oferta_id": 9, "produto": "Molho de tomate 340 g",
      "pedido": 1, "quantidade": 0, "status": "recusada", "estado": null }
  ] }
```
- `POST /api/pedidos` responde **201** sempre que ao menos um item foi reservado; o resultado de
  cada item vem em `status`. Só quando **nenhum** item foi reservado: `409 tudo_esgotado`, sem
  gerar código.
- **As rotas atuais continuam** durante a transição: `POST /api/ofertas/{id}/reservas` passa a
  criar um pedido de 1 item e devolve também `pedido_id` e o `codigo` do pedido.
  `minhas-reservas`, `reservas/{id}` e `reservas/{id}/cancelar` seguem funcionando.

## 5. Regras (serviço)

- **Confirmar = uma transação:** para cada item, a mesma operação `reservar` do domínio (parcial
  quando o livre não basta; recusa gravada em `Recusa` quando o livre é zero; `expira_em` limitado
  ao fim da oferta). Depois, cria o pedido e sorteia o código.
- **Trava em ordem de id:** as ofertas são bloqueadas (`select_for_update`) **sempre em ordem
  crescente de id**, para dois pedidos com os mesmos itens não ficarem esperando um ao outro
  (deadlock).
- **Varredura antes de reservar**, como hoje (reservas vencidas voltam ao livre primeiro).
- **Retirada:** busca o pedido ativo pelo código **na loja da rota**; retira todas as reservas
  ainda `reservada` numa transação; vencidas antes do toque ficam de fora. Nenhuma ativa →
  `409 venceu`.
- **Cancelar um item** devolve só aquele item ao livre; o código continua para o resto.
- **Indicadores e simulação não mudam:** recusa e parcial continuam contadas por item.

## 6. Testes mínimos

- Backend: pedido com 3 itens todos confirmados (um código); com um parcial e um recusado
  (201, status por item); todos recusados (409, sem código, recusas gravadas); oferta de outra
  loja (400); item repetido (400); conservação de cada oferta preservada; **concorrência**: dois
  pedidos ao mesmo tempo disputando as mesmas 2 ofertas em ordem inversa terminam sem deadlock
  e sem vender a mais; código único entre pedidos ativos da loja; retirada retira só os ativos;
  item vencido fica fora da retirada; cancelar um item; migração transforma reservas antigas
  em pedidos de 1 item com o mesmo código. Os testes atuais continuam passando.
- Frontend: adicionar, alterar e remover no carrinho; agrupamento por loja; confirmar nos 3
  resultados (tudo, misto, nada); visitante confirma → login → volta ao C10; C6 com o prazo do
  primeiro item e item vencido saindo da lista; L13 com lista; o carrinho é da conta logada.

## 7. Fora deste escopo

Pagamento online; segurar estoque no carrinho (versão A, descartada); juntar lojas diferentes
num código só; retirada parcial de um pedido no balcão.
