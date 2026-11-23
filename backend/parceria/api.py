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
from ofertas.models import Loja, Papel

from . import servico
from .models import Convite, EstadoConvite, EstadoInteresse, Interesse


def interesse_json(i: Interesse) -> dict:
    return {
        "id": i.id, "nome_mercado": i.nome_mercado, "cidade": i.cidade,
        "telefone": i.telefone, "mensagem": i.mensagem, "estado": i.estado,
        "pessoa": {"nome": i.pessoa.nome, "email": i.pessoa.email},
        "motivo_descarte": i.motivo_descarte, "loja_id": i.loja_id,
        "criado_em": quando(i.criado_em),
    }


def convite_json(c: Convite) -> dict:
    return {"codigo": c.codigo, "email": c.email, "expira_em": quando(c.expira_em)}


def loja_plataforma_json(loja: Loja) -> dict:
    """LojaPlataforma do contrato: a loja como a equipe vê (P2)."""
    responsavel = next((v.usuario for v in loja.vinculos.all()
                        if v.papel == Papel.RESPONSAVEL), None)
    convite = max(loja.convites.all(), key=lambda c: (c.criado_em, c.id), default=None)
    if convite is None:
        estado_convite = None
    elif convite.estado == EstadoConvite.ACEITO:
        estado_convite = "aceito"
    else:
        estado_convite = "vencido" if convite.vencido() else "pendente"
    return {
        "id": loja.id, "nome": loja.nome, "cnpj": loja.cnpj,
        "cnpj_verificado": loja.cnpj_verificado, "endereco": loja.endereco,
        "telefone": loja.telefone, "criada_em": quando(loja.criada_em),
        "responsavel": ({"nome": responsavel.nome, "email": responsavel.email}
                        if responsavel else None),
        # Pedido 6 do front (aceito 23/11/2026): "Copiar link" de novo na P2. O código é a
        # chave do convite: só sai enquanto pendente, e esta rota já é só da equipe.
        "convite": ({"email": convite.email, "expira_em": quando(convite.expira_em),
                     "estado": estado_convite,
                     "codigo": convite.codigo if estado_convite == "pendente" else None}
                    if convite else None),
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


class ConsultaCnpj(RotaDaEquipe):
    """GET /api/plataforma/cnpj/{cnpj} -> 200 ConsultaCnpj (Receita pela BrasilAPI)."""

    def get(self, request, cnpj):
        try:
            return Response(servico.consultar_cnpj(cnpj))
        except servico.ErroParceria as e:
            return recusa(e)


class LojasDaPlataforma(RotaDaEquipe):
    """GET -> [LojaPlataforma]; POST -> 201 {loja, convite}."""

    def get(self, request):
        lojas = (Loja.objects.order_by("-criada_em", "-id")
                 .prefetch_related("vinculos__usuario", "convites"))
        return Response([loja_plataforma_json(loja) for loja in lojas])

    def post(self, request):
        try:
            loja, convite = servico.cadastrar_loja(request.data)
        except servico.ErroParceria as e:
            return recusa(e)
        return Response({"loja": loja_plataforma_json(loja), "convite": convite_json(convite)},
                        status=201)


class ConviteDaLoja(RotaDaEquipe):
    """POST /api/plataforma/lojas/{id}/convite -> 201 Convite (o anterior deixa de valer)."""

    def post(self, request, loja_id):
        try:
            convite = servico.renovar_convite(loja_id)
        except servico.ErroParceria as e:
            return recusa(e)
        return Response(convite_json(convite), status=201)


class VerConvite(APIView):
    """GET /api/convites/{codigo} (logado) -> 200 {loja: {nome, endereco}, email, expira_em}."""

    def get(self, request, codigo):
        try:
            convite = servico.ver_convite(codigo)
        except servico.ErroParceria as e:
            return recusa(e)
        return Response({"loja": {"nome": convite.loja.nome, "endereco": convite.loja.endereco},
                         "email": convite.email, "expira_em": quando(convite.expira_em)})


class AceitarConvite(APIView):
    """POST /api/convites/{codigo}/aceitar (logado) -> 201 {vinculo}."""

    def post(self, request, codigo):
        try:
            vinculo = servico.aceitar_convite(request.user, codigo)
        except servico.ErroParceria as e:
            return recusa(e)
        # Mesmo formato de um item de Eu.vinculos: a tela vai direto para a L14 da loja.
        return Response({"vinculo": {"loja": {"id": vinculo.loja.id, "nome": vinculo.loja.nome},
                                     "papel": vinculo.papel}}, status=201)
