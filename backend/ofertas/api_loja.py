"""
Grupo C do contrato (Operação da loja): resumo do dia, ofertas da loja, detalhe
com reservas, ajuste e retirada no balcão (telas L1, L9–L13).

Todas exigem vínculo com a loja do endereço (EhDaLoja): funcionário ou responsável.
Como nas rotas do consumidor, nenhuma regra mora aqui (regra 1): a rota confere a
ENTRADA, chama o serviço e traduz o resultado. Quando o domínio recusa, a rota lê
o `codigo` do erro (nunca a frase) para escolher a resposta.
"""
import re
from datetime import timedelta

from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

import dominio
from config.erros import erro
from contas.permissoes import EhDaLoja, papel_na_loja
from dominio import ErroDominio

from . import apresentacao, consultas, servico, servico_pedidos
from .models import Grupo, Loja, Oferta, Reserva
from .servico_lotes import para_conferir

ATIVA = dominio.EstadoReserva.RESERVADA.value
EXPIRADA = dominio.EstadoReserva.EXPIRADA.value
OFERTA_ATIVA = dominio.EstadoOferta.ATIVA.value
OFERTA_ENCERRADA = dominio.EstadoOferta.ENCERRADA.value
CODIGO_VALIDO = re.compile(r"\d{6}")
MOTIVO_MAXIMO = 200                       # tamanho da coluna Ajuste.motivo
# Reserva que venceu há pouco ainda responde "venceu" (e não "não encontrada"):
# o cliente pode chegar depois de a ronda já ter expirado a reserva dele.
VENCIDA_RECENTE = timedelta(hours=24)

MSG_VENCEU = "Esta reserva venceu: o prazo de retirada acabou."
MSG_NAO_ENCONTRADA = "Nenhuma reserva ativa com esse código nesta loja."

# 📖 ESTUDAR: a "tradução" do erro do domínio para a resposta da tela.
# Código do domínio -> (status HTTP, frase para a pessoa). 400 = a entrada está
# errada (a tela corrige o formulário); 409 = a entrada está certa, mas o ESTADO
# da oferta não permite (conflito: alguém reservou, a oferta acabou...).
ERROS_DO_AJUSTE = {
    "quantidade_invalida": (400, "Informe pelo menos 1 unidade."),
    "sem_motivo": (400, "Informe o motivo do ajuste."),
    "acima_do_livre": (409, "Só dá para ajustar unidades livres; as reservadas não entram."),
    "oferta_encerrada": (409, "Esta oferta já terminou."),
}


def _ofertas_da_loja(loja_id):
    """Só as ofertas DESTA loja, já com o `reservado` calculado no banco."""
    return consultas.com_reservado(
        Oferta.objects.select_related("produto").filter(produto__loja_id=loja_id))


def _oferta_da_loja(loja_id, oferta_id):
    """A oferta, se for desta loja; senão None (a rota responde 404)."""
    return _ofertas_da_loja(loja_id).filter(pk=oferta_id).first()


def _ativa_pelo_codigo(loja_id, codigo):
    return (Reserva.objects.select_related("oferta__produto", "consumidor")
            .filter(loja_id=loja_id, codigo=codigo, estado=ATIVA).first())


def _venceu_ha_pouco(loja_id, codigo, agora):
    """Existe reserva desta loja com esse código que expirou nas últimas 24 h?"""
    return Reserva.objects.filter(loja_id=loja_id, codigo=codigo, estado=EXPIRADA,
                                  expira_em__gte=agora - VENCIDA_RECENTE).exists()


def _codigo_da_entrada(valor):
    """O código digitado, se tiver o formato certo (6 dígitos em texto); senão None."""
    return valor if isinstance(valor, str) and CODIGO_VALIDO.fullmatch(valor) else None


def _nao_achou(loja_id, codigo, agora):
    """Resposta de "não achei reserva ativa": venceu há pouco (409) ou nunca existiu (404)."""
    if codigo and _venceu_ha_pouco(loja_id, codigo, agora):
        return erro(409, MSG_VENCEU, "venceu")
    return erro(404, MSG_NAO_ENCONTRADA, "nao_encontrada")


class RotaDaLoja(APIView):
    """Base das rotas da loja: o porteiro EhDaLoja confere o vínculo antes de tudo."""
    permission_classes = [EhDaLoja]


class ResumoDoDia(RotaDaLoja):
    """GET /api/lojas/{lojaId}/resumo-do-dia (L1)."""

    def get(self, request, loja_id):
        agora = timezone.now()
        servico.varrer(agora, loja_id=loja_id)      # regra 6: números já sem as vencidas
        ativas = Reserva.objects.filter(loja_id=loja_id, estado=ATIVA)
        ofertas = Oferta.objects.filter(produto__loja_id=loja_id, estado=OFERTA_ATIVA)
        loja = Loja.objects.get(pk=loja_id)        # existe: o porteiro achou o vínculo
        return Response({
            "loja": apresentacao.loja_resumo(loja),
            "papel": papel_na_loja(request.user, loja_id),
            "aguardando_retirada": ativas.count(),
            "expiram_em_1h": ativas.filter(expira_em__lte=agora + timedelta(hours=1)).count(),
            "ofertas_ativas": ofertas.count(),
            "avisos_para_conferir": Grupo.objects.filter(          # etapa 10a
                para_conferir(timezone.localdate(agora)), produto__loja_id=loja_id).count(),
        })


class OfertasDaLoja(RotaDaLoja):
    """GET /api/lojas/{lojaId}/ofertas?estado=ativa|encerrada (L9). Sem estado: as duas."""

    def get(self, request, loja_id):
        estado = request.query_params.get("estado") or None
        if estado not in (None, OFERTA_ATIVA, OFERTA_ENCERRADA):
            return erro(400, "Use estado=ativa ou estado=encerrada.", "parametro_invalido")
        servico.varrer(timezone.now(), loja_id=loja_id)
        todas = _ofertas_da_loja(loja_id)
        ativas = list(todas.filter(estado=OFERTA_ATIVA).order_by("fim", "id"))   # acaba antes, 1º
        encerradas = list(todas.filter(estado=OFERTA_ENCERRADA).order_by("-fim", "-id"))
        lista = {OFERTA_ATIVA: ativas, OFERTA_ENCERRADA: encerradas}.get(estado,
                                                                         ativas + encerradas)
        return Response([apresentacao.oferta_loja(o) for o in lista])


class DetalheOfertaDaLoja(RotaDaLoja):
    """GET /api/lojas/{lojaId}/ofertas/{id} (L10): ativa mostra as reservas ativas; encerrada, todas."""

    def get(self, request, loja_id, oferta_id):
        servico.varrer(timezone.now(), loja_id=loja_id)
        oferta = _oferta_da_loja(loja_id, oferta_id)
        if oferta is None:
            return erro(404, "Oferta não encontrada.", "nao_encontrada")
        reservas = oferta.reservas.select_related("consumidor")
        if oferta.estado == OFERTA_ATIVA:
            reservas = reservas.filter(estado=ATIVA).order_by("expira_em", "id")
        else:
            reservas = reservas.order_by("criada_em", "id")
        corpo = apresentacao.oferta_loja(oferta)
        corpo["reservas"] = [apresentacao.reserva_loja(r) for r in reservas]
        return Response(corpo)


class Ajustar(RotaDaLoja):
    """POST /api/lojas/{lojaId}/ofertas/{id}/ajustes {quantidade, motivo} (L11)."""

    def post(self, request, loja_id, oferta_id):
        quantidade = request.data.get("quantidade")
        motivo = request.data.get("motivo")
        if type(quantidade) is not int:                     # bool, texto e 1.5 ficam de fora
            return erro(400, ERROS_DO_AJUSTE["quantidade_invalida"][1], "quantidade_invalida")
        if not isinstance(motivo, str):
            return erro(400, ERROS_DO_AJUSTE["sem_motivo"][1], "sem_motivo")
        if len(motivo.strip()) > MOTIVO_MAXIMO:
            return erro(400, f"O motivo pode ter até {MOTIVO_MAXIMO} letras.", "motivo_longo")
        if _oferta_da_loja(loja_id, oferta_id) is None:
            return erro(404, "Oferta não encontrada.", "nao_encontrada")
        try:
            servico.ajustar(oferta_id, request.user, quantidade, motivo)
        except ErroDominio as e:
            status, mensagem = ERROS_DO_AJUSTE[e.codigo]    # código desconhecido = bug: 500
            return erro(status, mensagem, e.codigo, **e.dados)
        oferta = _oferta_da_loja(loja_id, oferta_id)        # relê com os números novos
        return Response({"estoque": apresentacao.estoque(oferta)}, status=201)


class PreviaDaRetirada(RotaDaLoja):
    """GET /api/lojas/{lojaId}/reservas/ativa?codigo=482917 (L12). Só lê; não retira."""

    def get(self, request, loja_id):
        agora = timezone.now()
        codigo = _codigo_da_entrada(request.query_params.get("codigo"))
        reserva = _ativa_pelo_codigo(loja_id, codigo) if codigo else None
        if reserva is None:
            return _nao_achou(loja_id, codigo, agora)
        if reserva.expira_em <= agora:
            # Ainda "reservada" no banco, mas o prazo passou: expira de verdade agora.
            servico.expirar(reserva.oferta_id, agora=agora)
            return erro(409, MSG_VENCEU, "venceu")
        return Response(apresentacao.retirada_previa(reserva))


class PreviaDoPedido(RotaDaLoja):
    """GET /api/lojas/{lojaId}/pedidos/ativo?codigo=482917 (grupo J, L12 → L13). Só lê."""

    def get(self, request, loja_id):
        agora = timezone.now()
        codigo = _codigo_da_entrada(request.query_params.get("codigo"))
        item = servico_pedidos.ativa_pelo_codigo(loja_id, codigo) if codigo else None
        if item is None:
            if codigo and _venceu_ha_pouco(loja_id, codigo, agora):
                return erro(409, MSG_VENCEU, "venceu")
            return erro(404, "Nenhum pedido ativo com esse código nesta loja.", "nao_encontrado")
        pedido = item.pedido_retirada
        # Itens ainda "reservada" no banco, mas com o prazo vencido: expira de verdade agora.
        vencidas = pedido.itens.filter(estado=ATIVA, expira_em__lte=agora)
        for oferta_id in sorted(set(vencidas.values_list("oferta_id", flat=True))):
            servico.expirar(oferta_id, agora=agora)
        ativas = list(pedido.itens.filter(estado=ATIVA).order_by("id")
                      .select_related("oferta__produto", "consumidor"))
        if not ativas:
            return erro(409, MSG_VENCEU, "venceu")
        return Response(apresentacao.pedido_no_balcao(pedido, ativas))


class Retirar(RotaDaLoja):
    """
    POST /api/lojas/{lojaId}/retiradas {codigo} (L13). Grupo J: retira, tudo ou nada,
    os itens ativos do PEDIDO com esse código; grava quem retirou.
    """

    def post(self, request, loja_id):
        agora = timezone.now()
        codigo = _codigo_da_entrada(request.data.get("codigo"))
        if codigo is None:
            return erro(404, MSG_NAO_ENCONTRADA, "nao_encontrada")
        try:
            pedido, ids = servico_pedidos.retirar_pedido(loja_id, codigo, request.user,
                                                         agora=agora)
        except ErroDominio as e:
            if e.codigo == "venceu":
                return erro(409, MSG_VENCEU, "venceu")
            # nao_encontrada: não havia item ativo — inclusive quando outro balcão
            # retirou o mesmo código no mesmo instante (esta rota esperou a trava e,
            # ao reler os itens, não sobrou nenhum ativo).
            return _nao_achou(loja_id, codigo, agora)
        retiradas = list(Reserva.objects.select_related("oferta__produto", "consumidor",
                                                        "retirada_por")
                         .filter(pk__in=ids).order_by("id"))
        ofertas = {o.id: o for o in _ofertas_da_loja(loja_id)
                   .filter(pk__in=[r.oferta_id for r in retiradas])}
        return Response(apresentacao.retirada_do_pedido(pedido, retiradas, ofertas))
