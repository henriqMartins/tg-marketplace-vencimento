"""
Grupo B do contrato (Consumidor): vitrine, detalhe, reservar, minhas reservas,
ver e cancelar a própria reserva.

As rotas só recebem o pedido, chamam o serviço e devolvem no formato do contrato.
Nenhuma regra de reserva mora aqui (regra 1); a view nunca mexe em estoque (regra 4).
"""
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

import dominio
from config.erros import erro
from dominio import ErroDominio

from . import apresentacao, consultas, servico
from .models import Categoria, Oferta, Reserva

ATIVA = dominio.EstadoReserva.RESERVADA.value
FAIXAS_DE_DESCONTO = {"ate30", "30a50", "50mais"}


def _numero(texto):
    """Converte o texto do endereço em número; None se não veio; ValueError se veio errado."""
    return None if texto in (None, "") else float(texto)


def _expirar_vencidas_do_consumidor(usuario, agora):
    """
    Regra 6 na leitura: antes de mostrar reservas, expira de verdade as que já
    venceram. Assim a tela nunca recebe "reservada" numa reserva vencida.
    """
    ofertas = (Reserva.objects.filter(consumidor=usuario, estado=ATIVA, expira_em__lte=agora)
               .values_list("oferta_id", flat=True).distinct())
    for oferta_id in list(ofertas):
        servico.expirar(oferta_id, agora=agora)


def _reserva_do_consumidor(usuario, reserva_id):
    """A reserva, se for DESTA pessoa; senão None (a rota responde 404, não 403)."""
    return (Reserva.objects.select_related("oferta__produto__loja")
            .filter(pk=reserva_id, consumidor=usuario).first())


class Vitrine(APIView):
    """GET /api/ofertas — pública. Filtros: lat, lng, categoria, faixa_desconto, q."""
    permission_classes = [AllowAny]

    def get(self, request):
        p = request.query_params
        try:
            lat, lng = _numero(p.get("lat")), _numero(p.get("lng"))
        except ValueError:
            return erro(400, "Localização inválida.", "parametro_invalido")
        categoria = p.get("categoria") or None
        if categoria and categoria not in Categoria.values:
            return erro(400, "Categoria inválida.", "parametro_invalido")
        faixa = p.get("faixa_desconto") or None
        if faixa and faixa not in FAIXAS_DE_DESCONTO:
            return erro(400, "Faixa de desconto inválida.", "parametro_invalido")

        agora = timezone.now()
        ofertas = consultas.vitrine(agora, lat=lat, lng=lng, categoria=categoria,
                                    faixa_desconto=faixa, q=p.get("q") or None)
        return Response([
            apresentacao.oferta_vitrine(o, o.livre_vitrine, getattr(o, "distancia", None),
                                        servico.retirar_ate(o, agora))
            for o in ofertas])


class DetalheOferta(APIView):
    """GET /api/ofertas/{id} — pública. Encerrada vem com livre 0 e "estado": "encerrada"."""
    permission_classes = [AllowAny]

    def get(self, request, oferta_id):
        agora = timezone.now()
        oferta = consultas.com_numeros_da_vitrine(
            Oferta.objects.filter(pk=oferta_id), agora).first()
        if oferta is None:
            return erro(404, "Oferta não encontrada.", "nao_encontrada")
        # Passou do fim e a ronda ainda não fechou: para a tela, já está encerrada.
        encerrada = (oferta.estado == dominio.EstadoOferta.ENCERRADA.value
                     or oferta.fim <= agora)
        livre = 0 if encerrada else oferta.livre_vitrine
        prazo = None if encerrada else servico.retirar_ate(oferta, agora)
        corpo = apresentacao.oferta_vitrine(oferta, livre, retirar_ate=prazo)
        corpo["estado"] = "encerrada" if encerrada else "ativa"
        return Response(corpo)


class Reservar(APIView):
    """POST /api/ofertas/{id}/reservas {pedido} — exige login."""

    def post(self, request, oferta_id):
        pedido = request.data.get("pedido")
        if type(pedido) is not int or pedido < 1:          # bool e texto também ficam de fora
            return erro(400, "Escolha pelo menos 1 unidade.", "pedido_invalido")
        oferta = Oferta.objects.filter(pk=oferta_id).first()
        if oferta is None:
            return erro(404, "Oferta não encontrada.", "nao_encontrada")
        try:
            reserva = servico.reservar(oferta.id, request.user, pedido)
        except ErroDominio:
            # Depois das conferências acima, o domínio só recusa por oferta encerrada/no fim.
            return erro(409, "Esta oferta já terminou.", "oferta_encerrada")

        if reserva is None:                                # recusa total: gravada em Recusa
            return Response({"status": "recusada", "pedido": pedido,
                             "erro": "Esgotou agora há pouco", "codigo": "esgotada"},
                            status=409)
        reserva = _reserva_do_consumidor(request.user, reserva.id)
        status = "parcial" if reserva.quantidade < reserva.pedido else "confirmada"
        return Response({"status": status, "reserva": apresentacao.reserva_consumidor(reserva)},
                        status=201)


class MinhasReservas(APIView):
    """GET /api/minhas-reservas?estado=ativa|encerrada — só as da própria pessoa."""

    def get(self, request):
        estado = request.query_params.get("estado") or None
        if estado not in (None, "ativa", "encerrada"):
            return erro(400, "Use estado=ativa ou estado=encerrada.", "parametro_invalido")
        _expirar_vencidas_do_consumidor(request.user, timezone.now())

        minhas = Reserva.objects.select_related("oferta__produto__loja").filter(
            consumidor=request.user)
        ativas = minhas.filter(estado=ATIVA).order_by("expira_em")
        encerradas = minhas.exclude(estado=ATIVA).order_by("-encerrada_em")
        if estado == "ativa":
            lista = list(ativas)
        elif estado == "encerrada":
            lista = list(encerradas)
        else:
            lista = list(ativas) + list(encerradas)
        return Response([apresentacao.reserva_consumidor(r) for r in lista])


class VerReserva(APIView):
    """GET /api/reservas/{id} — a própria; de outra pessoa = 404."""

    def get(self, request, reserva_id):
        _expirar_vencidas_do_consumidor(request.user, timezone.now())
        reserva = _reserva_do_consumidor(request.user, reserva_id)
        if reserva is None:
            return erro(404, "Reserva não encontrada.", "nao_encontrada")
        return Response(apresentacao.reserva_consumidor(reserva))


class CancelarReserva(APIView):
    """POST /api/reservas/{id}/cancelar — a própria; já encerrada = 409 nao_ativa."""

    def post(self, request, reserva_id):
        reserva = _reserva_do_consumidor(request.user, reserva_id)
        if reserva is None:
            return erro(404, "Reserva não encontrada.", "nao_encontrada")
        try:
            servico.cancelar(reserva.id)
        except ErroDominio:
            return erro(409, "Esta reserva não está mais ativa.", "nao_ativa")
        reserva = _reserva_do_consumidor(request.user, reserva_id)
        return Response(apresentacao.reserva_consumidor(reserva))
