"""
Contas de DATA da publicação e do aviso. Funções puras: não leem banco nem relógio
(quem chama passa as datas), então os testes rodam sem banco.

Decisões aplicadas (CLAUDE.md):
  - fim da oferta = 23:59 do dia (validade − margem efetiva), horário de Brasília;
  - aviso aparece `antecedencia` dias antes da referência do grupo;
  - adiar: no máximo até a VÉSPERA do último dia da oferta.
"""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

BRASILIA = ZoneInfo("America/Sao_Paulo")
FIM_DO_DIA = time(23, 59)
UM_DIA = timedelta(days=1)


def ultimo_dia(validade: date, margem: timedelta) -> date:
    """O último dia em que a oferta fica no ar. A margem é em dias inteiros."""
    return validade - timedelta(days=margem.days)


# 📖 ESTUDAR: três datas que nascem da validade. Ex.: validade 05/11, margem 1 dia
# → último dia 04/11 → fim 04/11 23:59 → adiar no máximo até 03/11.
def fim_da_oferta(validade: date, margem: timedelta) -> datetime:
    """23:59 do último dia, com o fuso de Brasília (o banco guarda em UTC)."""
    return datetime.combine(ultimo_dia(validade, margem), FIM_DO_DIA, tzinfo=BRASILIA)


def dia_do_aviso(referencia: date, antecedencia_dias: int) -> date:
    return referencia - timedelta(days=antecedencia_dias)


def adiar_ate_max(validade: date, margem: timedelta) -> date:
    return ultimo_dia(validade, margem) - UM_DIA
