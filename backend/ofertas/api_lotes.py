"""
Grupo D do contrato (Lote, fita e aviso): produtos, registro de lote, grupos de
fita, avisos (ver, adiar, descartar) e publicação da oferta (telas L2–L8, G5).

Todas exigem vínculo com a loja do endereço (EhDaLoja). A rota confere o FORMATO
da entrada (é texto? é inteiro? é data?); as regras ficam no serviço e no domínio.
"""
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from django.db.models import OuterRef, Subquery
from django.utils import timezone
from rest_framework.response import Response

from config.erros import erro

from . import apresentacao, consultas, servico, servico_lotes
from .api_loja import RotaDaLoja
from .fita import CORES
from .models import ABERTAS, Categoria, Grupo, Loja, MotivoDescarte, Oferta, Produto
from .servico_lotes import ErroOperacao, eh_aviso, situacao_exibida

URGENTE_DIAS = 7                                  # aviso "urgente": vence em até 7 dias
DESCONTOS = {20, 30, 40, 50}
JANELAS_HORAS = {1, 2, 4, 8, 12, 24}
MARGEM_MAXIMA_DIAS = 7
SITUACOES = {"aguardando", "conferir", "adiado", "em_oferta", "encerrado"}

# Recusa do serviço -> (status HTTP, código que a tela recebe).
ERROS_DO_SERVICO = {
    "nao_e_aviso": (404, "nao_encontrado"),       # outra pessoa publicou/descartou antes
    "data_invalida": (400, "data_invalida"),
    "apos_limite": (400, "apos_limite"),
    "acima_do_recebido": (400, "acima_do_recebido"),
    "preco_invalido": (400, "preco_invalido"),
    "fim_ja_passou": (409, "fim_ja_passou"),
}


def _do_servico(e: ErroOperacao):
    status, codigo = ERROS_DO_SERVICO[e.codigo]
    return erro(status, str(e), codigo, **e.dados)


# ---------------------------------------------------------------- leitura da entrada

def _inteiro(valor):
    """Inteiro de verdade (True/False e "3" ficam de fora); senão None."""
    return valor if type(valor) is int else None


def _data(valor):
    """Data "AAAA-MM-DD"; senão None."""
    if not isinstance(valor, str):
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        return None


def _dinheiro(valor):
    """Valor positivo com no máximo 2 casas, como texto ("6.99") ou número; senão None."""
    if type(valor) not in (str, int, float):
        return None
    try:
        d = Decimal(str(valor))
    except InvalidOperation:
        return None
    if not d.is_finite() or d <= 0 or d != d.quantize(Decimal("0.01")) or d >= Decimal("1e8"):
        return None
    return d.quantize(Decimal("0.01"))


def _ultimo_preco():
    """Subconsulta: preço normal da oferta mais recente do produto (preço sugerido)."""
    return Subquery(Oferta.objects.filter(produto=OuterRef("pk"))
                    .order_by("-inicio", "-id").values("preco_original")[:1])


def _grupos_da_loja(loja_id):
    return (Grupo.objects.filter(produto__loja_id=loja_id)
            .select_related("produto__loja", "oferta").prefetch_related("lotes")
            .order_by("referencia", "id"))


def _aviso(loja_id, grupo_id, hoje):
    """O grupo, se for desta loja E estiver em aviso; senão None (404)."""
    g = _grupos_da_loja(loja_id).filter(pk=grupo_id).first()
    return g if g is not None and eh_aviso(g, hoje) else None


def _grupo_json(g, hoje, com_lotes=True):
    return apresentacao.grupo(g, situacao_exibida(g, hoje), com_lotes=com_lotes)


def _nao_e_aviso():
    return erro(404, "Aviso não encontrado.", "nao_encontrado")


# ---------------------------------------------------------------- produtos

class Produtos(RotaDaLoja):
    """GET /api/lojas/{lojaId}/produtos?q= · POST {nome, categoria, margem_fim_dias}."""

    def get(self, request, loja_id):
        produtos = (Produto.objects.filter(loja_id=loja_id).select_related("loja")
                    .annotate(ultimo_preco=_ultimo_preco()).order_by("nome", "id"))
        q = (request.query_params.get("q") or "").strip()
        if q:
            produtos = produtos.filter(nome__icontains=q)
        return Response([apresentacao.produto_loja(p, p.ultimo_preco) for p in produtos])

    def post(self, request, loja_id):
        nome = request.data.get("nome")
        categoria = request.data.get("categoria")
        margem = request.data.get("margem_fim_dias")
        if not isinstance(nome, str) or not nome.strip():
            return erro(400, "Informe o nome do produto.", "sem_nome")
        if len(nome.strip()) > 120:
            return erro(400, "O nome pode ter até 120 letras.", "nome_longo")
        if categoria not in Categoria.values:
            return erro(400, "Categoria inválida.", "categoria_invalida")
        if margem is not None and (_inteiro(margem) is None
                                   or not 0 <= margem <= MARGEM_MAXIMA_DIAS):
            return erro(400, "A margem vai de 0 a 7 dias (ou vazia, para usar a da loja).",
                        "margem_invalida")
        produto = Produto.objects.create(
            loja_id=loja_id, nome=nome.strip(), categoria=categoria,
            margem_fim=timedelta(days=margem) if margem is not None else None)
        produto = Produto.objects.select_related("loja").get(pk=produto.pk)
        return Response(apresentacao.produto_loja(produto), status=201)


# ---------------------------------------------------------------- lotes e grupos

class RegistrarLote(RotaDaLoja):
    """POST /api/lojas/{lojaId}/lotes {produto, validade, quantidade} (L3)."""

    def post(self, request, loja_id):
        hoje = timezone.localdate()
        produto_id = _inteiro(request.data.get("produto"))
        validade = _data(request.data.get("validade"))
        quantidade = _inteiro(request.data.get("quantidade"))
        if validade is None:
            return erro(400, "Validade inválida (use AAAA-MM-DD).", "validade_invalida")
        if validade < hoje:
            return erro(400, "Este lote já venceu.", "validade_passada")
        if quantidade is None or quantidade < 1:
            return erro(400, "Informe pelo menos 1 unidade.", "quantidade_invalida")
        if produto_id is None or not Produto.objects.filter(pk=produto_id, loja_id=loja_id).exists():
            return erro(404, "Produto não encontrado.", "nao_encontrado")

        lote, grupo, resultado, colisao = servico_lotes.registrar_lote(
            produto_id, validade, quantidade, request.user)
        grupo = _grupos_da_loja(loja_id).get(pk=grupo.pk)
        return Response({
            "lote": apresentacao.lote(lote),
            "grupo": _grupo_json(grupo, hoje),
            "resultado": resultado,
            "colisao": {"validade": colisao.isoformat()} if colisao else None,
        }, status=201)


class Grupos(RotaDaLoja):
    """GET /api/lojas/{lojaId}/grupos?cor=&situacao=&com_lotes=1 (L4, G5)."""

    def get(self, request, loja_id):
        p = request.query_params
        cor, situacao = p.get("cor") or None, p.get("situacao") or None
        if cor and cor not in CORES:
            return erro(400, "Cor inválida.", "parametro_invalido")
        if situacao and situacao not in SITUACOES:
            return erro(400, "Situação inválida.", "parametro_invalido")
        agora = timezone.now()
        servico.varrer(agora, loja_id=loja_id)     # oferta que acabou -> grupo "encerrado"
        hoje = timezone.localdate(agora)
        grupos = _grupos_da_loja(loja_id)
        if cor:
            grupos = grupos.filter(cor=cor)
        lista = [(g, situacao_exibida(g, hoje)) for g in grupos]
        if situacao:
            lista = [(g, s) for g, s in lista if s == situacao]
        com_lotes = p.get("com_lotes") == "1"
        return Response([apresentacao.grupo(g, s, com_lotes=com_lotes) for g, s in lista])


# ---------------------------------------------------------------- avisos

class Avisos(RotaDaLoja):
    """GET /api/lojas/{lojaId}/avisos (L5): grupos em "conferir" ou "adiado", o mais próximo antes."""

    def get(self, request, loja_id):
        hoje = timezone.localdate()
        loja = Loja.objects.get(pk=loja_id)
        avisos = []
        for g in _grupos_da_loja(loja_id).filter(situacao__in=ABERTAS):
            if not eh_aviso(g, hoje):
                continue
            dias = (g.referencia - hoje).days
            avisos.append({"id": g.id, "grupo": _grupo_json(g, hoje, com_lotes=False),
                           "vence_em_dias": dias, "urgente": dias <= URGENTE_DIAS})
        return Response({"antecedencia_dias": loja.antecedencia_aviso_dias, "avisos": avisos})


class AvisoDetalhe(RotaDaLoja):
    """GET /api/lojas/{lojaId}/avisos/{id} (L6, L7): tudo o que a publicação precisa."""

    def get(self, request, loja_id, grupo_id):
        hoje = timezone.localdate()
        g = _aviso(loja_id, grupo_id, hoje)
        if g is None:
            return _nao_e_aviso()
        produto = Produto.objects.annotate(ultimo_preco=_ultimo_preco()).get(pk=g.produto_id)
        return Response({
            "grupo": _grupo_json(g, hoje),
            "preco_sugerido": (apresentacao.dinheiro(produto.ultimo_preco)
                               if produto.ultimo_preco is not None else None),
            "janela_padrao_horas": apresentacao.horas(g.produto.loja.janela_padrao),
            "fim_previsto": apresentacao.quando(servico_lotes.fim_previsto(g)),
            "adiar_ate_max": servico_lotes.adiar_ate_max(g).isoformat(),
            "margem_efetiva_dias": g.produto.margem_efetiva().days,
        })


class Adiar(RotaDaLoja):
    """POST /api/lojas/{lojaId}/avisos/{id}/adiar {ate} (L8)."""

    def post(self, request, loja_id, grupo_id):
        hoje = timezone.localdate()
        if _aviso(loja_id, grupo_id, hoje) is None:
            return _nao_e_aviso()
        ate = _data(request.data.get("ate"))
        if ate is None:
            return erro(400, "Data inválida (use AAAA-MM-DD).", "data_invalida")
        try:
            servico_lotes.adiar(grupo_id, ate)
        except ErroOperacao as e:
            return _do_servico(e)
        return Response(_grupo_json(_grupos_da_loja(loja_id).get(pk=grupo_id), hoje))


class Descartar(RotaDaLoja):
    """POST /api/lojas/{lojaId}/avisos/{id}/descartar {motivo}: "não vai para oferta"."""

    def post(self, request, loja_id, grupo_id):
        hoje = timezone.localdate()
        if _aviso(loja_id, grupo_id, hoje) is None:
            return _nao_e_aviso()
        motivo = request.data.get("motivo")
        if motivo not in MotivoDescarte.values:
            return erro(400, "Use sem_unidades ou outro_destino.", "motivo_invalido")
        try:
            servico_lotes.descartar(grupo_id, motivo)
        except ErroOperacao as e:
            return _do_servico(e)
        return Response(_grupo_json(_grupos_da_loja(loja_id).get(pk=grupo_id), hoje))


class Publicar(RotaDaLoja):
    """
    POST /api/lojas/{lojaId}/avisos/{id}/publicar (L7)
    {separado, preco_original, desconto, janela_horas, confirmou_separacao: true}
    """

    def post(self, request, loja_id, grupo_id):
        if _aviso(loja_id, grupo_id, timezone.localdate()) is None:
            return _nao_e_aviso()
        d = request.data
        separado = _inteiro(d.get("separado"))
        preco_original = _dinheiro(d.get("preco_original"))
        desconto = _inteiro(d.get("desconto"))
        janela = _inteiro(d.get("janela_horas"))
        if d.get("confirmou_separacao") is not True:
            return erro(400, "Confirme que as unidades foram separadas.", "sem_confirmacao")
        if separado is None or separado < 1:
            return erro(400, "Informe pelo menos 1 unidade separada.", "separado_invalido")
        if preco_original is None:
            return erro(400, "Preço normal inválido.", "preco_invalido")
        if desconto not in DESCONTOS:
            return erro(400, "Desconto: 20, 30, 40 ou 50%.", "desconto_invalido")
        if janela not in JANELAS_HORAS:
            return erro(400, "Janela: 1, 2, 4, 8, 12 ou 24 horas.", "janela_invalida")
        try:
            oferta = servico_lotes.publicar(grupo_id, separado, preco_original, desconto, janela)
        except ErroOperacao as e:
            return _do_servico(e)
        oferta = consultas.com_reservado(
            Oferta.objects.select_related("produto").filter(pk=oferta.pk)).get()
        return Response({"oferta": apresentacao.oferta_loja(oferta)}, status=201)
