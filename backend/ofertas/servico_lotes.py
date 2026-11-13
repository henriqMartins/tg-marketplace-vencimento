"""
Serviço do caminho lote → grupo de fita → aviso → oferta (etapa 10a).

Mesmo jeito do servico.py: cada ação de escrita abre transação e TRAVA a linha
que vai mudar (select_for_update), para duas pessoas ao mesmo tempo não
atropelarem uma à outra. Regra de RESERVA nenhuma mora aqui (regra 1): a
publicação monta a Oferta do domínio, e é o domínio que diz como ela nasce.
"""
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

import dominio

from . import calendario
from .fita import classificar_lote, fita
from .models import ABERTAS, Grupo, Lote, Oferta, Produto, Situacao
from .servico import horas

CENTAVO = Decimal("0.01")


class ErroOperacao(Exception):
    """Recusa do caminho do lote (não é regra de reserva). Igual ao ErroDominio: codigo + dados."""

    def __init__(self, mensagem: str, codigo: str, **dados):
        super().__init__(mensagem)
        self.codigo = codigo
        self.dados = dados


# ---------------------------------------------------------------- leitura

def _agora(agora: Optional[datetime]) -> datetime:
    return agora or timezone.now()


def oferta_do_grupo(grupo) -> Optional[Oferta]:
    """A oferta do grupo, ou None (o lado "de volta" de um OneToOne dá erro se não existe)."""
    try:
        return grupo.oferta
    except Oferta.DoesNotExist:
        return None


def para_conferir(hoje: date) -> Q:
    """
    O filtro (para o banco) do "conferir": aguardando cujo dia de aviso chegou, ou
    adiado cujo dia de voltar chegou. Mesma conta de situacao_exibida, em SQL.
    """
    return (Q(situacao=Situacao.AGUARDANDO, aviso_em__lte=hoje)
            | Q(situacao=Situacao.ADIADO, adiado_ate__lte=hoje))


# 📖 ESTUDAR: a situação que a TELA vê sai da situação GRAVADA + a data de hoje.
# "conferir" nunca é gravado: um grupo "aguardando" vira "conferir" sozinho quando
# o dia do aviso chega. Por isso não precisamos de um worker acordando grupos.
def situacao_exibida(grupo, hoje: date) -> str:
    if grupo.situacao == Situacao.EM_OFERTA:
        oferta = oferta_do_grupo(grupo)
        encerrada = oferta is not None and oferta.estado == dominio.EstadoOferta.ENCERRADA.value
        return "encerrado" if encerrada else "em_oferta"
    if grupo.situacao == Situacao.ENCERRADO:
        return "encerrado"
    if grupo.situacao == Situacao.ADIADO:
        return "conferir" if grupo.adiado_ate <= hoje else "adiado"
    return "conferir" if grupo.aviso_em <= hoje else "aguardando"


def eh_aviso(grupo, hoje: date) -> bool:
    """O aviso é o grupo em "conferir" ou "adiado" (contrato, grupo D)."""
    return situacao_exibida(grupo, hoje) in ("conferir", "adiado")


def adiar_ate_max(grupo) -> date:
    return calendario.adiar_ate_max(grupo.referencia, grupo.produto.margem_efetiva())


def fim_previsto(grupo) -> datetime:
    return calendario.fim_da_oferta(grupo.referencia, grupo.produto.margem_efetiva())


def preco_com_desconto(preco_original: Decimal, desconto: int) -> Decimal:
    """preco = original × (1 − desconto/100), em centavos, meio para cima (contrato)."""
    return (preco_original * (100 - desconto) / 100).quantize(CENTAVO, rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------- ações

def registrar_lote(produto_id: int, validade: date, quantidade: int, autor,
                   agora: Optional[datetime] = None):
    """
    O lote chegou (L3). Decide novo / agrupado / colisão e grava.
    Devolve (lote, grupo, resultado, validade_da_colisao).
    """
    agora = _agora(agora)
    hoje = timezone.localdate(agora)
    with transaction.atomic():
        # Trava o PRODUTO: dois lotes do mesmo produto ao mesmo tempo entram um de
        # cada vez — o segundo já enxerga o grupo que o primeiro criou.
        produto = Produto.objects.select_for_update().select_related("loja").get(pk=produto_id)
        antecedencia = produto.loja.antecedencia_aviso_dias

        ativos = []
        for g in produto.grupos.exclude(situacao=Situacao.ENCERRADO).select_related("oferta"):
            if situacao_exibida(g, hoje) == "encerrado":       # oferta já terminou
                continue
            g.aberto = g.situacao in ABERTAS
            ativos.append(g)
        resultado, grupo, colisao = classificar_lote(validade, ativos)

        if grupo is None:                                       # "novo" ou "colisao"
            minha = fita(validade)
            grupo = Grupo.objects.create(
                produto=produto, cor=minha["cor"], ano=minha["ano"], referencia=validade,
                aviso_em=calendario.dia_do_aviso(validade, antecedencia),
                colisao_validade=colisao, criado_em=agora)
        elif validade < grupo.referencia:                       # "agrupado" e vence antes
            grupo.referencia = validade                         # a referência é a mais próxima
            grupo.aviso_em = calendario.dia_do_aviso(validade, antecedencia)
            # O limite do "adiar" encolheu: se o adiamento passou dele, desfaz.
            if grupo.situacao == Situacao.ADIADO and grupo.adiado_ate > adiar_ate_max(grupo):
                grupo.situacao, grupo.adiado_ate = Situacao.AGUARDANDO, None
            grupo.save()

        lote = Lote.objects.create(grupo=grupo, validade=validade, quantidade=quantidade,
                                   recebido_em=hoje, autor=autor)
        return lote, grupo, resultado, colisao


def _travar_aviso(grupo_id: int, hoje: date) -> Grupo:
    grupo = (Grupo.objects.select_for_update(of=("self",))
             .select_related("produto__loja").get(pk=grupo_id))
    if not eh_aviso(grupo, hoje):
        raise ErroOperacao("Este grupo não está em aviso.", "nao_e_aviso")
    return grupo


def adiar(grupo_id: int, ate: date, agora: Optional[datetime] = None) -> Grupo:
    """Adiar o aviso até `ate`: depois de hoje e no máximo até a véspera do último dia."""
    hoje = timezone.localdate(_agora(agora))
    with transaction.atomic():
        grupo = _travar_aviso(grupo_id, hoje)
        limite = adiar_ate_max(grupo)
        if ate <= hoje:
            raise ErroOperacao("Escolha uma data depois de hoje.", "data_invalida")
        if ate > limite:
            raise ErroOperacao("Só dá para adiar até a véspera do último dia da oferta.",
                               "apos_limite", adiar_ate_max=limite.isoformat())
        grupo.situacao, grupo.adiado_ate = Situacao.ADIADO, ate
        grupo.save(update_fields=["situacao", "adiado_ate"])
        return grupo


def descartar(grupo_id: int, motivo: str, agora: Optional[datetime] = None) -> Grupo:
    """ "Não vai para oferta": encerra o grupo sem oferta. Não é perda (perda é de oferta)."""
    hoje = timezone.localdate(_agora(agora))
    with transaction.atomic():
        grupo = _travar_aviso(grupo_id, hoje)
        grupo.situacao, grupo.adiado_ate, grupo.motivo_descarte = Situacao.ENCERRADO, None, motivo
        grupo.save(update_fields=["situacao", "adiado_ate", "motivo_descarte"])
        return grupo


def publicar(grupo_id: int, separado: int, preco_original: Decimal, desconto: int,
             janela_horas: int, agora: Optional[datetime] = None) -> Oferta:
    """
    O lojista contou as unidades na gôndola e publica (L7). A oferta nasce com:
    validade = referência do grupo; fim = 23:59 de (validade − margem efetiva).
    """
    agora = _agora(agora)
    with transaction.atomic():
        grupo = _travar_aviso(grupo_id, timezone.localdate(agora))  # 2º clique: já não é aviso
        recebido = sum(l.quantidade for l in grupo.lotes.all())
        if separado > recebido:
            raise ErroOperacao("Separado maior que o recebido nos lotes.",
                               "acima_do_recebido", recebido=recebido)
        preco = preco_com_desconto(preco_original, desconto)
        if not (Decimal(0) < preco < preco_original):
            raise ErroOperacao("Com esse desconto o preço não fica menor.", "preco_invalido")
        fim = fim_previsto(grupo)
        if agora >= fim:
            raise ErroOperacao("O último dia desta oferta já passou.", "fim_ja_passou")

        # 📖 ESTUDAR: quem diz como a oferta NASCE é o domínio (livre = separado,
        # contadores zerados, estado ativa — decisão 16). O backend só copia.
        nova = dominio.Oferta(quantidade_separada=separado, fim_da_oferta=horas(fim),
                              janela_reserva=float(janela_horas), inicio=horas(agora))
        oferta = Oferta.objects.create(
            produto=grupo.produto, grupo=grupo, validade=grupo.referencia,
            preco_original=preco_original, preco=preco,
            separado=nova.separado, livre=nova.livre, retirado=nova.retirado,
            ajustado=nova.ajustado, perda=nova.perda, estado=nova.estado.value,
            inicio=agora, fim=fim, janela=timedelta(hours=janela_horas))
        grupo.situacao, grupo.adiado_ate = Situacao.EM_OFERTA, None
        grupo.save(update_fields=["situacao", "adiado_ate"])
        return oferta
