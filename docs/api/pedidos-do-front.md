# Pedidos do frontend para o contrato da API

O frontend **não altera** o [`contrato.md`](contrato.md). Quando uma tela precisar de algo
que o contrato não tem (campo, filtro, rota, formato de erro), registre aqui. O Henrique
decide no `main` e, se aceitar, o contrato muda lá.

Enquanto o pedido estiver aberto, o mock pode **simular** o campo pedido, marcado no
código com `// PEDIDO-API n`.

## Formato

```
### n · título curto (aberto | aceito | recusado)
- Tela: código da tela (ex.: L10)
- Grupo do contrato: letra (ex.: C)
- O que falta: ...
- Por que a tela precisa: ...
- Proposta de formato: ...
- Decisão (preenchida no main): ...
```

## Pedidos

### 1 · `retirar_ate` na oferta, antes de reservar (aberto)
- Tela: C4 (Reserva da quantidade)
- Grupo do contrato: B
- O que falta: o horário-limite de retirada **se a pessoa reservar agora**. A prancha da C4 mostra
  "Retire até **hoje, 20:00** (janela de 4 h)" antes de a reserva existir; o contrato só traz
  `janela_horas` e `fim`.
- Por que a tela precisa: calcular `mín(agora + janela, fim)` no navegador é exatamente o que a
  especificação proíbe (a regra é do backend, e o relógio do celular pode estar errado).
- Proposta de formato: em `GET /api/ofertas/{id}` (e, se for simples, em `GET /api/ofertas`), o
  campo `"retirar_ate": "2026-10-22T20:00:00-03:00"` — `mín(agora + janela, fim)` calculado no
  momento da leitura (o mesmo cálculo do `expira_em` na reserva). Ausente ou `null` em oferta
  encerrada. O valor oficial continua sendo o `expira_em` da reserva criada.
- Enquanto não houver: o mock simula (`// PEDIDO-API 1`); sem o campo, a C4 mostra só
  "janela de 4 h · oferta até 27/10, 23:59".
- Decisão (preenchida no main): ...
