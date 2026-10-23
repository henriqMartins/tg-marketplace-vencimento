"""
Camada de serviço: a ponte entre o banco e as regras do domínio.

Regra de negócio NENHUMA mora aqui (ela é do pacote dominio — regra 1).
Toda ação que muda uma oferta segue os mesmos 5 passos (regra 4):

  1. abre uma transação "tudo ou nada"          transaction.atomic()
  2. trava a linha da oferta (o "caderno")       select_for_update()
  3. monta a oferta do domínio a partir do banco _carregar() -> reconstituir
  4. aplica a regra                              oferta.reservar(...) etc.
  5. grava o resultado                           _salvar()
  ... e ao sair do "with", a transação confirma e solta a trava.

Se qualquer passo levantar erro, o banco desfaz TUDO o que foi feito ali.
Permissões (quem pode fazer o quê) ficam para a etapa 6.
"""
import secrets
from datetime import datetime, timezone
from typing import Optional

from django.db import IntegrityError, transaction
from django.db.models import Max

import dominio
from dominio import ErroDominio

from .models import Ajuste, Oferta, Recusa, Reserva

ATIVA = dominio.EstadoReserva.RESERVADA.value
TENTATIVAS_CODIGO = 20       # sorteios até achar um código livre na loja
TENTATIVAS_GRAVACAO = 3      # nova tentativa se dois sorteios simultâneos colidirem


# ---------------------------------------------------------------- relógio
# O domínio mede o tempo em horas (float); o banco, em data e hora.

def horas(dt: datetime) -> float:
    return dt.timestamp() / 3600


def data(h: float) -> datetime:
    # Arredonda ao segundo: a conta em horas (float) deixa "farelo" de
    # microssegundos que não significa nada para o negócio.
    return datetime.fromtimestamp(round(h * 3600), tz=timezone.utc)


def _horas_agora(agora: Optional[datetime]) -> float:
    """Relógio real por padrão; os testes informam o "agora" que quiserem."""
    return horas(agora or datetime.now(timezone.utc))


# ---------------------------------------------------------------- código de retirada

def _gerador_de_codigo(loja_id: int):
    """
    Devolve a função que o domínio chama para criar o código da reserva.
    Sorteia 6 dígitos com secrets (sorteio seguro, imprevisível) e sorteia de
    novo se o código já estiver numa reserva ATIVA desta loja.
    A garantia final é a trava do banco (reserva_codigo_unico_por_loja_entre_ativas).
    """
    def gerar(_numero: int) -> str:
        for _ in range(TENTATIVAS_CODIGO):
            codigo = f"{secrets.randbelow(10**6):06d}"
            em_uso = Reserva.objects.filter(
                loja_id=loja_id, codigo=codigo, estado=ATIVA).exists()
            if not em_uso:
                return codigo
        raise ErroDominio("não foi possível sortear um código livre; tente de novo")
    return gerar


# ---------------------------------------------------------------- banco <-> domínio

def _carregar(linha: Oferta) -> dominio.Oferta:
    """Passo 3: monta a oferta do domínio com os números do banco."""
    ativas = [
        dominio.Reserva(id=r.numero, quantidade=r.quantidade, pedido=r.pedido,
                        codigo=r.codigo, criada_em=horas(r.criada_em),
                        expira_em=horas(r.expira_em))
        for r in linha.reservas.filter(estado=ATIVA)
    ]
    ultimo = linha.reservas.aggregate(maior=Max("numero"))["maior"] or 0
    return dominio.Oferta.reconstituir(
        separado=linha.separado, livre=linha.livre, retirado=linha.retirado,
        ajustado=linha.ajustado, perda=linha.perda,
        inicio=horas(linha.inicio), fim_da_oferta=horas(linha.fim),
        janela_reserva=linha.janela.total_seconds() / 3600,
        estado=dominio.EstadoOferta(linha.estado),
        reservas_ativas=ativas, proximo_id=ultimo + 1,
        gerador_codigo=_gerador_de_codigo(linha.produto.loja_id),
    )


def _salvar(linha: Oferta, oferta: dominio.Oferta, consumidor=None) -> None:
    """
    Passo 5: copia o resultado do domínio para o banco.
    `consumidor` só é usado se a operação CRIOU uma reserva (o domínio não
    sabe quem é o cliente; o banco precisa saber).
    """
    linha.livre = oferta.livre
    linha.retirado = oferta.retirado
    linha.ajustado = oferta.ajustado
    linha.perda = oferta.perda
    linha.estado = oferta.estado.value
    linha.save(update_fields=["livre", "retirado", "ajustado", "perda", "estado"])

    for r in oferta.reservas.values():
        Reserva.objects.update_or_create(
            oferta=linha, numero=r.id,
            defaults={"estado": r.estado.value},              # já existia: só o estado muda
            create_defaults={                                  # é nova: grava tudo
                "estado": r.estado.value, "loja_id": linha.produto.loja_id,
                "consumidor": consumidor, "quantidade": r.quantidade,
                "pedido": r.pedido, "codigo": r.codigo,
                "criada_em": data(r.criada_em), "expira_em": data(r.expira_em),
            },
        )


def _travar(oferta_id: int) -> Oferta:
    """Passo 2: lê a oferta TRAVADA; outra transação que tente travá-la espera."""
    return Oferta.objects.select_for_update().get(pk=oferta_id)


# ---------------------------------------------------------------- ações

def reservar(oferta_id: int, consumidor, pedido: int,
             agora: Optional[datetime] = None) -> Optional[Reserva]:
    """
    Consumidor pede `pedido` unidades. Devolve a Reserva gravada, ou None se
    não havia nada livre (recusa total, gravada em Recusa).
    Se duas reservas simultâneas de ofertas diferentes da MESMA loja sortearem
    o mesmo código, a trava do banco recusa uma delas: tenta de novo.
    """
    for tentativa in range(TENTATIVAS_GRAVACAO):
        try:
            return _reservar(oferta_id, consumidor, pedido, agora)
        except IntegrityError:
            if tentativa == TENTATIVAS_GRAVACAO - 1:
                raise


def _reservar(oferta_id, consumidor, pedido, agora):
    h = _horas_agora(agora)     # o "agora" em horas, como o domínio quer
    with transaction.atomic():
        linha = _travar(oferta_id)
        oferta = _carregar(linha)
        reserva = oferta.reservar(pedido, h)
        _salvar(linha, oferta, consumidor=consumidor)
        if reserva is None:                     # recusa total (livre = 0)
            Recusa.objects.create(oferta=linha, consumidor=consumidor,
                                  pedido=pedido, criada_em=data(h))
            return None
        return Reserva.objects.get(oferta=linha, numero=reserva.id)


def cancelar(reserva_id: int, agora: Optional[datetime] = None) -> Reserva:
    """Consumidor desiste; as unidades voltam ao livre (uma única vez)."""
    h = _horas_agora(agora)
    with transaction.atomic():
        reserva = Reserva.objects.get(pk=reserva_id)
        linha = _travar(reserva.oferta_id)
        oferta = _carregar(linha)
        oferta.cancelar(reserva.numero, h)
        _salvar(linha, oferta)
        reserva.refresh_from_db()
        return reserva


def retirar(loja_id: int, codigo: str, agora: Optional[datetime] = None) -> Reserva:
    """
    O lojista digita o código na tela dele. O backend acha a reserva ATIVA
    daquela loja com esse código e aplica a retirada (tudo ou nada).
    """
    h = _horas_agora(agora)
    with transaction.atomic():
        reserva = Reserva.objects.filter(loja_id=loja_id, codigo=codigo,
                                         estado=ATIVA).first()
        if reserva is None:
            raise ErroDominio("nenhuma reserva ativa com esse código nesta loja")
        linha = _travar(reserva.oferta_id)
        oferta = _carregar(linha)
        # O domínio confere de novo, já com a trava: se venceu, recusa.
        oferta.retirar(reserva.numero, codigo, h)
        _salvar(linha, oferta)
        reserva.refresh_from_db()
        return reserva


def ajustar(oferta_id: int, autor, quantidade: int, motivo: str,
            agora: Optional[datetime] = None) -> Ajuste:
    """Lojista baixa unidades do livre, com motivo. Grava quem fez."""
    h = _horas_agora(agora)
    with transaction.atomic():
        linha = _travar(oferta_id)
        oferta = _carregar(linha)
        oferta.ajustar_estoque(quantidade, motivo, h)
        _salvar(linha, oferta)
        return Ajuste.objects.create(oferta=linha, autor=autor, quantidade=quantidade,
                                     motivo=motivo.strip(), criado_em=data(h))


def encerrar(oferta_id: int, agora: Optional[datetime] = None) -> int:
    """Fim da oferta: o que sobra no livre vira perda. Devolve a perda."""
    h = _horas_agora(agora)
    with transaction.atomic():
        linha = _travar(oferta_id)
        oferta = _carregar(linha)
        perda = oferta.encerrar(h)
        _salvar(linha, oferta)
        return perda





