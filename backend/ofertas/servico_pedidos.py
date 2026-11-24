"""
Pedido (grupo J, etapa 15; regra em docs/pedido.md): várias reservas de UMA pessoa
em UMA loja, com UM código de retirada.

Nenhuma regra de reserva nova mora aqui (regra 1): cada item passa pelo MESMO
oferta.reservar / cancelar / retirar do domínio, com os mesmos 5 passos do
servico.py (transação → trava → reconstitui → regra → grava). O que este arquivo
acrescenta é a orquestração de VÁRIAS ofertas numa transação só:
  - travar sempre em ordem crescente de id (sem deadlock);
  - um código por pedido, entregue ao domínio pelo gerador_codigo.
"""
from typing import Optional

from django.db import IntegrityError, transaction

import dominio
from dominio import ErroDominio

from .models import Oferta, Pedido, Recusa, Reserva
from .servico import (ATIVA, TENTATIVAS_GRAVACAO, _carregar, _horas_agora, _salvar, _travar,
                      data, sortear_codigo)

RETIRADA = dominio.EstadoReserva.RETIRADA.value


class ErroPedido(Exception):
    """Recusa do pedido: codigo do contrato + frase (+ extras). Mesmo formato do ErroDominio."""

    def __init__(self, mensagem: str, codigo: str, **extras):
        super().__init__(mensagem)
        self.codigo, self.extras = codigo, extras


# ---------------------------------------------------------------- estado (calculado)

def estado_do_pedido(pedido: Pedido) -> str:
    """ativo se algum item está reservado; senão retirado se algum foi retirado; senão encerrado."""
    estados = {r.estado for r in pedido.itens.all()}
    if ATIVA in estados:
        return "ativo"
    return "retirado" if RETIRADA in estados else "encerrado"


# ---------------------------------------------------------------- confirmar (C10 → C5)

def _itens_validos(loja_id, itens) -> list:
    """Confere a lista ANTES de travar qualquer coisa. Devolve [(oferta_id, pedido)]."""
    if not isinstance(itens, list) or not itens:
        raise ErroPedido("O pedido está vazio.", "itens_vazios")
    validos, vistos = [], set()
    for item in itens:
        oferta_id = item.get("oferta_id") if isinstance(item, dict) else None
        pedido = item.get("pedido") if isinstance(item, dict) else None
        if type(oferta_id) is not int:
            raise ErroPedido("Uma das ofertas não é desta loja.", "oferta_de_outra_loja")
        if type(pedido) is not int or pedido < 1:            # bool e texto ficam de fora
            raise ErroPedido("Escolha pelo menos 1 unidade de cada item.", "pedido_invalido")
        if oferta_id in vistos:
            raise ErroPedido("A mesma oferta apareceu duas vezes.", "item_repetido")
        vistos.add(oferta_id)
        validos.append((oferta_id, pedido))
    da_loja = Oferta.objects.filter(pk__in=vistos, produto__loja_id=loja_id).count()
    if da_loja != len(vistos):
        raise ErroPedido("Uma das ofertas não é desta loja.", "oferta_de_outra_loja")
    return validos


def confirmar(cliente, loja_id: int, itens, agora=None):
    """
    POST /api/pedidos. Devolve (pedido, resultados). `pedido` é None quando NENHUM
    item foi reservado (409 tudo_esgotado): sem código, mas com as recusas gravadas.
    resultados = [(oferta_id, pedido, Reserva | None, motivo | None)] na ordem enviada.
    Se dois pedidos simultâneos da mesma loja sortearem o mesmo código, a trava do
    banco recusa um deles: tenta de novo (como o reservar).
    """
    validos = _itens_validos(loja_id, itens)
    for tentativa in range(TENTATIVAS_GRAVACAO):
        try:
            return _confirmar(cliente, loja_id, validos, agora)
        except IntegrityError:
            if tentativa == TENTATIVAS_GRAVACAO - 1:
                raise


# 📖 ESTUDAR: o pedido inteiro numa transação, com as travas em ORDEM DE ID. Se a Ana
# pede iogurte + leite e o Bruno, no mesmo instante, leite + iogurte, os dois travam
# primeiro a oferta de menor id: um espera o outro terminar, em vez de cada um segurar
# uma oferta e esperar a do outro para sempre (deadlock). Cada item usa o MESMO
# oferta.reservar do domínio: parcial, recusa e expira_em saem da regra de sempre.
def _confirmar(cliente, loja_id, validos, agora):
    h = _horas_agora(agora)
    with transaction.atomic():
        linhas = {oferta_id: _travar(oferta_id) for oferta_id in sorted(o for o, _ in validos)}
        pedido = Pedido.objects.create(cliente=cliente, loja_id=loja_id,
                                       codigo=sortear_codigo(loja_id), criado_em=data(h))
        resultados = []
        for oferta_id, quantidade in validos:              # resposta na ordem enviada
            linha = linhas[oferta_id]
            oferta = _carregar(linha, codigo=pedido.codigo)
            try:
                reserva = oferta.reservar(quantidade, h)
            except ErroDominio as e:
                if e.codigo != "oferta_encerrada":
                    raise
                resultados.append((oferta_id, quantidade, None, "oferta_encerrada"))
                continue                                   # nada mudou: não grava
            _salvar(linha, oferta, h, consumidor=cliente, pedido=pedido)
            if reserva is None:                            # livre = 0: recusa, como hoje
                Recusa.objects.create(oferta=linha, consumidor=cliente, pedido=quantidade,
                                      criada_em=data(h))
                resultados.append((oferta_id, quantidade, None, "esgotada"))
            else:
                resultados.append((oferta_id, quantidade,
                                   Reserva.objects.get(oferta=linha, numero=reserva.id), None))
        if not any(r for _, _, r, _ in resultados):
            pedido.delete()                                # sem código; recusas ficam gravadas
            return None, resultados
        return pedido, resultados


# ---------------------------------------------------------------- cancelar (C6)

def _cancelar_reservas(reservas, h):
    """Cancela cada reserva pelo domínio, travando as ofertas em ordem de id."""
    for reserva in sorted(reservas, key=lambda r: r.oferta_id):
        linha = _travar(reserva.oferta_id)
        oferta = _carregar(linha)
        try:
            oferta.cancelar(reserva.numero, h)
        except ErroDominio as e:
            # O domínio só reconstitui as ATIVAS: a que já saiu é "inexistente" para ele.
            if e.codigo not in ("nao_ativa", "reserva_inexistente"):
                raise
        _salvar(linha, oferta, h)       # grava também a expiração, se venceu antes do toque


def cancelar_pedido(pedido: Pedido, agora=None) -> Pedido:
    """Cancela todos os itens ainda ativos. Nenhum ativo → 409 nada_ativo."""
    h = _horas_agora(agora)
    with transaction.atomic():
        ativas = [r.pk for r in pedido.itens.filter(estado=ATIVA)]
        _cancelar_reservas(Reserva.objects.filter(pk__in=ativas), h)
        canceladas = Reserva.objects.filter(pk__in=ativas, estado="cancelada").count()
    # Fora do "with": a expiração de quem venceu antes do toque já ficou gravada.
    if not canceladas:
        raise ErroPedido("Este pedido não tem itens ativos.", "nada_ativo")
    return pedido


def cancelar_item(pedido: Pedido, reserva_id: int, agora=None) -> Pedido:
    """Cancela só um item; o código continua valendo para o resto."""
    reserva = pedido.itens.filter(pk=reserva_id).first()
    if reserva is None:
        raise ErroPedido("Item não encontrado neste pedido.", "nao_encontrado")
    if reserva.estado != ATIVA:                  # já saiu antes: nada a cancelar
        raise ErroPedido("Este item não está mais ativo.", "ja_encerrado")
    h = _horas_agora(agora)
    with transaction.atomic():
        _cancelar_reservas([reserva], h)
    reserva.refresh_from_db()
    if reserva.estado != "cancelada":            # já estava encerrado (ou venceu antes)
        raise ErroPedido("Este item não está mais ativo.", "ja_encerrado")
    return pedido


def pedido_do_cliente(cliente, pedido_id) -> Optional[Pedido]:
    """O pedido, se for DESTA pessoa; senão None (a rota responde 404, não 403)."""
    return Pedido.objects.filter(pk=pedido_id, cliente=cliente).select_related("loja").first()


# ---------------------------------------------------------------- balcão (L12, L13)

def ativa_pelo_codigo(loja_id: int, codigo: str) -> Optional[Reserva]:
    """Um item ativo DESTA loja com esse código (leva ao pedido)."""
    return (Reserva.objects.select_related("pedido_retirada")
            .filter(loja_id=loja_id, codigo=codigo, estado=ATIVA).first())


# 📖 ESTUDAR: a retirada do pedido. Mesma receita da reserva (trava → reconstitui →
# regra → grava), repetida para cada oferta do pedido, SEMPRE em ordem de id (como na
# confirmação). Depois de travar, os itens ativos são RELIDOS: se outro balcão retirou
# o mesmo código um instante antes, não sobra nada e esta chamada responde "não achei".
# Item que venceu antes do toque fica de fora, mas a expiração dele é gravada.
def retirar_pedido(loja_id: int, codigo: str, operador, agora=None):
    """Retira, tudo ou nada, os itens ainda ativos. Devolve (pedido, ids retirados)."""
    h = _horas_agora(agora)
    retiradas, venceu = [], False
    with transaction.atomic():
        item = ativa_pelo_codigo(loja_id, codigo)
        if item is None:
            raise ErroDominio("nenhum pedido ativo com esse código nesta loja",
                              codigo="nao_encontrada")
        pedido = item.pedido_retirada
        ofertas = sorted(set(pedido.itens.filter(estado=ATIVA).values_list("oferta_id", flat=True)))
        for oferta_id in ofertas:
            linha = _travar(oferta_id)
            oferta = _carregar(linha)
            for reserva in pedido.itens.filter(oferta_id=oferta_id, estado=ATIVA):
                try:
                    oferta.retirar(reserva.numero, codigo, h)
                    retiradas.append(reserva.pk)
                except ErroDominio as e:
                    if e.codigo != "venceu":
                        raise                  # outro motivo: desfaz tudo
                    venceu = True              # já expirada pelo domínio: só gravar
            _salvar(linha, oferta, h, operador=operador)
    # Fora do "with": as expirações já ficaram gravadas.
    if not retiradas:
        if venceu:
            raise ErroDominio("o pedido venceu antes da retirada", codigo="venceu")
        raise ErroDominio("nenhum pedido ativo com esse código nesta loja",
                          codigo="nao_encontrada")
    return pedido, retiradas
