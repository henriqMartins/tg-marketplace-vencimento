"""
Camada fina entre o banco e o domínio. Regra de negócio NENHUMA mora aqui:
carrega a oferta travada, reconstitui o objeto do domínio, chama a regra,
grava o resultado. O lock (select_for_update) é o que torna isso seguro
com duas pessoas ao mesmo tempo.
"""
import os
import secrets
from datetime import datetime, timezone

from django.db import transaction

import dominio
from . import models

USAR_LOCK = os.environ.get("SPIKE_SEM_LOCK") != "1"   # só para o controle negativo


def horas(dt: datetime) -> float:
    return dt.timestamp() / 3600.0          # o domínio mede tempo em horas


def data(h: float) -> datetime:
    return datetime.fromtimestamp(h * 3600.0, tz=timezone.utc)


def codigo_seguro(_id: int) -> str:
    return f"{secrets.randbelow(10**6):06d}"   # 6 dígitos, estilo MFA


def _carregar(row: models.Oferta) -> dominio.Oferta:
    of = dominio.Oferta(row.separado, horas(row.fim), row.janela.total_seconds() / 3600,
                        inicio=horas(row.inicio), gerador_codigo=codigo_seguro)
    of.livre, of.retirado, of.ajustado, of.perda = row.livre, row.retirado, row.ajustado, row.perda
    of.estado = dominio.EstadoOferta(row.estado)
    ativas = row.reservas.filter(estado="reservada")
    for r in ativas:
        of.reservas[r.numero] = dominio.Reserva(
            id=r.numero, quantidade=r.quantidade, pedido=r.pedido, codigo=r.codigo,
            criada_em=horas(r.criada_em), expira_em=horas(r.expira_em))
    ultimo = row.reservas.order_by("-numero").values_list("numero", flat=True).first() or 0
    of._proximo_id = ultimo + 1          # ver pendência: Oferta.reconstituir()
    of.verificar_invariantes()
    return of


def _salvar(row: models.Oferta, of: dominio.Oferta) -> None:
    row.livre, row.retirado, row.ajustado, row.perda = of.livre, of.retirado, of.ajustado, of.perda
    row.estado = of.estado.value
    row.save()
    for r in of.reservas.values():
        models.Reserva.objects.update_or_create(
            oferta=row, numero=r.id,
            defaults=dict(quantidade=r.quantidade, pedido=r.pedido, codigo=r.codigo,
                          criada_em=data(r.criada_em), expira_em=data(r.expira_em),
                          estado=r.estado.value))


def _travar(oferta_id):
    qs = models.Oferta.objects
    return (qs.select_for_update() if USAR_LOCK else qs).get(pk=oferta_id)


def reservar(oferta_id: int, pedido: int):
    agora = horas(datetime.now(timezone.utc))
    with transaction.atomic():
        row = _travar(oferta_id)
        of = _carregar(row)
        r = of.reservar(pedido, agora)      # None = recusa (livre = 0)
        _salvar(row, of)
        return r


def expirar_vencidas(lote: int = 100) -> int:
    """Job: devolve ao livre o que venceu. skip_locked = não espera requisição em andamento."""
    agora_dt = datetime.now(timezone.utc)
    ids = (models.Reserva.objects.filter(estado="reservada", expira_em__lte=agora_dt)
           .values_list("oferta_id", flat=True).distinct()[:lote])
    total = 0
    for oid in list(ids):
        with transaction.atomic():
            row = models.Oferta.objects.select_for_update(skip_locked=True).filter(pk=oid).first()
            if row is None:
                continue                      # alguém está mexendo; pega na próxima volta
            of = _carregar(row)
            total += len(of.expirar_vencidas(horas(agora_dt)))
            _salvar(row, of)
    return total
