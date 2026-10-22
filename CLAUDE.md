# TG — Marketplace de produtos próximos ao vencimento

Contexto para o Claude Code. Responda sempre em **português brasileiro**.

## O projeto em uma frase

Mercadinhos de bairro publicam lotes de produtos perto do vencimento com desconto;
o consumidor **reserva** pelo celular (PWA), **retira e paga na loja** com um código
que o lojista digita; o gestor acompanha **indicadores de negócio** em painéis.
Sem integração com sistema de caixa (PDV) nem com estoque: a informação nasce no
cadastro do lote.

Trabalho de Graduação (Fatec Rio Preto) de Henrique e Yan.
- **09/11/2026** — versão para a banca: o artigo descreve o sistema **tela por tela**
  (capturas de tela), então as telas precisam existir e rodar até lá.
- **17/11 a 02/12/2026** — apresentação ao vivo: o sistema precisa estar no ar.

## Como o Henrique quer trabalhar

- Explicar o **porquê** antes de propor; linguagem simples e analogias.
- Em escolha técnica: trade-offs + recomendação explícita. **A decisão é dele e do Yan.**
- **Antes de escrever código, mostrar o plano** (arquivos que vai criar/alterar e por quê)
  e esperar o ok. Passos pequenos, um de cada vez.
- Não escrever à frente do estado real: nada tratado como pronto se não existir e
  não tiver rodado. Ao terminar um passo, dizer o que foi verificado e como.
- Decisão nova que surgir: **não decidir sozinho**. Listar como pergunta. As decisões
  oficiais ficam no Contexto mestre (fora do repositório); avisar o Henrique para registrar.

### Modo aprendizado (vale em toda sessão)

O Henrique quer **entender o que está construindo**, não só receber pronto: ele vai
defender o sistema na banca e precisa saber explicar cada parte. O prazo é curto,
então o aprendizado tem de ser **focado**, não lento.

**Ao explicar:**
- Ordem: **problema → ideia (com analogia do dia a dia) → como fica no código → como
  verificar**. Um conceito novo por vez; definir o termo técnico na primeira vez que aparece.
- Ligar ao projeto: dizer qual regra deste arquivo (ou do domínio) aquilo protege e
  o que quebraria sem ela. Exemplo concreto com valores do próprio TG (oferta, livre,
  reserva) em vez de exemplo genérico.
- Depois de cada passo, um bloco curto de **Insight** (2–3 pontos) sobre o que foi feito
  e por quê; quando útil, uma pergunta de fixação ("o que acontece se...?").
- Apontar o que vale a pena o Henrique ser capaz de **explicar na banca**.

**Partes de desenvolvimento manual:**
- Em cada passo que tiver lógica relevante, deixar **um** trecho para o Henrique
  escrever (5–15 linhas), marcado no código com `TODO(human)`, e parar esperando.
  Explicar: contexto, o que o trecho deve fazer, restrições e as dicas/trade-offs —
  sem entregar a resposta.
- Priorizar como trecho manual o que é **núcleo do TG**: regras do domínio, a transação
  com `select_for_update()`, cálculo dos indicadores, Haversine, lógica da fita colorida,
  e os testes que provam essas regras.
- **Não** passar como manual código repetitivo ou de configuração (settings, Dockerfile,
  boilerplate do DRF, CSS): esse o Claude escreve e só explica o essencial.
- Depois que o Henrique escrever: rodar os testes, revisar com sinceridade (apontar erro
  ou caso esquecido, explicando o porquê) e só então seguir.
- Se o Henrique disser "faz você" ou "sem parte manual" num passo, respeitar naquele
  passo (prazo manda); voltar ao modo aprendizado no seguinte.

## Estrutura do repositório

```
/
├── CLAUDE.md
├── docker-compose.yml        # SÓ desenvolvimento local
├── .env.example              # variáveis necessárias, sem valores reais
├── dominio/                  # regras da reserva — Python puro, pacote instalável
├── backend/                  # API Django + DRF (vira a imagem Docker)
├── frontend/                 # React PWA (Vercel)
├── simulacao/                # Monte Carlo + limiar + parâmetros + resultados/
└── spikes/spike_django/      # prova dos 3 critérios (referência, não é produção)
```

Neste PC, no Windows, o Python é chamado por `py` (não `python`).

## Regras de arquitetura (não quebrar)

1. **Regras em um lugar só.** `dominio/` é a única implementação da reserva.
   `backend/` e `simulacao/` **importam** esse pacote. Nunca reimplementar regra de
   reserva em outro lugar — é isso que permite afirmar no artigo que "a simulação
   executa a mesma lógica do sistema". Nunca copiar o arquivo para dentro do backend.
2. **O domínio não conhece banco, HTTP, tela nem relógio.** Toda operação recebe
   `agora` em horas (float). No backend: `agora = timestamp_unix / 3600`.
3. **Mudou uma regra do domínio?** Primeiro o teste, depois o código. Todos os
   testes do domínio e da simulação continuam passando.
4. **Concorrência é do backend:** cada operação de escrita numa oferta abre
   transação, trava a linha com `select_for_update()`, reconstitui a `Oferta` do
   domínio a partir do banco, chama a regra, grava e confirma. A view nunca mexe em
   estoque direto.
5. **PostgreSQL é a fonte oficial**, inclusive da expiração (coluna `expira_em`).
   **Nunca usar SQLite**, nem em teste: no SQLite o `select_for_update()` não trava
   nada e o teste de concorrência passaria sem provar coisa alguma.
6. **Expiração sem worker separado:**
   - antes de reservar/cancelar/retirar/ajustar → o domínio expira as vencidas daquela oferta;
   - na vitrine → o "livre" mostrado considera vencidas ainda não processadas;
   - ao abrir os painéis → varredura geral antes de calcular os indicadores;
   - reforço: o agendamento diário da Vercel chama um endpoint protegido por token,
     que varre reservas vencidas e encerra ofertas que passaram do fim (sobra = perda).
   A varredura precisa ser idempotente (rodar duas vezes não devolve em dobro).
7. **Configuração só por variável de ambiente** (`DATABASE_URL`, `DJANGO_SECRET_KEY`,
   etc.). Nenhuma senha, chave ou URL de produção no código ou no git.

## Regras do domínio (decisões fechadas — não alterar sem o Henrique)

- Lote separado antes de publicar; `livre` nasce igual a `separado`.
- Reserva por quantidade; parcial automática `min(pedido, livre)`; livre = 0 → recusa.
- Estados da reserva: `reservada → retirada | expirada | cancelada`.
- Janela de reserva **configurável pelo lojista**; nunca passa do fim da oferta.
- Cancelamento e expiração devolvem ao livre **exatamente uma vez**.
- Retirada tudo ou nada, com código; pagamento presencial.
- Ajuste do lojista só reduz o livre, com motivo; unidade reservada não é ajustada.
- Fim da oferta: automático na validade menos uma margem configurável; sobra livre vira **perda**.
- Invariante: `separado = livre + reservado + retirado + ajustado + perda`.
- Fora do protótipo (limitação declarada): perda de unidade já reservada.

### Código de retirada
6 dígitos aleatórios (`secrets`), estilo MFA. O **lojista digita** o código na tela
dele; o backend localiza a reserva ativa **daquela loja** com esse código. O código
precisa ser único entre as reservas ativas da mesma loja.

### Fitas coloridas (método de conferência — tem de existir nas telas até 09/11)
- 6 cores fixas, uma por **bimestre de vencimento** (data absoluta, não tempo
  restante), ciclo anual, válidas para qualquer produto.
- Lote novo do mesmo produto e mesma cor de um grupo ativo → entra nesse grupo; a
  referência do grupo passa a ser a **data mais próxima**.
- **Aviso de colisão de ciclo:** lote remanescente da mesma cor do ano anterior ainda ativo.
- A fita acelera a conferência, mas não é condição: o aviso sempre mostra a data exata.

### Avisos e notificações
- Aviso de estoque/validade: **só para o lojista**, com antecedência configurada pela loja.
- Consumidor: notificação **apenas na publicação de oferta**, e só se ele permitiu.

### Proximidade
- Loja: coordenadas obtidas no cadastro do endereço.
- Consumidor: localização do navegador; se negar, CEP. **Nada disso é gravado**:
  converte em coordenada, ordena por distância, descarta.
- Distância por **Haversine em SQL**. Sem PostGIS, sem mapa, sem rotas.

### Painéis (indicadores de NEGÓCIO, lidos direto do PostgreSQL)
Reservas criadas, taxa de retirada, taxa de expiração, compradores bloqueados
(recusa total ou parcial) e perda no encerramento, por período.

## Stack

| Camada | Escolha |
|---|---|
| Domínio | Python puro (biblioteca padrão), pacote `dominio` |
| Backend | Django + Django REST Framework, gunicorn, psycopg |
| Banco | PostgreSQL |
| Frontend | React, PWA |
| Simulação | Python + NumPy + Matplotlib |
| Local | Docker Compose (Postgres + API com recarga automática) |

## Hospedagem (plano gratuito)

| Serviço | O quê | Observações |
|---|---|---|
| Vercel | Frontend + agendamento diário | Cron do plano Hobby: 1×/dia, horário impreciso |
| Render | API (imagem Docker de `backend/Dockerfile`) | Dorme após ~15 min; ~1 min para acordar. Sem pré-deploy no free: o comando de início roda `migrate` e depois `gunicorn`. Porta vem de `$PORT`. Sem acesso a shell. |
| Neon | PostgreSQL | Usar o endereço **direto** (sem pooler), com `sslmode=require`. Mesma região da API (EUA Leste). |

O frontend deve mostrar "carregando" enquanto a API acorda, em vez de travar.

### Dockerfile de produção (`backend/Dockerfile`)
Multi-stage; usuário não-root; `requirements.txt` copiado antes do código (cache);
contexto de build = raiz do repositório (precisa de `dominio/` e `backend/`);
endpoint `/health`; `.dockerignore` excluindo frontend, simulação, resultados,
`.env` e arquivos de teste. O `docker-compose.yml` é só local e não vira produção.

## Fora de escopo — NÃO propor nem adicionar

- Redis, cache, filas, Celery, worker separado.
- Observabilidade: Prometheus, Grafana, Loki, logs ou métricas técnicas como entrega.
- CI/CD, GitHub Actions, publicação automática a cada push.
- PostGIS, mapa, rotas, geofencing.
- Integração com PDV, importação de planilha, pagamento online, entrega, WhatsApp.

## Escolhas ainda em aberto — perguntar antes de implementar

- Login do consumidor (e-mail e senha? outro meio?) e tipo de token da API
  (recomendação até aqui: token do próprio DRF).
- Ferramenta do frontend: Vite + React (recomendação: o Django já é o servidor, não
  há necessidade de Next.js) e se usa TypeScript.
- Serviço de push para a notificação de oferta nova.
- Serviço que converte CEP/endereço em coordenada.
- Valor padrão da margem de segurança do fim da oferta (sugestão registrada: 1 dia).

## Testes e verificação

- Pré-requisito (uma vez): `py -m pip install -r simulacao/requirements.txt`
  (instala o `dominio/` em modo editável + NumPy e Matplotlib).
- Domínio: `py -m unittest discover -s tests -v` dentro de `dominio/`.
- Simulação e limiar: `py -m unittest -v` dentro de `simulacao/`.
- Nenhum teste existente pode quebrar.
- Backend: testes Django contra PostgreSQL (o do docker-compose).
- Teste obrigatório do backend: N requisições simultâneas pela última unidade →
  exatamente 1 sucesso; livre nunca negativo; conservação fechando (o spike em
  `spikes/spike_django/spike_concorrencia.py` mostra como).

## Simulação (já existe — não alterar sem pedido)

- Parâmetros e faixas: `simulacao/parametros.md`. Não inventar valor; cada parâmetro
  tem procedência (observado, declarado ou assumido) e entra como **faixa**.
- Nunca chamar a simulação de "previsão": ela gera **cenário projetado**.
- Nenhum número novo de simulação vai para o artigo antes de rodar e passar na verificação.
