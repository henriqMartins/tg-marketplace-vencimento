# Entrada de mercados por parceria

Versão 1 (18/11/2026). Decidido por Henrique e Yan: a entrada de um mercado é por
**parceria fechada**, não por autocadastro aberto. Ninguém cria loja com `insert` no banco
nem pelo `/admin`: a equipe da plataforma cadastra a loja **numa tela do app** e o dono
**aceita um convite**.

Este arquivo é a fonte da regra até ela ser incorporada em `docs/api/contrato.md` (grupo I,
dono: backend) e em `docs/frontend/especificacao-telas.md` (telas A4, A6, A7, P1–P3).

## 1. O processo de ponta a ponta

| # | Etapa | Quem | Onde |
|---|---|---|---|
| 1 | **Interesse.** Na A4, "Tenho um mercado" → formulário curto (A6) | Dono | App |
| 2 | **Conversa e visita.** A equipe explica o método e confere se cabe: produtos embalados, espaço para separar o lote, quem conta na gôndola | Equipe da plataforma | Fora do app |
| 3 | **Acordo.** Termo de parceria com as regras; entrega do kit de fitas (6 cores) | Os dois | Fora do app |
| 4 | **Cadastro da loja.** A equipe abre o interessado e "Cadastrar loja" (P3). O CNPJ é conferido na Receita (BrasilAPI) | Equipe | App (P3) |
| 5 | **Convite.** O sistema gera um link de uso único (7 dias). A equipe copia e manda por WhatsApp | Sistema + equipe | App gera; WhatsApp entrega |
| 6 | **Aceite.** O dono abre o link, entra ou cria conta **com o e-mail convidado** e aceita (A7). Vira Responsável | Dono | App (A7) |
| 7 | **Primeiros passos.** Janela, margem e antecedência (L14), equipe, primeiro lote com fita | Dono | App |
| 8 | **No ar.** A loja aparece na vitrine quando publica a primeira oferta | Automático | — |

Por que o convite vai por link copiado e não por e-mail: o Render gratuito bloqueia as
portas de envio de e-mail (25, 465, 587) e o sistema não tem serviço de e-mail.

## 2. Telas (celular e computador)

É o mesmo app (PWA) nos dois. Cada tela abaixo diz como fica em cada largura.

### A4 · Escolher como entrar (muda)
- **Aparece sempre depois de entrar**, para todo mundo, inclusive sem vínculo e no
  computador. Só é pulada com "Lembrar minha escolha neste aparelho" ou com `?voltar=`.
  Substitui as regras 3 e 4 de `frontend/src/app/destino.ts`.
- Blocos, nesta ordem:
  1. **Comprar com desconto** → C2;
  2. **Minhas lojas** (só se houver vínculo) → como hoje;
  3. **Equipe da plataforma** (só se `eu.plataforma`) → P1;
  4. **Tenho um mercado** → A6. Se já existe interesse em aberto, o cartão vira
     "Pedido de parceria recebido · entraremos em contato" (selo `pending`) e leva a A6 em modo leitura.
- Celular: tela cheia, como hoje. Computador: coluna central de 560 px.

### A6 · Quero ser parceiro
- Título "Seu mercado na plataforma"; texto curto: "A entrada é por parceria: nossa equipe
  entra em contato, visita a loja e, com o acordo feito, envia um convite para você ativar a loja no app".
- Campos: Nome do mercado, Cidade, Telefone (WhatsApp), Mensagem (opcional).
- Botão "Enviar pedido". Sucesso: "Recebemos seu pedido" e o que acontece depois (etapas 2–6 resumidas).
- Com interesse em aberto: mostra os dados enviados e o estado, sem formulário.
- Celular: tela cheia. Computador: coluna de 560 px.

### A7 · Convite para ativar a loja (`/convite/:codigo`)
- Sem login: guarda o destino e manda para A2/A3 (`?voltar=/convite/:codigo`).
- Logado: "Convite para ser responsável" · nome da loja · endereço · "Convite para **email**" ·
  "vale até dd/mm".
- Botão "Aceitar e ativar a loja" → vira responsável → L14 da loja (para conferir as regras).
- Erros, em caixa `danger` com o que fazer:
  - `403 email_diferente`: "Este convite é para outro e-mail. Entre com a conta de **e…@…**";
  - `410 convite_vencido`: "Este convite venceu. Peça um novo à equipe da plataforma";
  - `409 convite_usado`: "Este convite já foi usado";
  - `404`: "Convite não encontrado".
- O dono costuma abrir pelo WhatsApp, então o celular é o caso principal; no computador, coluna de 560 px.

### P1 · Plataforma · Interessados
- Só `eu.plataforma`. **Computador primeiro**: layout com menu lateral (como o do gestor) com
  "Interessados" e "Lojas". No celular, o mesmo conteúdo em lista empilhada.
- Abas por estado: Novos · Em conversa · Viraram loja · Descartados.
- Linha: mercado, cidade, telefone, nome e e-mail de quem pediu, data.
- Ações: "Marcar em conversa", "Descartar" (pede motivo curto), "Cadastrar loja" → P3 preenchida.

### P2 · Plataforma · Lojas
- Tabela: loja, CNPJ (selo `warn` "não verificado" quando a consulta falhou), responsável ou
  "Convite pendente · vence dd/mm" / "Convite vencido", data de cadastro.
- Ações na loja com convite: "Copiar link do convite" e "Gerar novo convite" (o antigo deixa de valer).
- Botão "+ Cadastrar loja" → P3 vazia.

### P3 · Plataforma · Cadastrar loja
- Passo 1, **CNPJ**: campo com máscara → "Consultar". Mostra razão social, nome fantasia,
  situação (selo `success` Ativa / `danger` Inativa), atividade principal e endereço.
  - Inativa: bloqueia o cadastro ("A Receita mostra este CNPJ como **situação**").
  - Atividade fora do varejo de alimentos: só alerta `warn`.
  - Consulta fora do ar (`503`): aviso `warn` "Não deu para consultar a Receita agora; preencha à mão" e segue.
- Passo 2, **dados da loja**: Nome de exibição (padrão: nome fantasia), Endereço (padrão: o da
  Receita) com a mesma localização da L14 ("✓ Localização encontrada"), Telefone,
  **E-mail do responsável** (a conta que vai aceitar).
- Botão "Cadastrar loja e gerar convite" → resultado: ✓ "Loja cadastrada", o link do convite em
  texto selecionável, botão "Copiar link", validade e a mensagem pronta para o WhatsApp:
  "Olá! Sua loja **nome** está pronta na plataforma. Para ativar, abra: **link** (vale até dd/mm). Entre ou crie a conta com **e-mail**."
- Computador primeiro (formulário de 560 px dentro do layout da plataforma); funciona no celular.

## 3. Contrato da API — grupo I · Parceria (📝 combinado)

Convenções do contrato valem aqui. "Equipe" = conta com `is_staff` (sem tabela nova);
fora dela, rotas `/api/plataforma/...` → `403`.

**`Eu` ganha dois campos:**
```jsonc
{ "...": "...", "plataforma": false,
  "interesse": { "id": 3, "estado": "novo", "criado_em": "2026-11-18T10:00:00-03:00" } }  // ou null
```

| Método e rota | Quem | Entrada | Saída | Erros |
|---|---|---|---|---|
| `POST /api/interesses` | logado | `{nome_mercado, cidade, telefone, mensagem?}` | `201 Interesse` | `400 campo_obrigatorio`, `409 interesse_em_aberto` |
| `GET /api/plataforma/interesses?estado=` | equipe | — | `200 [Interesse]` | — |
| `PATCH /api/plataforma/interesses/{id}` | equipe | `{estado: "em_conversa"\|"descartado", motivo?}` | `200 Interesse` | `400 estado_invalido` |
| `GET /api/plataforma/cnpj/{cnpj}` | equipe | — | `200 ConsultaCnpj` | `400 cnpj_invalido`, `404 cnpj_nao_encontrado`, `503 consulta_indisponivel` |
| `POST /api/plataforma/lojas` | equipe | `{cnpj, nome, endereco, latitude, longitude, telefone, email_responsavel, interesse_id?}` | `201 {loja: LojaPlataforma, convite: Convite}` | `400 cnpj_invalido`, `400 cnpj_inativo`, `400 email_invalido`, `409 cnpj_ja_cadastrado` |
| `GET /api/plataforma/lojas` | equipe | — | `200 [LojaPlataforma]` | — |
| `POST /api/plataforma/lojas/{id}/convite` | equipe | — | `201 Convite` (o anterior deixa de valer) | `409 loja_ja_ativa` |
| `GET /api/convites/{codigo}` | logado | — | `200 {loja: {nome, endereco}, email, expira_em}` | `404`, `409 convite_usado`, `410 convite_vencido` |
| `POST /api/convites/{codigo}/aceitar` | logado | — | `201 {vinculo}` | `403 email_diferente`, `404`, `409 convite_usado`, `409 ja_vinculado`, `410 convite_vencido` |

```jsonc
// Interesse
{ "id": 3, "nome_mercado": "Mercearia São Jorge", "cidade": "São José do Rio Preto",
  "telefone": "17999990000", "mensagem": "", "estado": "novo",   // novo | em_conversa | virou_loja | descartado
  "pessoa": { "nome": "Marcos Lima", "email": "marcos@example.com" },
  "motivo_descarte": null, "loja_id": null, "criado_em": "..." }

// ConsultaCnpj (vinda da BrasilAPI, normalizada pelo backend)
{ "cnpj": "12345678000190", "razao_social": "...", "nome_fantasia": "...",
  "situacao": "ATIVA", "ativa": true,
  "cnae_principal": { "codigo": "4712100", "descricao": "Comércio varejista ... minimercados ..." },
  "alimentar": true,
  "endereco": { "logradouro": "...", "numero": "...", "bairro": "...", "municipio": "...", "uf": "SP", "cep": "..." } }

// LojaPlataforma
{ "id": 4, "nome": "Mercearia São Jorge", "cnpj": "12345678000190", "cnpj_verificado": true,
  "endereco": "...", "telefone": "...", "criada_em": "...",
  "responsavel": null,                                   // ou { "nome", "email" }
  "convite": { "email": "marcos@example.com", "expira_em": "...", "estado": "pendente" } }  // pendente | vencido | aceito | null

// Convite
{ "codigo": "q8Zt3...", "email": "marcos@example.com", "expira_em": "2026-11-25T10:00:00-03:00" }
```
O **link** é montado pelo frontend: `${origem do app}/convite/${codigo}`.

## 4. Regras (backend)

- **CNPJ:** só dígitos; dígitos verificadores conferidos no backend (`400 cnpj_invalido`) antes
  de chamar a BrasilAPI (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`). A consulta é feita
  **pelo backend**, não pelo navegador, para a checagem valer.
  - `ativa = situacao == "ATIVA"`. Inativa → `400 cnpj_inativo` na criação.
  - `alimentar` = CNAE principal no varejo de alimentos (grupos 47.1 e 47.2). Só informativo.
  - BrasilAPI fora do ar ou lenta (> 5 s): a criação segue com `cnpj_verificado = false`.
  - `Loja.cnpj` único (nulo permitido para as lojas antigas da demonstração).
- **Criação da loja:** numa transação só: Loja (padrões: janela 4 h, margem 1 dia,
  antecedência 10 dias) + Convite + interesse → `virou_loja` (quando veio de um).
- **Convite:** código aleatório longo (`secrets.token_urlsafe(16)` ou maior), uso único,
  vale 7 dias, no máximo um pendente por loja (gerar outro invalida o anterior). Aceite exige
  login **com o mesmo e-mail** (sem diferenciar maiúsculas) e cria o vínculo `responsavel`
  na mesma transação que marca o convite como usado (com trava, como na reserva).
- **Interesse:** um em aberto (`novo` ou `em_conversa`) por pessoa.
- **Equipe da plataforma:** `is_staff`. Criada do PC contra o banco
  (`manage.py createsuperuser`) ou pelo `popular_demo`. Nunca pela API.
- Loja sem responsável não quebra nada: não tem oferta, não aparece na vitrine.

## 5. Dados de demonstração (`popular_demo`)

- `equipe@example.com` (`is_staff`), senha `demo1234`.
- `marcos@example.com` (consumidor) com um interesse `novo`: "Mercearia São Jorge".
- Assim o vídeo mostra a cena completa: Marcos pede → equipe cadastra (P3) → copia o link →
  Marcos aceita (A7) → vira responsável. Para não depender da BrasilAPI na gravação, usar um
  CNPJ real e ativo de exemplo ou aceitar o modo "não verificado".

## 6. Testes mínimos

- Backend: rotas da plataforma com `403` para quem não é equipe; CNPJ com dígito errado;
  BrasilAPI **simulada** nos testes (sem rede): ativa, inativa, não encontrada, fora do ar;
  CNPJ repetido; aceite com e-mail certo, e-mail diferente, vencido, usado, renovado (o antigo
  falha); dois aceites ao mesmo tempo → um só vínculo; `Eu` com `plataforma` e `interesse`.
- Frontend: A4 aparece sempre (sem vínculo, com vínculo, no computador), e "Lembrar" pula;
  cartão "Tenho um mercado" nos dois estados; A7 nos 5 resultados; P3 com Receita ativa,
  inativa e fora do ar; link copiado igual ao `codigo` recebido.

## 7. Fora deste escopo

Envio de e-mail; envio de documentos (o Render gratuito apaga arquivos a cada reinício);
conferir se quem pede é sócio do CNPJ (declarado como limitação; a equipe confirma na visita);
plano, cobrança e dados bancários (não há pagamento online).
