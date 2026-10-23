"""
Testes de Oferta.reconstituir(): remontar uma oferta a partir dos números
guardados no banco (o "carregar jogo salvo").

Duas famílias de teste:
  - aceita: o que foi salvo de uma oferta de verdade volta igual e continua
    se comportando igual;
  - recusa: números impossíveis levantam ErroDominio em vez de seguir.

Rodar (dentro de dominio/):  py -m unittest discover -s tests -v
"""

import dataclasses
import unittest

from dominio import ErroDominio, EstadoOferta, EstadoReserva, Oferta, Reserva


def _dados(oferta: Oferta) -> dict:
    """
    Faz o papel do banco: extrai de uma oferta os números que seriam gravados.
    As reservas são COPIADAS: a oferta reconstituída não pode dividir os
    mesmos objetos com a original (no backend elas viriam novas do banco).
    """
    return dict(
        separado=oferta.separado,
        livre=oferta.livre,
        retirado=oferta.retirado,
        ajustado=oferta.ajustado,
        perda=oferta.perda,
        inicio=oferta.inicio,
        fim_da_oferta=oferta.fim_da_oferta,
        janela_reserva=oferta.janela_reserva,
        estado=oferta.estado,
        reservas_ativas=[dataclasses.replace(r) for r in oferta.reservas_ativas()],
        # como o backend faria: maior número de reserva já usado + 1
        proximo_id=max(oferta.reservas, default=0) + 1,
    )


def _resumo(oferta: Oferta) -> tuple:
    return (oferta.livre, oferta.reservado, oferta.retirado,
            oferta.ajustado, oferta.perda, oferta.estado)


def _oferta_com_historia() -> Oferta:
    """10 unidades; passa por reserva, cancelamento, ajuste e retirada."""
    of = Oferta(10, fim_da_oferta=48.0, janela_reserva=4.0)
    of.reservar(3, agora=0.0)                           # r1: livre 7
    of.reservar(2, agora=1.0)                           # r2: livre 5
    of.cancelar(1, agora=2.0)                           # r1 cancelada: livre 8
    of.ajustar_estoque(1, "embalagem amassada", agora=2.0)  # livre 7
    of.retirar(2, "R00002", agora=3.0)                  # r2 retirada
    of.reservar(4, agora=3.5)                           # r3 ativa: livre 3
    return of


class TestReconstituirAceita(unittest.TestCase):

    def test_volta_com_os_mesmos_numeros(self):
        original = _oferta_com_historia()
        copia = Oferta.reconstituir(**_dados(original))
        self.assertEqual(_resumo(copia), _resumo(original))
        self.assertEqual([r.id for r in copia.reservas_ativas()], [3])

    def test_continua_se_comportando_igual(self):
        # O teste mais forte: não basta os números baterem; a partir daqui,
        # as mesmas operações têm de dar o mesmo resultado nas duas.
        original = _oferta_com_historia()
        copia = Oferta.reconstituir(**_dados(original))
        for of in (original, copia):
            r = of.reservar(5, agora=4.0)                # só há 3 livres: parcial
            self.assertEqual((r.id, r.quantidade, r.pedido), (4, 3, 5))
            of.expirar_vencidas(agora=8.0)               # r3 e r4 vencem
            of.encerrar(agora=48.0)
        self.assertEqual(_resumo(copia), _resumo(original))
        self.assertEqual(copia.perda, 7)

    def test_proxima_reserva_nao_reaproveita_numero(self):
        # r1 (cancelada) e r2 (retirada) não vieram do "banco", mas os
        # números 1 e 2 já foram usados: a próxima tem de ser a 4.
        copia = Oferta.reconstituir(**_dados(_oferta_com_historia()))
        nova = copia.reservar(1, agora=4.0)
        self.assertEqual(nova.id, 4)

    def test_reconstituir_nao_expira_nada_sozinho(self):
        # Carregar não é operar: sem "agora", nada vence. A reserva vencida
        # só volta ao livre na próxima operação, e uma única vez.
        original = Oferta(10, fim_da_oferta=48.0, janela_reserva=4.0)
        original.reservar(3, agora=0.0)                  # vence em 4.0
        copia = Oferta.reconstituir(**_dados(original))
        self.assertEqual(copia.livre, 7)
        self.assertEqual(copia.reservas[1].estado, EstadoReserva.RESERVADA)

        copia.reservar(1, agora=5.0)                     # já passou de 4.0
        self.assertEqual(copia.reservas[1].estado, EstadoReserva.EXPIRADA)
        self.assertEqual(copia.livre, 10 - 1)            # devolveu 3, reservou 1
        self.assertEqual(copia.expirar_vencidas(agora=5.0), [])  # não devolve de novo

    def test_oferta_encerrada_valida(self):
        original = Oferta(10, fim_da_oferta=48.0, janela_reserva=4.0)
        original.reservar(3, agora=0.0)
        original.retirar(1, "R00001", agora=1.0)
        original.encerrar(agora=48.0)                    # sobra 7 vira perda
        copia = Oferta.reconstituir(**_dados(original))
        self.assertEqual(copia.estado, EstadoOferta.ENCERRADA)
        self.assertEqual(copia.perda, 7)


class TestReconstituirRecusa(unittest.TestCase):
    """Cada teste estraga UM dado de um estado válido e espera a recusa."""

    def _validos(self) -> dict:
        # 10 separadas; uma reserva ativa (nº 1) de 3 unidades; livre 7.
        of = Oferta(10, fim_da_oferta=48.0, janela_reserva=4.0)
        of.reservar(3, agora=0.0)
        return _dados(of)

    def _reserva(self, **mudancas) -> Reserva:
        base = Reserva(id=1, quantidade=3, pedido=3, codigo="R00001",
                       criada_em=0.0, expira_em=4.0)
        return dataclasses.replace(base, **mudancas)

    def test_controle_dados_validos_passam(self):
        # Controle: sem isto, os testes abaixo poderiam "passar" porque
        # o método recusa tudo, inclusive o que é válido.
        Oferta.reconstituir(**self._validos())

    def test_conservacao_quebrada(self):
        d = self._validos()
        d["livre"] = 8                                   # 8 + 3 = 11 ≠ 10
        with self.assertRaises(ErroDominio):
            Oferta.reconstituir(**d)

    def test_contador_negativo_mesmo_com_soma_certa(self):
        d = self._validos()
        d["livre"], d["retirado"] = 8, -1                # 8 + 3 - 1 = 10: a soma "fecha"
        with self.assertRaises(ErroDominio):
            Oferta.reconstituir(**d)

    def test_reserva_na_lista_que_nao_esta_ativa(self):
        d = self._validos()
        d["reservas_ativas"] = [self._reserva(estado=EstadoReserva.RETIRADA)]
        with self.assertRaises(ErroDominio):
            Oferta.reconstituir(**d)

    def test_reserva_com_quantidade_zero(self):
        d = self._validos()
        d["livre"] = 10                                  # 10 + 0 = 10: a soma "fecha"
        d["reservas_ativas"] = [self._reserva(quantidade=0)]
        with self.assertRaises(ErroDominio):
            Oferta.reconstituir(**d)

    def test_numero_de_reserva_repetido(self):
        d = self._validos()
        d["livre"] = 4                                   # 4 + 3 + 3 = 10
        d["reservas_ativas"] = [self._reserva(), self._reserva(codigo="R00009")]
        d["proximo_id"] = 2
        with self.assertRaises(ErroDominio):
            Oferta.reconstituir(**d)

    def test_numero_de_reserva_nao_e_menor_que_o_proximo(self):
        d = self._validos()
        d["proximo_id"] = 1                              # a reserva nº 1 já existe
        with self.assertRaises(ErroDominio):
            Oferta.reconstituir(**d)

    def test_encerrada_com_reserva_ativa(self):
        d = self._validos()
        d["estado"] = EstadoOferta.ENCERRADA
        with self.assertRaises(ErroDominio):
            Oferta.reconstituir(**d)


if __name__ == "__main__":
    unittest.main()
