# Contrato da API — TG Marketplace

Versão 0 (05/11/2026). **Dono: backend** (branch `main`). O frontend lê este arquivo e
não o altera: pedidos de mudança vão em [`pedidos-do-front.md`](pedidos-do-front.md).

Para **testar** as rotas no navegador, o backend em desenvolvimento (`DJANGO_DEBUG=true`)
serve um Swagger em `http://localhost:8000/api/docs`. Ele resume este contrato; se os
dois divergirem, **vale este arquivo**.

Status de cada grupo:
- 📝 **combinado**: formato fechado; o frontend usa no mock;
- 🔧 **em construção**: o backend está implementando;
- ✅ **pronto**: existe no backend, testado; o frontend pode trocar o mock pelo real.

| Grupo | Telas | Status | Etapa do backend |
|---|---|---|---|
| A · Acesso | A1–A5, C9 | ✅ | 6 |
| B · Consumidor | C2–C8 | ✅ | 8 |
| C · Operação da loja | L1, L9–L13 | ✅ | 9 |
| D · Lote, fita e aviso | L2–L8, L4/G5 | ✅ | 10 |
| E · Configuração da loja | L14/G6 | ✅ | 10 |
| F · Gestor | G1, G3, G4 | ✅ | 11 |
| G · Projeção | G2 | ✅ | 13 |
| H · Push | C1, C9 | fora até 09/11 | — |
| I · Parceria | A4, A6, A7, P1–P3 | ✅ | 14 |

---

## Convenções (valem para todos os grupos)

- **Prefixo:** todas as rotas de tela começam com `/api/`. Fora dele só ficam `/health`
  (servidor acordado?) e `/tarefas/varrer` (agendamento diário).
- **Autenticação:** cabeçalho `Authorization: Token <chave>` (token do DRF, confirmado
  em 06/11/2026; não expira sozinho — `POST /api/auth/sair` o invalida).
  Sem token numa rota protegida → `401`. Com token, mas sem papel → `403`.
- **Datas e horas:** ISO 8601 com fuso, ex.: `"2026-10-22T20:00:00-03:00"`.
  Datas sem hora (validade): `"2026-10-28"`. A tela formata; não calcula.
- **Dinheiro:** texto decimal com 2 casas, ex.: `"3.14"` (evita erro de arredondamento
  do JavaScript). Desconto: inteiro em %, ex.: `30`.
- **Taxas:** número de 0 a 1 (ex.: `0.62`), ou `null` quando a base é zero.
- **Ids:** inteiros.
- **Erro:** sempre `{"erro": "<frase para a pessoa>", "codigo": "<identificador>"}`.
  A tela mostra `erro`; decide o que fazer pelo `codigo`.
- **Regra de ouro do frontend:** a tela **exibe** o que vem aqui. Reserva parcial,
  `expira_em`, fim da oferta, cor da fita, preço com desconto, conservação, código
  único e indicadores são calculados **só no backend**.

### Valores fixos (enumerações)

| Nome | Valores |
|---|---|
| `categoria` | `mercearia`, `enlatados`, `laticinios`, `leite`, `frios`, `doces` (rótulos: Mercearia, Enlatados, Laticínios, Leite, Frios, Doces) — **lista única** para vitrine e cadastro |
| `cor` (fita) | `vermelho` (jan–fev), `amarelo` (mar–abr), `verde` (mai–jun), `azul` (jul–ago), `branco` (set–out), `preto` (nov–dez). O hex fica nos tokens do frontend |
| `estado` da reserva | `reservada`, `retirada`, `expirada`, `cancelada` |
| `estado` da oferta | `ativa`, `encerrada` |
| `papel` | `responsavel`, `funcionario` |
| `situacao` do grupo de fita | `aguardando` (aviso ainda não chegou), `conferir` (aviso disparado), `adiado`, `em_oferta`, `encerrado` (oferta terminou ou "não vai para oferta") |
| `faixa_desconto` (filtro) | `ate30` (≤ 30%), `30a50` (> 30% e < 50%), `50mais` (≥ 50%) |
| `motivo` do ajuste | texto livre; a tela oferece "Danificada", "Extraviada", "Vendida no balcão" ou "Outro" + texto |

### Objetos que se repetem

```jsonc
// LojaResumo
{ "id": 1, "nome": "Mercadinho Vila Nova", "endereco": "Rua das Palmeiras, 410 · Boa Vista" }

// Estoque (conservação: separado = livre + reservado + retirado + ajustado + perda)
{ "separado": 12, "livre": 6, "reservado": 4, "retirado": 2, "ajustado": 0, "perda": 0 }

// Fita
{ "cor": "branco", "bimestre": "set–out", "ano": 2026 }
```

---

## A · Acesso ✅

Pronto em 11/11/2026. Além dos erros da tabela, a criação de conta também pode
devolver `400 sem_nome` e `400 email_invalido`. E-mail não diferencia maiúsculas
(`Ana@x.com` = `ana@x.com`). Login errado responde igual para e-mail inexistente e
senha errada (não revela quem tem conta).

| Método e rota | Entrada | Saída | Erros |
|---|---|---|---|
| `POST /api/auth/login` | `{email, senha}` | `200 {token, usuario: Eu}` | `400 credenciais_invalidas` |
| `POST /api/auth/conta` | `{nome, email, senha, aceite_termos: true}` | `201 {token, usuario: Eu}` | `400 email_em_uso`, `senha_curta` (< 8), `termos` |
| `POST /api/auth/sair` | — | `204` | — |
| `GET /api/eu` | — | `200 Eu` | `401` |

```jsonc
// Eu
{
  "id": 7, "nome": "Ana Souza", "email": "ana@email.com",
  "vinculos": [ { "loja": { "id": 1, "nome": "Mercadinho Vila Nova" }, "papel": "responsavel" } ]
}
```
Sem vínculos = consumidor. "Esqueci minha senha" fica **para depois de 09/11** (exige
envio de e-mail): o link da A2 só orienta a pessoa, sem chamar a API.

## B · Consumidor ✅

Pronto em 11/11/2026. Detalhes que valem para o mock:
- A vitrine **não lista ofertas esgotadas** (`livre` 0) nem encerradas; o detalhe
  `GET /api/ofertas/{id}` responde para ambas (decidido 11/11/2026).
- Filtro inválido (`categoria`, `faixa_desconto`, `lat`/`lng` que não são número) →
  `400 parametro_invalido`. O mesmo para `estado` inválido em `minhas-reservas`.
- `GET /api/minhas-reservas` **sem** `estado` devolve as ativas (por `expira_em`) e
  depois as encerradas (por `encerrada_em` desc.).
- Antes de responder reservas, o backend expira as vencidas: a tela nunca recebe
  `reservada` numa reserva que já venceu.
- Loja sem coordenada aparece no fim da lista ordenada por distância, com `distancia_km: null`.
- **CORS:** a API só aceita chamadas do navegador vindas dos endereços em
  `CORS_ALLOWED_ORIGINS` (local: `http://localhost:5173`).

### `GET /api/ofertas` — vitrine (pública: não exige login)
Parâmetros, todos opcionais: `lat`, `lng` (coordenada já convertida **no navegador**; sem
eles a lista não é ordenada por distância), `categoria`, `faixa_desconto`, `q` (busca no nome).

```jsonc
// 200 — lista de OfertaVitrine, ordenada por distância (ou por fim mais próximo, sem lat/lng)
[{
  "id": 1,
  "produto": { "nome": "Iogurte natural 170 g", "categoria": "laticinios" },
  "loja": { "id": 1, "nome": "Mercadinho Vila Nova", "endereco": "Rua das Palmeiras, 410 · Boa Vista" },
  "distancia_km": 0.4,            // null sem lat/lng
  "preco": "3.14", "preco_original": "4.49", "desconto": 30,
  "livre": 6,                     // já desconta reservas vencidas ainda não processadas
  "validade": "2026-10-28",
  "fim": "2026-10-27T23:59:00-03:00",
  "janela_horas": 4,
  "retirar_ate": "2026-10-22T20:00:00-03:00",  // se reservar AGORA: mín(agora + janela, fim)
  "fita": { "cor": "branco", "bimestre": "set–out", "ano": 2026 }
}]
```
`retirar_ate` (pedido 1, aceito em 13/11/2026): calculado pelo **domínio** no momento da
leitura (`dominio.prazo_de_retirada`, a mesma função que grava o `expira_em` da reserva).
Vem na vitrine e no detalhe; `null` na oferta encerrada. Arredondado ao segundo. O valor
oficial continua sendo o `expira_em` da reserva criada.

### `GET /api/ofertas/{id}` (pública)
`200 OfertaVitrine` · `404 nao_encontrada`. Oferta encerrada vem com `livre: 0` e
`"estado": "encerrada"` (campo extra só nesta rota).

### `POST /api/ofertas/{id}/reservas` (exige login)
Entrada: `{ "pedido": 3 }`.

```jsonc
// 201 — confirmada (quantidade == pedido) ou parcial (quantidade < pedido). Parcial NÃO é erro.
{ "status": "parcial", "reserva": Reserva }

// 409 — recusada: livre era 0. O backend grava uma Recusa.
{ "status": "recusada", "pedido": 3, "erro": "Esgotou agora há pouco", "codigo": "esgotada" }
```
Outros erros: `401` (tela leva a A2 e volta), `409 oferta_encerrada`, `400 pedido_invalido`.

```jsonc
// Reserva (visão do consumidor)
{
  "id": 31, "estado": "reservada",
  "quantidade": 2, "pedido": 3,
  "codigo": "482917",                         // completo só para o dono da reserva
  "criada_em": "2026-10-22T16:18:00-03:00",
  "expira_em": "2026-10-22T20:00:00-03:00",   // mín(agora + janela, fim) — calculado no backend
  "encerrada_em": null,                       // preenchido em retirada/expirada/cancelada
  "total": "6.28", "economia": "2.70",
  "oferta": { "id": 1, "produto": { "nome": "Iogurte natural 170 g", "categoria": "laticinios" },
              "preco": "3.14", "preco_original": "4.49",
              "fita": { "cor": "branco", "bimestre": "set–out", "ano": 2026 },
              "loja": LojaResumo }
}
```

| Método e rota | Saída | Erros |
|---|---|---|
| `GET /api/minhas-reservas?estado=ativa\|encerrada` | `200 [Reserva]` (ativas por `expira_em`; encerradas por `encerrada_em` desc.) | `401` |
| `GET /api/reservas/{id}` | `200 Reserva` | `404` (inclusive reserva de outra pessoa) |
| `POST /api/reservas/{id}/cancelar` | `200 Reserva` (estado `cancelada`) | `404`, `409 nao_ativa` |

A tela C6 revalida com `GET /api/reservas/{id}` a cada 30 s; se `estado` mudar, vai para C7.

## C · Operação da loja ✅
Exigem vínculo com a loja `{lojaId}` (funcionário ou responsável), senão `403`.

Pronto em 12/11/2026. Detalhes que valem para o mock:
- Antes de responder, o backend passa a ronda **só daquela loja**: reservas vencidas já
  vêm como `expirada` e ofertas que passaram do `fim` já vêm `encerrada` (sobra = perda).
- `avisos_para_conferir` conta os grupos em situação `conferir` (desde a etapa 10a).
- `aguardando_retirada` e `expiram_em_1h` contam **reservas** (pessoas a atender), não unidades.
- `ofertas` sem `estado` devolve as ativas (por `fim`, a que acaba antes primeiro) e depois
  as encerradas (por `fim` desc.). `estado` inválido → `400 parametro_invalido`.
- Oferta de outra loja → `404 nao_encontrada` (não `403`).
- `ReservaLoja.cliente` = primeiro nome + inicial do último ("Ana Souza" → "Ana S.").
  Reservas da oferta ativa por `expira_em`; da encerrada, por `criada_em`.
- **Código errado e código vencido são respostas diferentes:** se o código pertence a uma
  reserva desta loja que venceu nas últimas 24 h, a prévia e a retirada respondem
  `409 venceu` (mesmo que a ronda já a tenha expirado); senão, `404 nao_encontrada`.
  Código fora do formato (não são 6 dígitos em texto) → `404`.
- Dois balcões com o mesmo código ao mesmo tempo: um recebe `200`, o outro `404`.

### `GET /api/lojas/{lojaId}/resumo-do-dia`
```jsonc
{ "loja": LojaResumo, "papel": "responsavel",
  "aguardando_retirada": 6, "expiram_em_1h": 2, "ofertas_ativas": 4, "avisos_para_conferir": 5 }
```

### `GET /api/lojas/{lojaId}/ofertas?estado=ativa|encerrada`
```jsonc
[{ "id": 1, "produto": { "nome": "Iogurte natural 170 g", "categoria": "laticinios" },
   "fita": Fita, "validade": "2026-10-28", "preco": "3.14", "preco_original": "4.49", "desconto": 30,
   "janela_horas": 4, "inicio": "...", "fim": "2026-10-27T23:59:00-03:00", "estado": "ativa",
   "estoque": Estoque }]
```

### `GET /api/lojas/{lojaId}/ofertas/{id}`
O mesmo objeto + `"reservas": [ReservaLoja]` (ativas na oferta ativa; todas na encerrada).
```jsonc
// ReservaLoja — o código vem MASCARADO para a loja
{ "id": 31, "codigo_final": "917", "quantidade": 2, "pedido": 2, "estado": "reservada",
  "cliente": "Ana S.", "criada_em": "...", "expira_em": "...", "encerrada_em": null }
```

### `POST /api/lojas/{lojaId}/ofertas/{id}/ajustes`
Entrada `{quantidade, motivo}` → `201 {"estoque": Estoque}`.
Erros: `409 acima_do_livre` (com `"livre": 6` no corpo — o livre **já sem** as vencidas),
`400 sem_motivo`, `400 quantidade_invalida` (não é inteiro ≥ 1), `400 motivo_longo` (> 200),
`409 oferta_encerrada`, `404 nao_encontrada`.

### Retirada (L12 → L13)
| Método e rota | Entrada | Saída | Erros |
|---|---|---|---|
| `GET /api/lojas/{lojaId}/reservas/ativa?codigo=482917` | — | `200 RetiradaPrevia` | `404 nao_encontrada`, `409 venceu` |
| `POST /api/lojas/{lojaId}/retiradas` | `{codigo}` | `200 RetiradaFeita` | `404 nao_encontrada`, `409 venceu` |

A retirada é por **loja + código** (o código prova que o cliente está no balcão), não pelo
id da reserva.
```jsonc
// RetiradaPrevia
{ "reserva": ReservaLoja, "codigo": "482917", "total": "6.28",
  "produto": "Iogurte natural 170 g", "fita": Fita,
  "validade": "2026-10-28" }      // pedido 3: a amostra da fita sempre com a data exata
// RetiradaFeita
{ "reserva": ReservaLoja, "total": "6.28", "retirada_por": "Carlos Lima",
  "oferta": { "id": 1, "estoque": Estoque } }
```

## D · Lote, fita e aviso ✅
Exigem vínculo com a loja. Decisões de 05/11/2026 já aplicadas.

Pronto em 12/11/2026. Detalhes que valem para o mock:
- **Situação "conferir" é calculada**, não gravada: `aguardando` cujo `aviso_em` ≤ hoje, ou
  `adiado` cujo `adiado_ate` ≤ hoje (o adiado volta a ser aviso no dia escolhido).
- **Grupo que já virou oferta não recebe lote** (decidido 12/11/2026): o lote abre grupo
  novo (`resultado: "novo"`). A colisão vale também contra grupo em oferta (a fita igual
  ainda está na gôndola).
- Lote que vence **antes** da referência a puxa para trás (e o `aviso_em` junto). Se o
  grupo estava adiado além do novo limite, o adiamento é desfeito (volta a `aguardando`).
- Respostas de **um** grupo (lote, aviso, adiar, descartar) trazem `lotes`; a lista
  `/grupos` traz sempre `qtd_lotes` e `recebido`, e `lotes` só com `?com_lotes=1`.
- `recebido_em` é a data do registro (hoje, horário de Brasília).
- Grupo que não está em aviso (inclusive depois de publicado ou descartado) → `404
  nao_encontrado` nas rotas `/avisos/{id}...`. Publicar duas vezes: a segunda dá `404`.
- A oferta publicada tem `validade` = referência do grupo e `fim` = 23:59 de
  (validade − margem efetiva).

### Produtos (L2, busca da L3)
| Método e rota | Entrada | Saída |
|---|---|---|
| `GET /api/lojas/{lojaId}/produtos?q=` | — | `200 [Produto]` |
| `POST /api/lojas/{lojaId}/produtos` | `{nome, categoria, margem_fim_dias: int\|null}` | `201 Produto` |

Erros do cadastro: `400 sem_nome`, `400 nome_longo` (> 120), `400 categoria_invalida`,
`400 margem_invalida` (fora de 0–7 ou não inteiro). `?q=` busca por parte do nome.

```jsonc
// Produto
{ "id": 3, "nome": "Leite condensado 395 g", "categoria": "mercearia",
  "margem_fim_dias": null,           // null = usa a da loja
  "margem_efetiva_dias": 1,
  "ultimo_preco_original": "6.99" }  // da última oferta do produto; null se nunca teve oferta
```

### `POST /api/lojas/{lojaId}/lotes` (L3)
Entrada `{produto: id, validade: "2026-12-18", quantidade: 24}`.
```jsonc
// 201
{ "lote": { "id": 9, "validade": "2026-12-18", "quantidade": 24, "recebido_em": "2026-10-22" },
  "grupo": Grupo,
  "resultado": "colisao",            // "novo" | "agrupado" | "colisao"
  "colisao": { "validade": "2025-12-22" } }   // null quando não há
```
Grupo = produto + cor + **ano do bimestre**. "Colisão" = existe grupo ativo do mesmo
produto e mesma cor, mas de outro ano: cria grupo novo, avisa e não bloqueia.
Erros: `400 validade_invalida` (não é `AAAA-MM-DD`), `400 validade_passada`,
`400 quantidade_invalida`, `404 nao_encontrado` (produto de outra loja ou inexistente).

### `GET /api/lojas/{lojaId}/grupos?cor=&situacao=` (L4, G5)
```jsonc
// Grupo
{ "id": 4, "produto": { "id": 3, "nome": "Achocolatado em pó 400 g" },
  "fita": { "cor": "preto", "bimestre": "nov–dez", "ano": 2026 },
  "referencia": "2026-12-09",        // a validade mais próxima entre os lotes do grupo
  "situacao": "adiado",
  "aviso_em": "2026-11-29",          // referência − antecedência da loja
  "adiado_ate": "2026-10-23",        // null se não adiado
  "colisao": { "validade": "2025-12-22" },
  "lotes": [ { "id": 9, "validade": "2026-12-18", "quantidade": 24, "recebido_em": "2026-10-22" } ],
  "oferta_id": null }                // preenchido em "em_oferta" e "encerrado" com oferta
```
Na rota de lista, `lotes` pode vir só com a contagem (`"qtd_lotes": 2`, `"recebido": 36`);
o detalhe completo aparece ao expandir (G5) — mesma rota com `?com_lotes=1`.

### Avisos (L5–L8)
O aviso é o grupo em situação `conferir` ou `adiado`; o `avisoId` é o id do grupo.

| Método e rota | Entrada | Saída | Erros |
|---|---|---|---|
| `GET /api/lojas/{lojaId}/avisos` | — | `200 {antecedencia_dias, avisos: [Aviso]}` (por referência mais próxima) | — |
| `GET /api/lojas/{lojaId}/avisos/{id}` | — | `200 AvisoDetalhe` | `404` |
| `POST /api/lojas/{lojaId}/avisos/{id}/adiar` | `{ate: "2026-11-03"}` | `200 Grupo` | `400 apos_limite` (com `adiar_ate_max`), `400 data_invalida` (hoje ou antes) |
| `POST /api/lojas/{lojaId}/avisos/{id}/descartar` | `{motivo: "sem_unidades" \| "outro_destino"}` | `200 Grupo` (`encerrado`) | `400 motivo_invalido` |
| `POST /api/lojas/{lojaId}/avisos/{id}/publicar` | `{separado, preco_original, desconto, janela_horas, confirmou_separacao: true}` | `201 {oferta}` (objeto do grupo C) | `400 sem_confirmacao`, `400 separado_invalido`, `400 acima_do_recebido` (com `recebido`), `400 preco_invalido`, `400 desconto_invalido`, `400 janela_invalida`, `409 fim_ja_passou` |

```jsonc
// Aviso (item da lista)
{ "id": 4, "grupo": Grupo, "vence_em_dias": 6, "urgente": true }   // urgente: até 7 dias
// AvisoDetalhe
{ "grupo": Grupo,
  "preco_sugerido": "6.99",             // = produto.ultimo_preco_original; null na primeira oferta
  "janela_padrao_horas": 4,
  "fim_previsto": "2026-10-27T23:59:00-03:00",   // 23:59 do dia (validade − margem efetiva)
  "adiar_ate_max": "2026-10-26",        // véspera do último dia da oferta
  "margem_efetiva_dias": 1 }
```

- **Desconto e preço:** a L6 só conta as unidades. Preço normal e desconto ficam na L7.
  O backend calcula `preco = preco_original × (1 − desconto/100)`, arredondado a centavos
  (meio para cima). A L7 pode mostrar a prévia com a mesma conta, mas o valor oficial é o
  da resposta. Opções de desconto: 20, 30, 40, 50.
- **Não vai para oferta** (`descartar`): encerra o grupo sem oferta. Não conta como perda
  no painel (a perda é só de oferta encerrada).
- **Adiar:** no máximo até `adiar_ate_max`. Ex.: validade 05/11, margem 1 dia → a oferta
  iria até 04/11, 23:59 → adiar até 03/11.

## E · Configuração da loja ✅
Leitura: vínculo com a loja. Escrita: **só responsável** (`403` para funcionário).

Pronto em 13/11/2026. Detalhes que valem para o mock:
- **PATCH parcial:** só os campos enviados mudam. Se **um** campo está errado, **nada** é
  gravado (`400` com o código do primeiro erro). `id` e campos desconhecidos são ignorados.
- Erros do PATCH: `400 sem_nome`, `400 nome_longo` (> 120), `400 sem_endereco`,
  `400 endereco_longo` (> 255), `400 janela_invalida`, `400 margem_invalida`,
  `400 antecedencia_invalida` (fora de **1–30**), `400 coordenadas_incompletas`
  (latitude e longitude vão **juntas**; as duas `null` apagam), `400 coordenadas_invalidas`
  (não é número, ou fora de −90..90 / −180..180).
- **Antecedência > margem** (decidido 13/11/2026): senão o aviso chega depois do último dia
  da oferta. Conferido no par final (o que veio + o que já estava gravado): `400
  antecedencia_menor_que_margem`, tanto ao baixar a antecedência quanto ao subir a margem.
  Margem própria de produto maior que a antecedência não é barrada aqui; na publicação,
  o `409 fim_ja_passou` protege.
- Erros do POST de vínculo: `400 email_invalido`, `400 papel_invalido`. O e-mail é comparado
  sem diferenciar maiúsculas. A pessoa precisa **já ter conta**.
- PATCH de vínculo (pedido 4, aceito em 13/11/2026): promove ou rebaixa. Mesmo papel = `200`
  sem mudar nada. Trava a loja como o DELETE: dois responsáveis se rebaixando ao mesmo
  tempo não zeram a equipe.
- DELETE: `404 nao_encontrado` (vínculo de outra loja ou inexistente). Remover alguém **não
  apaga a conta**: a pessoa volta a ser só consumidora. A lista vem com responsáveis primeiro.

| Método e rota | Entrada | Saída | Erros |
|---|---|---|---|
| `GET /api/lojas/{lojaId}` | — | `200 LojaConfig` | — |
| `PATCH /api/lojas/{lojaId}` | campos de `LojaConfig` | `200 LojaConfig` | `400` por campo |
| `GET /api/lojas/{lojaId}/vinculos` | — | `200 [Vinculo]` | — |
| `POST /api/lojas/{lojaId}/vinculos` | `{email, papel}` | `201 Vinculo` | `404 conta_nao_existe`, `409 ja_vinculado` |
| `PATCH /api/lojas/{lojaId}/vinculos/{id}` | `{papel}` | `200 Vinculo` | `400 papel_invalido`, `404 nao_encontrado`, `409 proprio_vinculo`, `409 ultimo_responsavel` |
| `DELETE /api/lojas/{lojaId}/vinculos/{id}` | — | `204` | `409 ultimo_responsavel`, `409 proprio_vinculo` |

```jsonc
// LojaConfig
{ "id": 1, "nome": "Mercadinho Vila Nova", "endereco": "Rua das Palmeiras, 410 · Boa Vista",
  "latitude": -20.8113, "longitude": -49.3758,   // do endereço; conversão no navegador (serviço a escolher)
  "janela_padrao_horas": 4, "margem_fim_dias": 1, "antecedencia_aviso_dias": 10 }
// Vinculo
{ "id": 2, "usuario": { "nome": "Juliana Prado", "email": "juliana.prado@email.com" },
  "papel": "funcionario", "eu": false }
```
Opções da janela: 1, 2, 4, 8, 12, 24 h. Margem: 0–7 dias. Mudanças valem só para lotes e
ofertas novos.

## F · Gestor ✅
Só **responsável**.

Pronto em 13/11/2026. Detalhes que valem para o mock:
- **Período** (decidido 13/11/2026): `de` e `ate` são dias de Brasília, os dois incluídos.
  Sem eles: últimos 30 dias (hoje incluído). `400 periodo_invalido` se a data não for
  `AAAA-MM-DD`, se `de` > `ate` ou se passar de 1 ano. Vale para as duas rotas.
- **Cada número usa a data do próprio evento** (decidido 13/11/2026): reservas criadas,
  parciais e recusas pela criação; encerradas, taxas e `semanas` pelo `encerrada_em` (a
  expirada conta na hora em que **venceu**); perda pelo `fim` da oferta. Uma reserva criada
  em 30/10 e retirada em 02/11 é "criada" em outubro e "retirada" em novembro.
- **Taxas `null`** quando não há reserva encerrada no período (a tela mostra "—", não 0%).
  Taxas com 3 casas.
- `semanas`: começam na **segunda-feira**; toda semana que toca o período aparece, mesmo
  com zeros (o gráfico não tem buraco).
- Histórico: itens **criados** no período, do mais recente ao mais antigo, sem paginação.
  `total_reservas` e `total_recusas` são do período inteiro (não mudam com `estado`/`q`).
  `q` busca no nome do produto ou no final do código (a recusa não tem código).
  `400 estado_invalido`. O código vem sempre mascarado (`codigo_final`, 3 dígitos).

### `GET /api/lojas/{lojaId}/indicadores?de=2026-10-01&ate=2026-10-31`
Antes de calcular, o backend faz a varredura (expira vencidas, encerra ofertas no fim).
```jsonc
{ "de": "2026-10-01", "ate": "2026-10-31",
  "reservas_criadas": 148,
  "encerradas": { "total": 120, "retiradas": 80, "expiradas": 25, "canceladas": 15 },
  "taxa_retirada": 0.667,           // retiradas ÷ encerradas
  "taxa_expiracao": 0.208,          // expiradas ÷ encerradas
  "bloqueados": { "total": 23, "recusas": 17, "parciais": 6 },
  "perda_unidades": 9,              // sobra livre das ofertas encerradas no período
  "semanas": [ { "inicio": "2026-09-28", "retiradas": 12, "expiradas": 4, "canceladas": 2 } ] }
```
As tabelas "Ofertas ativas" e "Reservas em andamento" da G1 usam o grupo C.

### `GET /api/lojas/{lojaId}/historico?de=&ate=&estado=&q=` (G3)
`estado`: `reservada`, `retirada`, `expirada`, `cancelada` ou `recusa`. `q`: produto ou final do código.
```jsonc
{ "total_reservas": 148, "total_recusas": 17,
  "itens": [
    { "tipo": "reserva", "criada_em": "...", "codigo_final": "917", "produto": "Iogurte natural 170 g",
      "quantidade": 2, "pedido": 3, "cliente": "Ana S.", "estado": "retirada", "encerrada_em": "..." },
    { "tipo": "recusa", "criada_em": "...", "codigo_final": null, "produto": "Presunto fatiado 200 g",
      "quantidade": 0, "pedido": 1, "cliente": "Bruno M.", "estado": "recusa", "encerrada_em": null } ] }
```

## G · Projeção ✅
Só **responsável**. Não roda simulação: lê um **resumo pré-calculado** dos resultados de
`simulacao/resultados_n5000/` (ver "De onde vêm os números", abaixo).

### `GET /api/lojas/{lojaId}/projecao?lote=&procura=&chegada=`
- `lote`: faixa de tamanho do lote — `5-14`, `15-24`, `25-34`, `35-44`, `45-60` ou vazio (todas);
- `procura`: faixa de procura ÷ lote — `0.3-0.8`, `0.8-1.3`, `1.3-1.8`, `1.8-2.3`, `2.3-3.0` ou vazio;
- `chegada`: mediana do tempo até o cliente chegar — `1`, `2` (padrão) ou `4` horas.
- Parâmetro vazio = sem filtro. Valor fora da lista → `400 parametro_invalido`.

```jsonc
{ "rodadas": 5000,                  // quantas rodadas simuladas entram na conta
  "filtro": { "lote": null, "procura": null, "chegada": 2 },
  "janelas": [
    { "janela_horas": 0.5, "perda_pct": 92.6, "bloqueados_pct": 0.6, "retirada_pct": 4.6 },
    { "janela_horas": 1,   "perda_pct": 74.2, "bloqueados_pct": 1.3, "retirada_pct": 16.1 },
    { "janela_horas": 2,   "perda_pct": 48.4, "bloqueados_pct": 5.4, "retirada_pct": 34.7 },
    { "janela_horas": 4,   "perda_pct": 31.3, "bloqueados_pct": 13.8, "retirada_pct": 53.3 },
    { "janela_horas": 8,   "perda_pct": 24.9, "bloqueados_pct": 19.5, "retirada_pct": 64.5 },
    { "janela_horas": 12,  "perda_pct": 23.7, "bloqueados_pct": 21.2, "retirada_pct": 67.4 },
    { "janela_horas": 24,  "perda_pct": 24.4, "bloqueados_pct": 21.8, "retirada_pct": 67.4 } ] }
```
**Sem filtro e com chegada 2 h, a resposta é exatamente a Tabela 5 do artigo** (o exemplo
acima). Com filtro, a tela mostra sempre "baseado em N rodadas". Nenhum texto recomenda janela.
Combinação de filtros sem nenhuma rodada: `rodadas: 0` e os números `null` (as 7 janelas vêm
sempre). As faixas incluem o limite de baixo e não o de cima (procura 0.8 cai em `0.8-1.3`);
a última inclui o topo (lote 60, procura 3.0).

#### De onde vêm os números (backend, etapa 13)
1. `simulacao/resultados_n5000/rodadas_tempo_chegada.csv` (19 MB, fora do git,
   regenerável pela semente) tem as 3 medianas × 5000 rodadas × 7 janelas; a mediana
   2 h é idêntica ao `rodadas.csv` base (conferido em 05/11/2026: 35.000 de 35.000 linhas).
2. O comando `manage.py resumir_projecao` **só lê** esse CSV e gera um resumo pequeno e
   versionado (`backend/ofertas/dados/projecao_resumo.json`, 525 células): para cada
   chegada × faixa de lote × faixa de procura × janela, guarda **somas e contagens**
   (não médias), com contagem própria para bloqueados e retirada (rodadas sem reserva
   não têm essas taxas).
3. A rota soma as células da seleção e divide: dá a média exata das rodadas filtradas.
   Teste obrigatório: sem filtro = Tabela 5 (`ofertas/test_projecao.py`). Outro teste
   regenera o resumo a partir do CSV e compara com o versionado (pulado se o CSV não
   estiver na máquina).

## H · Push — fora até 09/11
Padrão Web Push (VAPID). Rotas previstas: `POST /api/push/inscricao`, `DELETE /api/push/inscricao`.

## I · Parceria ✅
Entrada de mercados por **parceria fechada** (decidido 18/11/2026). O processo, as telas e o
porquê ficam em [`../parceria.md`](../parceria.md); aqui ficam só as rotas.

Pronto em 23/11/2026. Detalhes que valem para o mock:
- Erros de campo (`campo_obrigatorio`, `campo_longo`) trazem também `"campo"` com o nome do
  campo, ex.: `{"erro": "Informe a cidade.", "codigo": "campo_obrigatorio", "campo": "cidade"}`.
  Limites: nome do mercado, cidade e nome da loja 120; endereço 255; mensagem 1000; motivo 255;
  telefone até 20 dígitos (guardado **só com dígitos**: a máscara é da tela).
- `GET /api/plataforma/interesses` e `GET /api/plataforma/lojas`: mais recentes primeiro.
- `POST /api/plataforma/lojas`: o e-mail do responsável é guardado em minúsculas.
  `interesse_id` inexistente → `404 nao_encontrado`.
- `POST /api/plataforma/lojas/{id}/convite` numa loja antiga, que nunca teve convite →
  `409 sem_convite` (não há e-mail para convidar).
- `LojaPlataforma.convite` = o convite **mais recente** da loja; `null` nas lojas antigas da
  demonstração (cadastradas antes da parceria, também com `cnpj: null`).
- Aceite: `201 {"vinculo": {"loja": {"id": 4, "nome": "Mercearia São Jorge"}, "papel": "responsavel"}}`
  — o mesmo formato de um item de `Eu.vinculos`, para a tela ir direto à L14 da loja.

"Equipe" = conta com `is_staff` (sem tabela nova; criada do PC com `createsuperuser` ou pelo
`popular_demo`, nunca pela API). Fora dela, rotas `/api/plataforma/...` → `403`.

**`Eu` ganha dois campos:**
```jsonc
{ "...": "...", "plataforma": false,
  "interesse": { "id": 3, "estado": "novo", "criado_em": "2026-11-18T10:00:00-03:00" } }  // ou null
```
`interesse` = o pedido **em aberto** da pessoa (`novo` ou `em_conversa`); `null` se não houver.

| Método e rota | Quem | Entrada | Saída | Erros |
|---|---|---|---|---|
| `POST /api/interesses` | logado | `{nome_mercado, cidade, telefone, mensagem?}` | `201 Interesse` | `400 campo_obrigatorio`, `400 campo_longo`, `409 interesse_em_aberto` |
| `GET /api/plataforma/interesses?estado=` | equipe | — | `200 [Interesse]` | `400 estado_invalido` |
| `PATCH /api/plataforma/interesses/{id}` | equipe | `{estado: "em_conversa"\|"descartado", motivo?}` | `200 Interesse` | `400 estado_invalido`, `400 campo_obrigatorio`, `400 campo_longo`, `404` |
| `GET /api/plataforma/cnpj/{cnpj}` | equipe | — | `200 ConsultaCnpj` | `400 cnpj_invalido`, `404 cnpj_nao_encontrado`, `503 consulta_indisponivel` |
| `POST /api/plataforma/lojas` | equipe | `{cnpj, nome, endereco, latitude?, longitude?, telefone, email_responsavel, interesse_id?}` | `201 {loja: LojaPlataforma, convite: Convite}` | `400 cnpj_invalido`, `400 cnpj_inativo`, `400 cnpj_nao_encontrado`, `400 email_invalido`, `400 campo_obrigatorio`, `400 campo_longo`, `400 coordenadas_*`, `400 estado_invalido`, `404` (interesse), `409 cnpj_ja_cadastrado` |
| `GET /api/plataforma/lojas` | equipe | — | `200 [LojaPlataforma]` | — |
| `POST /api/plataforma/lojas/{id}/convite` | equipe | — | `201 Convite` (o anterior deixa de valer) | `404`, `409 loja_ja_ativa`, `409 sem_convite` |
| `GET /api/convites/{codigo}` | logado | — | `200 {loja: {nome, endereco}, email, expira_em}` | `404`, `409 convite_usado`, `410 convite_vencido` |
| `POST /api/convites/{codigo}/aceitar` | logado | — | `201 {vinculo}` | `403 email_diferente`, `404`, `409 convite_usado`, `409 ja_vinculado`, `410 convite_vencido` |

Regras e detalhes (decisões de 17/11/2026 marcadas com ★):
- **CNPJ:** só dígitos (a máscara é da tela; o backend tira pontos, barra e traço). Dígitos
  verificadores conferidos **antes** de consultar a Receita (`400 cnpj_invalido`). A consulta
  à BrasilAPI é feita **pelo backend**, com limite de 5 s.
- **Criação da loja:** CNPJ inativo → `400 cnpj_inativo`. ★ CNPJ que a Receita não conhece →
  `400 cnpj_nao_encontrado` (bloqueia). Receita fora do ar ou lenta → a loja é criada com
  `cnpj_verificado: false`. Loja, convite e interesse → `virou_loja` gravados **juntos** (tudo
  ou nada). Padrões da loja: janela 4 h, margem 1 dia, antecedência 10 dias.
- ★ `latitude` e `longitude` **opcionais** na criação; se vierem, mesma validação da L14
  (`coordenadas_incompletas`, `coordenadas_invalidas`). O responsável acerta depois na L14.
- ★ `interesse_id` que não está em aberto (já virou loja ou foi descartado) → `400 estado_invalido`.
- ★ **PATCH do interesse:** só `novo → em_conversa` e `novo`/`em_conversa → descartado`. Outra
  mudança → `400 estado_invalido`. Descartar exige `motivo` (`400 campo_obrigatorio`).
- **Interesse:** no máximo um em aberto por pessoa (`409 interesse_em_aberto`). Depois de
  descartado ou de virar loja, a pessoa pode pedir de novo.
- **Convite:** código aleatório longo, uso único, vale **7 dias**, no máximo um pendente por
  loja. Gerar outro invalida o anterior. ★ O convite substituído responde como vencido
  (`410 convite_vencido`). Loja que já tem responsável → `409 loja_ja_ativa`.
- **Aceite:** exige login com **o mesmo e-mail** do convite, sem diferenciar maiúsculas
  (`403 email_diferente`, que traz `email_convite` mascarado, ex.: `"m…@example.com"`).
  O vínculo `responsavel` e o "convite usado" são gravados juntos, com trava: dois aceites
  ao mesmo tempo → um vínculo só.
- O **link** é montado pelo frontend: `${origem do app}/convite/${codigo}`.
- Loja sem responsável não quebra nada: não tem oferta, não aparece na vitrine.

```jsonc
// Interesse
{ "id": 3, "nome_mercado": "Mercearia São Jorge", "cidade": "São José do Rio Preto",
  "telefone": "17999990000", "mensagem": "", "estado": "novo",   // novo | em_conversa | virou_loja | descartado
  "pessoa": { "nome": "Marcos Lima", "email": "marcos@example.com" },
  "motivo_descarte": null, "loja_id": null, "criado_em": "2026-11-18T10:00:00-03:00" }

// ConsultaCnpj (vinda da BrasilAPI, normalizada pelo backend)
{ "cnpj": "12345678000190", "razao_social": "...", "nome_fantasia": "...",
  "situacao": "ATIVA", "ativa": true,
  "cnae_principal": { "codigo": "4712100", "descricao": "Comércio varejista ... minimercados ..." },
  "alimentar": true,   // CNAE principal nos grupos 47.1 ou 47.2; só informativo
  "endereco": { "logradouro": "...", "numero": "...", "bairro": "...", "municipio": "...", "uf": "SP", "cep": "..." } }

// LojaPlataforma
{ "id": 4, "nome": "Mercearia São Jorge", "cnpj": "12345678000190", "cnpj_verificado": true,
  "endereco": "...", "telefone": "...", "criada_em": "2026-11-18T10:00:00-03:00",
  "responsavel": null,                                   // ou { "nome", "email" }
  "convite": { "email": "marcos@example.com", "expira_em": "...", "estado": "pendente" } }  // pendente | vencido | aceito | null

// Convite
{ "codigo": "q8Zt3...", "email": "marcos@example.com", "expira_em": "2026-11-25T10:00:00-03:00" }
```
