from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import connection
from . import servico


@api_view(["POST"])
def reservar(request, oferta_id):
    r = servico.reservar(oferta_id, int(request.data.get("pedido", 1)))
    if r is None:
        return Response({"erro": "sem estoque livre"}, status=409)
    return Response({"numero": r.id, "quantidade": r.quantidade, "parcial": r.parcial}, status=201)


@api_view(["GET"])
def health(request):
    with connection.cursor() as c:
        c.execute("select 1")
    return Response({"ok": True})
