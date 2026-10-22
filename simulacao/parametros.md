# Parâmetros da simulação v0

> **Status: aprovada pela dupla em 14/10/2026; revisada em 15/10/2026** (lote, validade
> restante na publicação e tamanho do pedido), com base em fontes levantadas.
> Cada parâmetro declara sua **base**: fonte, quando há; estimativa dos autores, quando não.
> Nenhum entra como número único, e sim como **faixa**. A conclusão do artigo deve valer
> para a faixa inteira ("em toda a faixa testada, ..."). Unidade de tempo: **horas**.

## 1. Parâmetro de controle (o que o lojista decide)

| Parâmetro | Valores varridos | Por quê |
|---|---|---|
| Janela de reserva | 0,5 · 1 · 2 · 4 · 8 · 12 · 24 h | Vai de "precisa vir agora" a "pode vir amanhã". É o eixo X do gráfico principal . |

## 2. Parâmetros do cenário (o que o lojista não controla)

| Parâmetro | Faixa | Distribuição | Base |
|---|---|---|---|
| Tamanho do lote (unidades separadas no alerta) | 5 a 60 | inteiro uniforme | Escala de referência: embalagens comerciais de produtos do escopo têm de 6 a 54 unidades (arroz 6, leite 12, doce 30, sardinha 54; fichas comerciais MARTINS ATACADO, PRO BIANN, PORTÃO DE CAMBUÍ, MEGA BOX ATACADISTA). O lote representa a sobra separada, não a caixa inteira. |
| Validade restante na publicação (= duração da oferta) | 24 a 720 h (1 a 30 dias) | uniforme | A oferta encerra automaticamente na validade, descontada a margem de segurança (decisão 36). Rebaixas em laticínios de 1 a 8 dias antes do vencimento (AKKAS, 2024); mercearia básica entra em demarcação 30 dias antes no GPA (SA+, 2023). |
| Razão procura/oferta | 0,3 a 3,0 | uniforme | Faixa ampla **por desenho**: a procura de uma plataforma ainda inexistente não é conhecida; cobre excesso e falta de oferta. |
| Tamanho do pedido | 1 a 8 unidades | 1 (35%), 2 (25%), 3 (15%), 4 (10%), 5 (6%), 6 (4%), 7 (3%), 8 (2%) | Estimativa dos autores: maioria leva 1 ou 2; cauda até 8 cobre compra de estoque (ex.: 6 litros de leite UHT). Teste com pedidos até 12 mostrou o mesmo formato e a mesma janela de menor perda. |
| Fração que não aparece | 10% a 40% | uniforme por cenário | Estimativa dos autores: não foi encontrada medição comparável (por pedido) em retirada na loja. Faixa larga, coberta pela sensibilidade. |
| Fração que cancela | 0% a 15% | uniforme por cenário | Estimativa dos autores: não foi encontrada medição. |
| Tempo que o cliente precisa para chegar | mediana 2 h, de 15 min a 12 h | lognormal truncada | Limite inferior: deslocamento médio de 13 min em viagens não motorizadas (METRÔ, 2019). Limite superior: retirada no mesmo dia da compra (FOOD TO SAVE, [s.d.]). Mediana: estimativa dos autores, testada em 1, 2 e 4 h (seção 2.1). |
| Momento do cancelamento | dentro da janela | uniforme | Simplificação. |

**Como a taxa de chegada sai da razão procura/oferta:**
`chegadas_por_hora = razão × lote ÷ (pedido_médio × duração_da_oferta)`.
Assim a procura fica sempre proporcional ao lote e os cenários são comparáveis.

### 2.1 Sensibilidade ao tempo que o cliente precisa para chegar

O resultado principal depende muito deste parâmetro (é ele que faz a reserva expirar
por atraso), e a mediana de 2 h é assumida. Por isso o experimento inteiro é
repetido com outras medianas, mantendo todo o resto igual.

| Parâmetro | Valores testados | O que fica igual | Por quê |
|---|---|---|---|
| Mediana do tempo para chegar | 1 · 2 · 4 h | Desvio da lognormal, corte em 15 min–12 h, demais parâmetros, semente 2026 (mesmos cenários e compradores) | Cobre do cliente que "passa logo" ao que "só vem depois do trabalho". Se a forma das curvas se mantém nas três, a conclusão não depende do valor exato. |

Observação: o corte em 15 min–12 h desloca a mediana efetiva. Medido em 20.000
sorteios: 1,1 h, 2,0 h e 3,4 h, respectivamente. O corte em 12 h pesa mais para a
mediana de 4 h.

### 2.2 Taxa de descarte sem plataforma (referência): varrida, não estimada

| Parâmetro | Tratamento | Por quê |
|---|---|---|
| Taxa de descarte sem plataforma = unidades descartadas ÷ unidades no momento do alerta | **Não estimada.** Varrida de 0% a 100% (de 1 em 1 ponto) e lida como **limiar** | Não há dado observado nem declarado para ela. Em vez de assumir um valor, o resultado responde: "acima de qual taxa de descarte a plataforma perde menos?". Quem tiver a taxa real de uma loja lê a resposta no gráfico. |

- Cálculo feito por `limiar_referencia.py` **sobre os resultados já gerados**
  (`resultados/rodadas.csv`); o modelo não muda.
- Numa rodada, a plataforma vence quando `perda ÷ lote < taxa de referência`.
  Empate não conta.
- **Premissa da comparação:** lote separado = unidades no momento do alerta (o
  lojista separa tudo o que tem daquele produto). Se ele separar só uma parte,
  as duas taxas deixam de ter a mesma base.
- Saídas: limiar médio por janela (= perda média), limiar mediano (taxa acima da
  qual a plataforma vence em pelo menos metade das rodadas) e a fração de rodadas
  vencidas para cada taxa de 0% a 100%.

## 3. Regras de comportamento (v0)

- Cada comprador chega (Poisson), faz um pedido e chama `Oferta.reservar`.
- Recebeu `None` → **comprador bloqueado (total)**. Recebeu reserva parcial →
  **bloqueado (parcial)**. Na v0 ninguém tenta de novo.
- Do que reservou, sorteia o destino: não aparece, cancela ou tenta retirar.
- Quem tenta retirar chega após o "tempo que precisa para chegar". Se isso for
  depois de `expira_em`, a reserva já expirou → conta como **expirada por atraso**
  (diferente de não aparecer).
- No fim da oferta: `encerrar` → perda.

## 4. Saídas por rodada

Perda (unidades e % do lote) · unidades retiradas · compradores bloqueados (total e
parcial) · taxa de retirada · taxa de expiração (separando não comparecimento de
atraso) · taxa de cancelamento.

## 5. Execução

| Item | Valor |
|---|---|
| Semente | 2026 (fixa) |
| Repetições por janela | começar com 1.000; definir N final pelo **gráfico de convergência** |
| Teste degenerado | razão 1,0, pedido sempre 1, ninguém falta nem cancela, tempo de chegada fixo menor que a janela, chegadas em intervalos fixos → perda deve ser 0 e todas as unidades retiradas (conferir com conta à mão) |

## 6. Simplificações declaradas (vão para Limitações no artigo)

- Tempo contínuo, sem horário de funcionamento da loja.
- Comprador bloqueado não tenta de novo.
- Sem venda no balcão do lote separado (decisão 16).
- Resultados em **unidades**; valor em R$ e fração absorvida pelo fornecedor (H3) ficam para a v1.
- Cenário de referência "sem plataforma" não é simulado: a taxa de descarte sem
  plataforma é varrida como limiar (seção 2.2), não estimada. A comparação supõe
  lote separado = unidades no momento do alerta.

## 7. Fontes citadas nas bases

- AKKAS, Arzum. *Food surplus management in retailing: a global perspective*. [S.l.]: ECR Retail Loss, 2024, seção 2.5.2.
- COMPANHIA DO METROPOLITANO DE SÃO PAULO. *Meio-dia se consolida como o maior pico em São Paulo, aponta Pesquisa Origem Destino do Metrô*. São Paulo: Metrô, 3 jul. 2019.
- FOOD TO SAVE. *Termo de uso*. [S.l.], [s.d.], seção "Os Produtos e a Retirada".
- REPORTAGEM SA+ CONTEÚDO. *GPA diminui em 20% suas quebras*. SA+, 6 dez. 2023.
- Fichas comerciais (escala de embalagens): MARTINS ATACADO (Arroz Célia 6x5 kg); PRO BIANN (Leite UHT Piracanjuba 1 L, pack 12); PORTÃO DE CAMBUÍ (Cocada c/ chocolate, caixa 30); MEGA BOX ATACADISTA (Sardinha Coqueiro 125 g, embalagem 54).
- Links e trechos exatos: no levantamento do agente de pesquisa (15/10/2026). Ler a fonte original antes de citar no artigo.
