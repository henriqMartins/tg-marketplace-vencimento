"""
Grupo J do contrato (Pedido, etapa 15): o consumidor confirma várias reservas de uma
loja com um código só; vê, lista e cancela os próprios pedidos. Formatos em
docs/api/contrato.md, seção J.

As rotas só leem o pedido, chamam o serviço e respondem; as regras ficam no domínio
(cada item) e em servico_pedidos.py (o pedido).
"""
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from config.erros import erro

from . import apresentacao, servico_pedidos
from .api_consumidor import _expirar_vencidas_do_consumidor
from .models import Oferta, Pedido
from .servico_pedidos import ErroPedido, estado_do_pedido

STATUS_DO_ERRO = {"nada_ativo": 409, "ja_encerrado": 409, "nao_encontrado": 404}


def _json(pedido) -> dict:
    return apresentacao.pedido_consumidor(pedido, estado_do_pedido(pedido))


def _recusa(e: ErroPedido):
    return erro(STATUS_DO_ERRO.get(e.codigo, 400), str(e), e.codigo, **e.extras)


class Pedidos(APIView):
    """POST /api/pedidos {loja_id, itens} -> 201 Pedido; GET /api/pedidos?estado=."""

    def post(self, request):
        loja_id, itens = request.data.get("loja_id"), request.data.get("itens")
        if type(loja_id) is not int:
            return erro(400, "Uma das ofertas não é desta loja.", "oferta_de_outra_loja")
        try:
            pedido, resultados = servico_pedidos.confirmar(request.user, loja_id, itens)
        except ErroPedido as e:
            return _recusa(e)
        ofertas = Oferta.objects.select_related("produto").in_bulk([o for o, *_ in resultados])
        if pedido is None:                       # nada sobrou: sem código, recusas gravadas
            corpo = apresentacao.pedido_consumidor(None, "encerrado", resultados, ofertas)
            return erro(409, "Esgotou tudo agora há pouco.", "tudo_esgotado",
                        itens=corpo["itens"])
        corpo = apresentacao.pedido_consumidor(pedido, estado_do_pedido(pedido),
                                               resultados, ofertas)
        return Response(corpo, status=201)

    def get(self, request):
        estado = request.query_params.get("estado") or None
        if estado not in (None, "ativo", "encerrado"):
            return erro(400, "Use estado=ativo ou estado=encerrado.", "parametro_invalido")
        _expirar_vencidas_do_consumidor(request.user, timezone.now())
        pedidos = (Pedido.objects.filter(cliente=request.user).select_related("loja")
                   .prefetch_related("itens"))
        com_estado = [(p, estado_do_pedido(p)) for p in pedidos]
        ativos = sorted((p for p, e in com_estado if e == "ativo"),
                        key=lambda p: min(r.expira_em for r in p.itens.all()
                                          if r.estado == "reservada"))
        outros = sorted((p for p, e in com_estado if e != "ativo"),
                        key=lambda p: max(r.encerrada_em for r in p.itens.all()), reverse=True)
        lista = ativos if estado == "ativo" else outros if estado == "encerrado" else ativos + outros
        return Response([_json(p) for p in lista])


class VerPedido(APIView):
    """GET /api/pedidos/{id} — o próprio; de outra pessoa = 404."""

    def get(self, request, pedido_id):
        _expirar_vencidas_do_consumidor(request.user, timezone.now())
        pedido = servico_pedidos.pedido_do_cliente(request.user, pedido_id)
        if pedido is None:
            return erro(404, "Pedido não encontrado.", "nao_encontrado")
        return Response(_json(pedido))


class CancelarPedido(APIView):
    """POST /api/pedidos/{id}/cancelar — todos os itens ativos."""

    def post(self, request, pedido_id):
        pedido = servico_pedidos.pedido_do_cliente(request.user, pedido_id)
        if pedido is None:
            return erro(404, "Pedido não encontrado.", "nao_encontrado")
        try:
            servico_pedidos.cancelar_pedido(pedido)
        except ErroPedido as e:
            return _recusa(e)
        return Response(_json(pedido))


class CancelarItem(APIView):
    """POST /api/pedidos/{id}/itens/{reservaId}/cancelar — só um item."""

    def post(self, request, pedido_id, reserva_id):
        pedido = servico_pedidos.pedido_do_cliente(request.user, pedido_id)
        if pedido is None:
            return erro(404, "Pedido não encontrado.", "nao_encontrado")
        try:
            servico_pedidos.cancelar_item(pedido, reserva_id)
        except ErroPedido as e:
            return _recusa(e)
        return Response(_json(pedido))
