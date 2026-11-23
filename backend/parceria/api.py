"""
Grupo I do contrato (Parceria): rotas do dono (interesse, convite) e da equipe da
plataforma (/api/plataforma/...). Formatos em docs/api/contrato.md, seção I.

As rotas só leem o pedido, chamam o serviço e montam a resposta; as regras ficam em
servico.py.
"""
from rest_framework.response import Response
from rest_framework.views import APIView

from config.erros import erro
from contas.permissoes import EhEquipe
from ofertas.apresentacao import quando

from . import servico
from .models import EstadoInteresse, Interesse


def interesse_json(i: Interesse) -> dict:
    return {
        "id": i.id, "nome_mercado": i.nome_mercado, "cidade": i.cidade,
        "telefone": i.telefone, "mensagem": i.mensagem, "estado": i.estado,
        "pessoa": {"nome": i.pessoa.nome, "email": i.pessoa.email},
        "motivo_descarte": i.motivo_descarte, "loja_id": i.loja_id,
        "criado_em": quando(i.criado_em),
    }


def recusa(e: servico.ErroParceria):
    return erro(e.status, str(e), e.codigo, **e.extras)


class Interesses(APIView):
    """POST /api/interesses (logado) -> 201 Interesse."""

    def post(self, request):
        try:
            interesse = servico.pedir_parceria(request.user, request.data)
        except servico.ErroParceria as e:
            return recusa(e)
        return Response(interesse_json(interesse), status=201)


class RotaDaEquipe(APIView):
    """Porteiro de todas as rotas /api/plataforma/...: só a equipe (is_staff)."""
    permission_classes = [EhEquipe]


class InteressesDaPlataforma(RotaDaEquipe):
    """GET /api/plataforma/interesses?estado= -> 200 [Interesse] (mais recentes primeiro)."""

    def get(self, request):
        pedidos = Interesse.objects.select_related("pessoa").order_by("-criado_em", "-id")
        estado = request.query_params.get("estado")
        if estado:
            if estado not in EstadoInteresse.values:
                return erro(400, "Estado desconhecido.", "estado_invalido")
            pedidos = pedidos.filter(estado=estado)
        return Response([interesse_json(i) for i in pedidos])


class InteresseDaPlataforma(RotaDaEquipe):
    """PATCH /api/plataforma/interesses/{id} {estado, motivo?} -> 200 Interesse."""

    def patch(self, request, interesse_id):
        try:
            interesse = servico.mudar_estado(interesse_id, request.data)
        except servico.ErroParceria as e:
            return recusa(e)
        return Response(interesse_json(interesse))
