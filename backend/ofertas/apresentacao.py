"""
Monta os objetos JSON no formato do contrato (docs/api/contrato.md).

Convenções do contrato: datas com fuso de Brasília ("...-03:00"), dinheiro como
texto com 2 casas ("3.14"), desconto inteiro em %. A tela EXIBE; não calcula.
"""
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from .fita import fita
from .servico_lotes import oferta_do_grupo


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


# ---------------------------------------------------------------- visão da loja

def estoque(oferta) -> dict:
    """Estoque do contrato. `reservado` vem da consulta (consultas.com_reservado)."""
    return {"separado": oferta.separado, "livre": oferta.livre,
            "reservado": oferta.reservado, "retirado": oferta.retirado,
            "ajustado": oferta.ajustado, "perda": oferta.perda}


def oferta_loja(oferta) -> dict:
    """Oferta como a loja vê: com o estoque inteiro (L9, L10)."""
    return {
        "id": oferta.id,
        "produto": produto_resumo(oferta.produto),
        "fita": fita(oferta.validade),
        "validade": oferta.validade.isoformat(),
        "preco": dinheiro(oferta.preco),
        "preco_original": dinheiro(oferta.preco_original),
        "desconto": desconto(oferta),
        "janela_horas": horas(oferta.janela),
        "inicio": quando(oferta.inicio),
        "fim": quando(oferta.fim),
        "estado": oferta.estado,
        "estoque": estoque(oferta),
    }


def cliente(usuario) -> str:
    """
    Nome curto do cliente para a loja: "Ana Souza" -> "Ana S.".
    O balcão precisa reconhecer a pessoa, não o nome completo dela.
    """
    partes = (usuario.nome or "").split()
    if not partes:
        return "Cliente"
    if len(partes) == 1:
        return partes[0]
    return f"{partes[0]} {partes[-1][0]}."


def reserva_loja(reserva) -> dict:
    """
    ReservaLoja: o código vem MASCARADO (só os 3 últimos dígitos). Quem tem o
    código inteiro é o cliente; é ele quem o apresenta no balcão. Se a tela da
    loja mostrasse o código, qualquer funcionário poderia "retirar" sem o cliente.
    """
    return {
        "id": reserva.id,
        "codigo_final": reserva.codigo[-3:],
        "quantidade": reserva.quantidade,
        "pedido": reserva.pedido,
        "estado": reserva.estado,
        "cliente": cliente(reserva.consumidor),
        "criada_em": quando(reserva.criada_em),
        "expira_em": quando(reserva.expira_em),
        "encerrada_em": quando(reserva.encerrada_em),
    }


def total(reserva) -> str:
    return dinheiro(reserva.quantidade * reserva.oferta.preco)


def retirada_previa(reserva) -> dict:
    """RetiradaPrevia (L12): o que conferir antes de entregar."""
    return {"reserva": reserva_loja(reserva), "codigo": reserva.codigo,
            "total": total(reserva), "produto": reserva.oferta.produto.nome,
            "fita": fita(reserva.oferta.validade)}


def retirada_feita(reserva, oferta) -> dict:
    """RetiradaFeita (L13). `oferta` já vem com o reservado calculado."""
    return {"reserva": reserva_loja(reserva), "total": total(reserva),
            "retirada_por": reserva.retirada_por.nome or reserva.retirada_por.email,
            "oferta": {"id": oferta.id, "estoque": estoque(oferta)}}


# ---------------------------------------------------------------- lote, fita e aviso

def produto_loja(produto, ultimo_preco_original=None) -> dict:
    """Produto (L2, busca da L3). margem_fim_dias null = usa a da loja."""
    return {
        "id": produto.id,
        "nome": produto.nome,
        "categoria": produto.categoria,
        "margem_fim_dias": produto.margem_fim.days if produto.margem_fim is not None else None,
        "margem_efetiva_dias": produto.margem_efetiva().days,
        "ultimo_preco_original": (dinheiro(ultimo_preco_original)
                                  if ultimo_preco_original is not None else None),
    }


def lote(l) -> dict:
    return {"id": l.id, "validade": l.validade.isoformat(), "quantidade": l.quantidade,
            "recebido_em": l.recebido_em.isoformat()}


def _data(d):
    return d.isoformat() if d else None


def grupo(g, situacao: str, com_lotes: bool = False) -> dict:
    """
    Grupo de fita. `situacao` é a EXIBIDA (servico_lotes.situacao_exibida), que
    inclui "conferir". Na lista vêm só as contagens; `com_lotes` traz os lotes.
    """
    lotes = sorted(g.lotes.all(), key=lambda l: (l.validade, l.id))
    oferta = oferta_do_grupo(g)
    corpo = {
        "id": g.id,
        "produto": {"id": g.produto.id, "nome": g.produto.nome},
        "fita": fita(g.referencia),
        "referencia": g.referencia.isoformat(),
        "situacao": situacao,
        "aviso_em": g.aviso_em.isoformat(),
        "adiado_ate": _data(g.adiado_ate),
        "colisao": {"validade": g.colisao_validade.isoformat()} if g.colisao_validade else None,
        "qtd_lotes": len(lotes),
        "recebido": sum(l.quantidade for l in lotes),
        "oferta_id": oferta.id if oferta else None,
    }
    if com_lotes:
        corpo["lotes"] = [lote(l) for l in lotes]
    return corpo


# ---------------------------------------------------------------- configuração e equipe

def _coordenada(valor):
    return float(valor) if valor is not None else None


def loja_config(loja) -> dict:
    """LojaConfig (L14). Margem em dias; janela em horas."""
    return {
        "id": loja.id,
        "nome": loja.nome,
        "endereco": loja.endereco,
        "latitude": _coordenada(loja.latitude),
        "longitude": _coordenada(loja.longitude),
        "janela_padrao_horas": horas(loja.janela_padrao),
        "margem_fim_dias": loja.margem_fim.days,
        "antecedencia_aviso_dias": loja.antecedencia_aviso_dias,
    }


def vinculo(v, quem) -> dict:
    """Vinculo (L14). `eu` marca a linha de quem está vendo (a tela não mostra "remover" nela)."""
    return {
        "id": v.id,
        "usuario": {"nome": v.usuario.nome, "email": v.usuario.email},
        "papel": v.papel,
        "eu": v.usuario_id == quem.id,
    }


# ---------------------------------------------------------------- painel do gestor

def item_reserva(r) -> dict:
    """Linha do histórico (G3) para uma reserva. Código MASCARADO, como no balcão."""
    return {"tipo": "reserva", "criada_em": quando(r.criada_em), "codigo_final": r.codigo[-3:],
            "produto": r.oferta.produto.nome, "quantidade": r.quantidade, "pedido": r.pedido,
            "cliente": cliente(r.consumidor), "estado": r.estado,
            "encerrada_em": quando(r.encerrada_em)}


def item_recusa(r) -> dict:
    """Linha do histórico (G3) para uma recusa: pediu e levou 0 (comprador bloqueado)."""
    return {"tipo": "recusa", "criada_em": quando(r.criada_em), "codigo_final": None,
            "produto": r.oferta.produto.nome, "quantidade": 0, "pedido": r.pedido,
            "cliente": cliente(r.consumidor), "estado": "recusa", "encerrada_em": None}
