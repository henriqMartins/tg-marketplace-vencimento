"""
Monta os objetos JSON no formato do contrato (docs/api/contrato.md).

Convenções do contrato: datas com fuso de Brasília ("...-03:00"), dinheiro como
texto com 2 casas ("3.14"), desconto inteiro em %. A tela EXIBE; não calcula.
"""
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from .fita import fita


def quando(dt):
    """Data e hora no fuso do projeto (America/Sao_Paulo), em ISO 8601."""
    return timezone.localtime(dt).isoformat() if dt else None


def dinheiro(valor: Decimal) -> str:
    return str(valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def horas(duracao) -> float:
    """timedelta -> horas; inteiro quando dá (4, e não 4.0)."""
    h = duracao.total_seconds() / 3600
    return int(h) if h.is_integer() else h


def desconto(oferta) -> int:
    """% de desconto. Usa o número calculado no banco, se a consulta já trouxe."""
    if hasattr(oferta, "desconto"):
        return oferta.desconto
    pct = (1 - oferta.preco / oferta.preco_original) * 100
    return int(pct.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def loja_resumo(loja) -> dict:
    return {"id": loja.id, "nome": loja.nome, "endereco": loja.endereco}


def produto_resumo(produto) -> dict:
    return {"nome": produto.nome, "categoria": produto.categoria}


def oferta_vitrine(oferta, livre: int, distancia_km=None) -> dict:
    """OfertaVitrine do contrato."""
    return {
        "id": oferta.id,
        "produto": produto_resumo(oferta.produto),
        "loja": loja_resumo(oferta.produto.loja),
        "distancia_km": round(distancia_km, 1) if distancia_km is not None else None,
        "preco": dinheiro(oferta.preco),
        "preco_original": dinheiro(oferta.preco_original),
        "desconto": desconto(oferta),
        "livre": livre,
        "validade": oferta.validade.isoformat(),
        "fim": quando(oferta.fim),
        "janela_horas": horas(oferta.janela),
        "fita": fita(oferta.validade),
    }


def reserva_consumidor(reserva) -> dict:
    """Reserva (visão do consumidor): o código vem COMPLETO, só para o dono."""
    oferta = reserva.oferta
    return {
        "id": reserva.id,
        "estado": reserva.estado,
        "quantidade": reserva.quantidade,
        "pedido": reserva.pedido,
        "codigo": reserva.codigo,
        "criada_em": quando(reserva.criada_em),
        "expira_em": quando(reserva.expira_em),
        "encerrada_em": quando(reserva.encerrada_em),
        "total": dinheiro(reserva.quantidade * oferta.preco),
        "economia": dinheiro(reserva.quantidade * (oferta.preco_original - oferta.preco)),
        "oferta": {
            "id": oferta.id,
            "produto": produto_resumo(oferta.produto),
            "preco": dinheiro(oferta.preco),
            "preco_original": dinheiro(oferta.preco_original),
            "fita": fita(oferta.validade),
            "loja": loja_resumo(oferta.produto.loja),
        },
    }
