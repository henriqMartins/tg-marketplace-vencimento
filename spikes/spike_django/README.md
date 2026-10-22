# Spike — Django + DRF + PostgreSQL (20/10/2026)

Descartável. Serve só para provar os 3 critérios antes de fechar o framework.
Usa o pacote `dominio` (pasta `dominio/` na raiz, instalado com
`py -m pip install -e dominio`) sem cópia nem reimplementação.

| Arquivo | O que prova |
|---|---|
| `reservas/servico.py` | trava a oferta (`select_for_update`), reconstitui o domínio, chama a regra, grava |
| `spike_concorrencia.py` | critério 1 — N clientes disputando a última unidade via HTTP |
| `spike_expiracao.py` | critério 2 — TTL curto volta ao livre pelo worker; idempotência; checagem preguiçosa |
| `reservas/migrations/` | critério 3 — 0001 e 0002, aplicadas, revertidas e reaplicadas |

Resultado (Postgres 16, gunicorn 4 workers × 4 threads, 20 clientes simultâneos, 5 rodadas):
- Com lock: 1×201 e 19×409 em todas; livre = 0; conservação ok.
- Sem lock (`SPIKE_SEM_LOCK=1`, controle negativo): até 12 clientes receberam 201 pela mesma
  unidade, houve 500, e numa rodada a conservação quebrou (2 reservas para 1 unidade).
