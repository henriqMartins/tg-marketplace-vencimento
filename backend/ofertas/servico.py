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
Permissões (quem pode fazer o quê) ficam nas rotas (contas/permissoes.py).
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


def _encerrada_em(r: dominio.Reserva, h: float) -> Optional[datetime]:
    """
    Quando a reserva saiu de "reservada". Ativa: nenhum.
    Expirada: a hora em que VENCEU (expira_em), não a da operação que percebeu —
    com a expiração preguiçosa, isso pode ser bem depois (decidido 11/11/2026).
    Retirada e cancelada: a hora da operação.
    """
    # 📖 ESTUDAR: a mesma reserva expirada às 20:00 pode ser processada só às 9:00
    # do dia seguinte. Se gravássemos a hora da operação, o painel "por período"
    # contaria a expiração no dia errado.
    if r.estado is dominio.EstadoReserva.RESERVADA:
        return None
    if r.estado is dominio.EstadoReserva.EXPIRADA:
        return data(r.expira_em)
    return data(h)


def _salvar(linha: Oferta, oferta: dominio.Oferta, h: float,
            consumidor=None, operador=None) -> None:
    """
    Passo 5: copia o resultado do domínio para o banco.
    `h` é o "agora" da operação (para o encerrada_em).
    `consumidor` só é usado se a operação CRIOU uma reserva (o domínio não
    sabe quem é o cliente; o banco precisa saber).
    `operador` é quem digitou o código, gravado na reserva retirada.
    """
    linha.livre = oferta.livre
    linha.retirado = oferta.retirado
    linha.ajustado = oferta.ajustado
    linha.perda = oferta.perda
    linha.estado = oferta.estado.value
    linha.save(update_fields=["livre", "retirado", "ajustado", "perda", "estado"])

    for r in oferta.reservas.values():
        retirada = r.estado is dominio.EstadoReserva.RETIRADA
        Reserva.objects.update_or_create(
            oferta=linha, numero=r.id,
            defaults={                                         # já existia: estado e desfecho
                "estado": r.estado.value,
                "encerrada_em": _encerrada_em(r, h),
                "retirada_por": operador if retirada else None,
            },
            create_defaults={                                  # é nova: grava tudo
                "estado": r.estado.value, "loja_id": linha.produto.loja_id,
                "consumidor": consumidor, "quantidade": r.quantidade,
                "pedido": r.pedido, "codigo": r.codigo,
                "criada_em": data(r.criada_em), "expira_em": data(r.expira_em),
                "encerrada_em": _encerrada_em(r, h),
            },
        )


def _travar(oferta_id: int) -> Oferta:
    """Passo 2: lê a oferta TRAVADA; outra transação que tente travá-la espera."""
    return Oferta.objects.select_for_update().get(pk=oferta_id)


def retirar_ate(oferta: Oferta, agora: datetime) -> datetime:
    """
    Até quando a pessoa retira se reservar AGORA (pedido 1 do front). A conta é
    do domínio — a mesma que grava o expira_em da reserva (regra 1).
    """
    janela = oferta.janela.total_seconds() / 3600
    return data(dominio.prazo_de_retirada(horas(agora), janela, horas(oferta.fim)))


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
        _salvar(linha, oferta, h, consumidor=consumidor)
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
        _salvar(linha, oferta, h)
        reserva.refresh_from_db()
        return reserva


def retirar(loja_id: int, codigo: str, operador,
            agora: Optional[datetime] = None) -> Reserva:
    """
    O lojista digita o código na tela dele. O backend acha a reserva ATIVA
    daquela loja com esse código e aplica a retirada (tudo ou nada).
    `operador` = quem está no balcão; fica gravado em retirada_por.
    """
    h = _horas_agora(agora)
    venceu = None
    with transaction.atomic():
        reserva = Reserva.objects.filter(loja_id=loja_id, codigo=codigo,
                                         estado=ATIVA).first()
        if reserva is None:
            raise ErroDominio("nenhuma reserva ativa com esse código nesta loja",
                              codigo="nao_encontrada")
        linha = _travar(reserva.oferta_id)
        oferta = _carregar(linha)
        # 📖 ESTUDAR: o domínio confere de novo, já com a trava. Se a reserva
        # VENCEU, ele recusa — mas antes já a expirou e devolveu as unidades.
        # Em vez de deixar o erro desfazer tudo, gravamos essa expiração e só
        # DEPOIS (fora do "with", transação confirmada) repassamos a recusa.
        try:
            oferta.retirar(reserva.numero, codigo, h)
        except ErroDominio as erro:
            if erro.codigo != "venceu":
                raise                     # outro motivo: desfaz tudo, como sempre
            _salvar(linha, oferta, h)     # grava "expirada" + livre devolvido
            venceu = erro
        else:
            _salvar(linha, oferta, h, operador=operador)
    if venceu is not None:
        raise venceu
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
        _salvar(linha, oferta, h)
        return Ajuste.objects.create(oferta=linha, autor=autor, quantidade=quantidade,
                                     motivo=motivo.strip(), criado_em=data(h))


def expirar(oferta_id: int, agora: Optional[datetime] = None) -> int:
    """
    Expira as reservas vencidas de UMA oferta e devolve ao livre (regra 6).
    Usado antes de mostrar reservas ao consumidor: a tela nunca vê "reservada"
    numa reserva que já venceu. Devolve quantas expiraram.
    """
    h = _horas_agora(agora)
    with transaction.atomic():
        linha = _travar(oferta_id)
        oferta = _carregar(linha)
        expiradas = oferta.expirar_vencidas(h)
        if expiradas:
            _salvar(linha, oferta, h)
        return len(expiradas)


def varrer(agora: Optional[datetime] = None, loja_id: Optional[int] = None) -> dict:
    """
    A "ronda do vigia" (regra 6): devolve ao livre as reservas vencidas e
    encerra as ofertas que passaram do fim (sobra vira perda), em TODAS as
    ofertas. Chamada pelo agendamento diário e, depois, antes dos painéis.

    Idempotente: o que já foi expirado/encerrado fica gravado assim, então
    uma segunda ronda não encontra nada para fazer (o domínio garante que
    cada reserva devolve uma única vez).

    Oferta travada por outra operação naquele instante é PULADA (skip_locked):
    a ronda não espera. A operação em andamento já expira o que precisar, e a
    próxima ronda pega o resto.

    Com `loja_id`, a ronda passa só nas ofertas daquela loja (telas da loja
    varrem antes de mostrar os números; não precisam varrer o sistema todo).
    """
    agora_dt = agora or datetime.now(timezone.utc)
    h = horas(agora_dt)
    reservas = Reserva.objects.all()
    ofertas = Oferta.objects.all()
    if loja_id is not None:
        reservas = reservas.filter(loja_id=loja_id)
        ofertas = ofertas.filter(produto__loja_id=loja_id)
    com_vencidas = reservas.filter(
        estado=ATIVA, expira_em__lte=agora_dt).values_list("oferta_id", flat=True)
    passaram_do_fim = ofertas.filter(
        estado=dominio.EstadoOferta.ATIVA.value, fim__lte=agora_dt).values_list("id", flat=True)

    resumo = {"expiradas": 0, "encerradas": 0, "perda": 0, "puladas": 0}
    for oferta_id in sorted(set(com_vencidas) | set(passaram_do_fim)):
        with transaction.atomic():
            linha = (Oferta.objects.select_for_update(skip_locked=True)
                     .filter(pk=oferta_id).first())
            if linha is None:                     # alguém está mexendo nela agora
                resumo["puladas"] += 1
                continue
            oferta = _carregar(linha)
            resumo["expiradas"] += len(oferta.expirar_vencidas(h))
            if (oferta.estado is dominio.EstadoOferta.ATIVA
                    and h >= oferta.fim_da_oferta):
                resumo["perda"] += oferta.encerrar(h)
                resumo["encerradas"] += 1
            _salvar(linha, oferta, h)
    return resumo


def encerrar(oferta_id: int, agora: Optional[datetime] = None) -> int:
    """Fim da oferta: o que sobra no livre vira perda. Devolve a perda."""
    h = _horas_agora(agora)
    with transaction.atomic():
        linha = _travar(oferta_id)
        oferta = _carregar(linha)
        perda = oferta.encerrar(h)
        _salvar(linha, oferta, h)
        return perda





