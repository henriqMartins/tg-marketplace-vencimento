"""
Grupo F do contrato (Gestor): indicadores do painel (G1) e histórico (G3).
Grupo G (Projeção, G2): no fim do arquivo.
Só o RESPONSÁVEL da loja (o funcionário opera; quem acompanha o negócio é o dono).

Antes de contar, a rota faz a varredura da loja (regra 6): expira as reservas
vencidas e encerra as ofertas que passaram do fim. É um dos três momentos em que
a expiração "atrasada" é processada — sem worker separado.
"""
from datetime import timedelta

from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from config.erros import erro
from contas.permissoes import EhResponsavel

from . import apresentacao, indicadores, projecao, servico
from .api_lotes import _data

PERIODO_PADRAO = timedelta(days=29)        # sem período: últimos 30 dias, hoje incluído
PERIODO_MAXIMO = timedelta(days=365)       # até 1 ano (decidido 13/11/2026)


class PeriodoInvalido(Exception):
    pass


def _periodo(params):
    """(de, ate) a partir de ?de=&ate= (AAAA-MM-DD). O que faltar usa o padrão."""
    ate = _data(params["ate"]) if "ate" in params else timezone.localdate()
    de = _data(params["de"]) if "de" in params else (ate and ate - PERIODO_PADRAO)
    if de is None or ate is None or de > ate or ate - de > PERIODO_MAXIMO:
        raise PeriodoInvalido
    return de, ate


class RotaDoGestor(APIView):
    permission_classes = [EhResponsavel]

    def periodo_varrido(self, request, loja_id):
        """Confere o período e faz a varredura da loja. Devolve (de, ate)."""
        de, ate = _periodo(request.query_params)
        servico.varrer(loja_id=loja_id)
        return de, ate

    def handle_exception(self, exc):
        if isinstance(exc, PeriodoInvalido):
            return erro(400, "Período inválido: use datas AAAA-MM-DD, de ≤ até, no máximo 1 ano.",
                        "periodo_invalido")
        return super().handle_exception(exc)


class Indicadores(RotaDoGestor):
    """GET /api/lojas/{lojaId}/indicadores?de=&ate="""

    def get(self, request, loja_id):
        de, ate = self.periodo_varrido(request, loja_id)
        return Response(indicadores.calcular(loja_id, de, ate))


class Historico(RotaDoGestor):
    """GET /api/lojas/{lojaId}/historico?de=&ate=&estado=&q="""

    def get(self, request, loja_id):
        estado = request.query_params.get("estado") or None
        if estado is not None and estado not in indicadores.ESTADOS_DO_HISTORICO:
            return erro(400, "Estado: reservada, retirada, expirada, cancelada ou recusa.",
                        "estado_invalido")
        de, ate = self.periodo_varrido(request, loja_id)
        q = (request.query_params.get("q") or "").strip()
        totais, reservas, recusas = indicadores.historico(loja_id, de, ate, estado, q)
        itens = ([(r.criada_em, apresentacao.item_reserva(r)) for r in reservas]
                 + [(r.criada_em, apresentacao.item_recusa(r)) for r in recusas])
        itens.sort(key=lambda par: par[0], reverse=True)              # mais recente primeiro
        return Response({**totais, "itens": [item for _, item in itens]})


class Projecao(APIView):
    """
    GET /api/lojas/{lojaId}/projecao?lote=&procura=&chegada=   (grupo G, tela G2)
    Só lê o resumo da simulação: não depende do banco nem do período, não varre nada.
    Sem filtro e chegada 2 h = Tabela 5 do artigo. Nenhuma resposta recomenda janela.
    """
    permission_classes = [EhResponsavel]

    def get(self, request, loja_id):
        p = request.query_params
        lote = p.get("lote") or None
        procura = p.get("procura") or None
        chegada = p.get("chegada") or str(projecao.CHEGADA_PADRAO)
        if (lote not in (None, *projecao.ROTULOS_LOTE)
                or procura not in (None, *projecao.ROTULOS_PROCURA)
                or chegada not in {str(c) for c in projecao.CHEGADAS}):
            return erro(400, "Filtro inválido: lote " + ", ".join(projecao.ROTULOS_LOTE)
                        + "; procura " + ", ".join(projecao.ROTULOS_PROCURA)
                        + "; chegada 1, 2 ou 4.", "parametro_invalido")
        chegada = int(chegada)
        janelas, rodadas = projecao.calcular(lote, procura, chegada)
        return Response({"rodadas": rodadas,
                         "filtro": {"lote": lote, "procura": procura, "chegada": chegada},
                         "janelas": janelas})
