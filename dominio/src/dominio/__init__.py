"""
dominio.py — as REGRAS da reserva (o "manual do jogo").

Este arquivo não sabe nada de banco de dados, tela, internet ou relógio real.
Ele só sabe as regras: como uma oferta nasce, como se reserva, expira,
cancela, retira, ajusta e encerra — e confere, a cada passo, que nenhuma
unidade sumiu nem apareceu do nada.

Quem usa este arquivo:
  - a simulação (simulacao.py): robôs reservando milhares de vezes;
  - o sistema real (backend): clientes de verdade, com banco de dados.
Os dois usam AS MESMAS regras. Por isso a simulação representa o sistema.

Tempo: medido em horas, como número (ex.: 0.0, 1.5, 24.0). Quem chama
informa o "agora". Assim a simulação controla o relógio e os testes são
sempre reproduzíveis.

Decisões do projeto refletidas aqui (Contexto mestre, seção 3):
  16 lote separado antes de publicar (livre nasce = separado)
  17 reserva por quantidade
  18 reserva parcial min(pedido, livre); livre = 0 -> recusa
  19 cancelamento pelo cliente devolve ao livre
  20 ajuste só reduz o livre, com motivo
  21 janela de reserva limitada pelo fim da oferta
  22 retirada tudo ou nada, com código
  23 fim da oferta: sobra livre vira perda
"""

from dataclasses import dataclass
from enum import Enum
from typing import Callable, Dict, List, Optional


class ErroDominio(Exception):
    """Operação proibida pelas regras (ex.: ajustar mais do que o livre)."""


class EstadoReserva(Enum):
    RESERVADA = "reservada"   # ativa: unidades presas esperando o cliente
    RETIRADA = "retirada"     # cliente buscou e pagou (fim feliz)
    EXPIRADA = "expirada"     # passou a janela sem retirar -> devolve
    CANCELADA = "cancelada"   # cliente desistiu -> devolve


class EstadoOferta(Enum):
    ATIVA = "ativa"
    ENCERRADA = "encerrada"


@dataclass
class Reserva:
    id: int
    quantidade: int          # quanto foi efetivamente reservado
    pedido: int              # quanto o cliente pediu (pode ser maior)
    codigo: str              # apresentado na retirada
    criada_em: float
    expira_em: float
    estado: EstadoReserva = EstadoReserva.RESERVADA

    @property
    def parcial(self) -> bool:
        """True quando o sistema reservou menos do que o pedido ("reservamos X de Y")."""
        return self.quantidade < self.pedido


def _codigo_sequencial() -> Callable[[int], str]:
    # Código simples e previsível, bom para testes e simulação.
    # No sistema real o backend troca por um código aleatório seguro.
    return lambda id_reserva: f"R{id_reserva:05d}"


class Oferta:
    """
    Um lote separado e publicado com desconto.

    Contas que a oferta mantém (todas em unidades):
      separado  = quanto o lojista separou e publicou (fixo)
      livre     = quanto ainda pode ser reservado
      reservado = soma das reservas ativas (calculado)
      retirado  = quanto os clientes já levaram
      ajustado  = quanto o lojista baixou (estragou, perdeu)
      perda     = sobra registrada no fim da oferta

    Invariante de conservação (nunca pode quebrar):
      separado = livre + reservado + retirado + ajustado + perda
    """

    def __init__(self, quantidade_separada: int, fim_da_oferta: float,
                 janela_reserva: float, inicio: float = 0.0,
                 gerador_codigo: Optional[Callable[[int], str]] = None):
        if quantidade_separada <= 0:
            raise ErroDominio("a quantidade separada precisa ser maior que zero")
        if janela_reserva <= 0:
            raise ErroDominio("a janela de reserva precisa ser maior que zero")
        if fim_da_oferta <= inicio:
            raise ErroDominio("o fim da oferta precisa ser depois do início")

        self.separado = quantidade_separada
        self.livre = quantidade_separada      # decisão 16
        self.retirado = 0
        self.ajustado = 0
        self.perda = 0
        self.inicio = inicio
        self.fim_da_oferta = fim_da_oferta
        self.janela_reserva = janela_reserva
        self.estado = EstadoOferta.ATIVA
        self.reservas: Dict[int, Reserva] = {}
        self.ajustes: List[tuple] = []        # (quantidade, motivo)
        self._proximo_id = 1
        self._gerar_codigo = gerador_codigo or _codigo_sequencial()
        self.verificar_invariantes()

    # ------------------------------------------------------------ consultas

    @property
    def reservado(self) -> int:
        return sum(r.quantidade for r in self.reservas.values()
                   if r.estado is EstadoReserva.RESERVADA)

    def reservas_ativas(self) -> List[Reserva]:
        return [r for r in self.reservas.values()
                if r.estado is EstadoReserva.RESERVADA]

    # ------------------------------------------------------------ operações

    def reservar(self, pedido: int, agora: float) -> Optional[Reserva]:
        """
        Cliente pede `pedido` unidades. Regras 17, 18 e 21.
        Devolve a Reserva criada, ou None se não havia nada livre (recusa).
        """
        self._exigir_ativa(agora)
        if pedido <= 0:
            raise ErroDominio("o pedido precisa ser de pelo menos 1 unidade")

        # Antes de olhar o livre, devolve o que já expirou até agora.
        self.expirar_vencidas(agora)

        quantidade = min(pedido, self.livre)      # reserva parcial (18)
        if quantidade == 0:
            return None                            # livre = 0 -> recusa

        id_reserva = self._proximo_id
        self._proximo_id += 1
        reserva = Reserva(
            id=id_reserva,
            quantidade=quantidade,
            pedido=pedido,
            codigo=self._gerar_codigo(id_reserva),
            criada_em=agora,
            # janela nunca passa do fim da oferta (21)
            expira_em=min(agora + self.janela_reserva, self.fim_da_oferta),
        )
        self.livre -= quantidade
        self.reservas[id_reserva] = reserva
        self.verificar_invariantes()
        return reserva

    def cancelar(self, id_reserva: int, agora: float) -> Reserva:
        """Cliente desiste (19). Só vale para reserva ainda ativa."""
        self.expirar_vencidas(agora)
        reserva = self._reserva_ativa(id_reserva)
        reserva.estado = EstadoReserva.CANCELADA
        self.livre += reserva.quantidade           # devolve uma única vez
        self.verificar_invariantes()
        return reserva

    def expirar_vencidas(self, agora: float) -> List[Reserva]:
        """
        Expira toda reserva ativa cuja janela já acabou (expira_em <= agora)
        e devolve as unidades ao livre. Pode ser chamada quantas vezes quiser:
        uma reserva já expirada não é devolvida de novo.
        """
        expiradas = []
        for reserva in self.reservas_ativas():
            if reserva.expira_em <= agora:
                reserva.estado = EstadoReserva.EXPIRADA
                self.livre += reserva.quantidade
                expiradas.append(reserva)
        if expiradas:
            self.verificar_invariantes()
        return expiradas

    def retirar(self, id_reserva: int, codigo: str, agora: float) -> Reserva:
        """Cliente apresenta o código e leva tudo (22)."""
        self.expirar_vencidas(agora)               # chegou tarde? já expirou
        reserva = self._reserva_ativa(id_reserva)
        if codigo != reserva.codigo:
            raise ErroDominio("código de retirada inválido")
        reserva.estado = EstadoReserva.RETIRADA
        self.retirado += reserva.quantidade        # tudo ou nada
        self.verificar_invariantes()
        return reserva

    def ajustar_estoque(self, quantidade: int, motivo: str, agora: float) -> None:
        """Lojista baixa unidades (20): só do livre e sempre com motivo."""
        self._exigir_ativa(agora)
        if quantidade <= 0:
            raise ErroDominio("o ajuste precisa ser de pelo menos 1 unidade")
        if not motivo or not motivo.strip():
            raise ErroDominio("o ajuste precisa de um motivo")
        self.expirar_vencidas(agora)
        if quantidade > self.livre:
            raise ErroDominio("unidade reservada não pode ser ajustada; "
                              f"livre atual: {self.livre}")
        self.livre -= quantidade
        self.ajustado += quantidade
        self.ajustes.append((quantidade, motivo.strip()))
        self.verificar_invariantes()

    def encerrar(self, agora: float) -> int:
        """
        Fim da oferta (23). Como nenhuma janela passa do fim (21), no fim
        todas as reservas pendentes já venceram e voltam ao livre. O que
        sobra no livre vira perda. Devolve a quantidade perdida.
        """
        if self.estado is EstadoOferta.ENCERRADA:
            raise ErroDominio("a oferta já foi encerrada")
        if agora < self.fim_da_oferta:
            raise ErroDominio("a oferta só encerra no fim programado")
        self.expirar_vencidas(agora)
        self.perda = self.livre
        self.livre = 0
        self.estado = EstadoOferta.ENCERRADA
        self.verificar_invariantes()
        return self.perda

    # ------------------------------------------------------------ garantias

    def verificar_invariantes(self) -> None:
        """Se alguma destas falhar, existe bug nas regras. Nunca deve falhar."""
        assert self.livre >= 0, "estoque livre negativo"
        total = (self.livre + self.reservado + self.retirado
                 + self.ajustado + self.perda)
        assert total == self.separado, (
            f"conservação quebrada: separado={self.separado}, soma={total}")

    # ------------------------------------------------------------ auxiliares

    def _exigir_ativa(self, agora: float) -> None:
        if self.estado is not EstadoOferta.ATIVA:
            raise ErroDominio("a oferta está encerrada")
        if agora >= self.fim_da_oferta:
            raise ErroDominio("a oferta já chegou ao fim")

    def _reserva_ativa(self, id_reserva: int) -> Reserva:
        reserva = self.reservas.get(id_reserva)
        if reserva is None:
            raise ErroDominio("reserva inexistente")
        if reserva.estado is not EstadoReserva.RESERVADA:
            raise ErroDominio(
                f"a reserva não está ativa (estado: {reserva.estado.value})")
        return reserva
