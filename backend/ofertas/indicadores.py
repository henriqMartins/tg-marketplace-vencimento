"""
Indicadores de NEGÓCIO do painel (etapa 11, telas G1 e G3), lidos direto do PostgreSQL.

Nada aqui é estimado: tudo é CONTADO a partir do que já está gravado (reservas,
recusas, ofertas). As definições são as decididas em 04/11/2026, e a de
"compradores bloqueados" é a MESMA do simulacao.py (bloq_total + bloq_parcial):
o painel mede no sistema real o que a simulação projeta.

Período (decidido 13/11/2026): cada número usa a data do PRÓPRIO evento.
  - reservas criadas, parciais e recusas -> quando aconteceram (criada_em);
  - encerradas, taxas e semanas          -> quando terminaram (encerrada_em);
  - perda                                -> o fim da oferta (ela só encerra no fim).
As datas `de` e `ate` são dias de Brasília, os dois incluídos.

Quem chama faz a varredura ANTES (regra 6): senão uma reserva vencida e ainda
não processada contaria como "em andamento" e sumiria da taxa de expiração.
"""
from datetime import date, datetime, time, timedelta

from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncWeek
from django.utils import timezone

import dominio

from .calendario import BRASILIA
from .models import Oferta, Recusa, Reserva

RESERVADA = dominio.EstadoReserva.RESERVADA.value
RETIRADA = dominio.EstadoReserva.RETIRADA.value
EXPIRADA = dominio.EstadoReserva.EXPIRADA.value
CANCELADA = dominio.EstadoReserva.CANCELADA.value
ENCERRADA = dominio.EstadoOferta.ENCERRADA.value
ESTADOS_DO_HISTORICO = (RESERVADA, RETIRADA, EXPIRADA, CANCELADA, "recusa")


def _intervalo(de: date, ate: date):
    """[00:00 de `de`, 00:00 do dia seguinte a `ate`) em Brasília: os dois dias inteiros."""
    return (datetime.combine(de, time.min, tzinfo=BRASILIA),
            datetime.combine(ate + timedelta(days=1), time.min, tzinfo=BRASILIA))


def _no_periodo(campo: str, de: date, ate: date) -> Q:
    inicio, fim = _intervalo(de, ate)
    return Q(**{f"{campo}__gte": inicio, f"{campo}__lt": fim})


def _taxa(parte: int, total: int):
    """parte ÷ total com 3 casas; sem reserva encerrada não há o que medir: None (não 0)."""
    return round(parte / total, 3) if total else None


def _segunda(d: date) -> date:
    return d - timedelta(days=d.weekday())


# 📖 ESTUDAR: as contas do painel. Cada indicador é UMA consulta com COUNT/SUM
# filtrado — o banco conta, o Python só monta a resposta. Repare que cada um
# filtra o período por um campo diferente (a data do próprio evento).
def calcular(loja_id: int, de: date, ate: date) -> dict:
    reservas = Reserva.objects.filter(loja_id=loja_id)

    # Reservas CRIADAS no período; dessas, as parciais (levou menos do que pediu).
    criadas = reservas.filter(_no_periodo("criada_em", de, ate)).aggregate(
        total=Count("id"), parciais=Count("id", filter=Q(quantidade__lt=F("pedido"))))
    recusas = Recusa.objects.filter(_no_periodo("criada_em", de, ate),
                                    oferta__produto__loja_id=loja_id).count()

    # Reservas ENCERRADAS no período, por estado. As em andamento não têm
    # encerrada_em, então ficam de fora sozinhas (decisão de 04/11/2026).
    encerradas = reservas.filter(_no_periodo("encerrada_em", de, ate)).aggregate(
        retiradas=Count("id", filter=Q(estado=RETIRADA)),
        expiradas=Count("id", filter=Q(estado=EXPIRADA)),
        canceladas=Count("id", filter=Q(estado=CANCELADA)))
    total = encerradas["retiradas"] + encerradas["expiradas"] + encerradas["canceladas"]

    # Perda: a sobra livre das ofertas que ENCERRARAM no período.
    perda = Oferta.objects.filter(_no_periodo("fim", de, ate), produto__loja_id=loja_id,
                                  estado=ENCERRADA).aggregate(s=Sum("perda"))["s"] or 0

    return {
        "de": de.isoformat(), "ate": ate.isoformat(),
        "reservas_criadas": criadas["total"],
        "encerradas": {"total": total, **encerradas},
        "taxa_retirada": _taxa(encerradas["retiradas"], total),
        "taxa_expiracao": _taxa(encerradas["expiradas"], total),
        "bloqueados": {"total": recusas + criadas["parciais"], "recusas": recusas,
                       "parciais": criadas["parciais"]},
        "perda_unidades": perda,
        "semanas": _semanas(reservas, de, ate),
    }


def _semanas(reservas, de: date, ate: date) -> list:
    """
    O gráfico de barras: encerradas por semana (segunda a domingo, Brasília).
    Toda semana do período aparece, mesmo vazia (zeros), para o gráfico não ter buraco.
    """
    linhas = (reservas.filter(_no_periodo("encerrada_em", de, ate))
              .annotate(semana=TruncWeek("encerrada_em", tzinfo=BRASILIA))
              .values("semana", "estado").annotate(n=Count("id")))
    contagem = {}
    for linha in linhas:
        segunda = timezone.localtime(linha["semana"], BRASILIA).date()
        contagem[(segunda, linha["estado"])] = linha["n"]

    semanas, segunda = [], _segunda(de)
    while segunda <= ate:
        semanas.append({"inicio": segunda.isoformat(),
                        "retiradas": contagem.get((segunda, RETIRADA), 0),
                        "expiradas": contagem.get((segunda, EXPIRADA), 0),
                        "canceladas": contagem.get((segunda, CANCELADA), 0)})
        segunda += timedelta(days=7)
    return semanas


def historico(loja_id: int, de: date, ate: date, estado=None, q: str = "") -> dict:
    """
    G3: reservas e recusas CRIADAS no período, da mais recente para a mais antiga.
    Os totais do cabeçalho são do período inteiro; `estado` e `q` filtram só a lista.
    Devolve (totais, reservas, recusas) já filtrados; a rota formata cada item.
    """
    reservas = (Reserva.objects.filter(_no_periodo("criada_em", de, ate), loja_id=loja_id)
                .select_related("oferta__produto", "consumidor"))
    recusas = (Recusa.objects.filter(_no_periodo("criada_em", de, ate),
                                     oferta__produto__loja_id=loja_id)
               .select_related("oferta__produto", "consumidor"))
    totais = {"total_reservas": reservas.count(), "total_recusas": recusas.count()}

    if estado == "recusa":
        reservas = reservas.none()
    elif estado:
        reservas, recusas = reservas.filter(estado=estado), recusas.none()
    if q:
        # "Produto ou final do código". A recusa não tem código: só o produto.
        reservas = reservas.filter(Q(oferta__produto__nome__icontains=q) | Q(codigo__endswith=q))
        recusas = recusas.filter(oferta__produto__nome__icontains=q)
    return totais, list(reservas), list(recusas)
