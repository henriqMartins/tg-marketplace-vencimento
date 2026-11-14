"""
Testes do prazo de retirada (pedido 1 do frontend, 13/11/2026).

A tela C4 mostra "Retire até 20:00" ANTES de a pessoa reservar. Esse horário
tem de sair da MESMA regra que grava o expira_em da reserva (regra 21: a
janela nunca passa do fim da oferta) — por isso a conta mora no domínio, numa
função só, que o reservar também usa. Nenhuma regra muda: só fica visível.

Rodar (dentro de dominio/):  py -m unittest discover -s tests -v
"""

import unittest

from dominio import Oferta, prazo_de_retirada


class TestPrazoDeRetirada(unittest.TestCase):

    def test_janela_inteira_cabe(self):
        self.assertEqual(prazo_de_retirada(agora=10.0, janela=4.0, fim=48.0), 14.0)

    def test_nunca_passa_do_fim_da_oferta(self):
        self.assertEqual(prazo_de_retirada(agora=46.0, janela=4.0, fim=48.0), 48.0)

    def test_e_o_mesmo_expira_em_da_reserva(self):
        """O que a tela mostra antes = o que a reserva grava depois, no mesmo instante."""
        for agora in (0.0, 10.0, 45.5, 47.9):
            with self.subTest(agora=agora):
                oferta = Oferta(quantidade_separada=5, fim_da_oferta=48.0, janela_reserva=4.0)
                reserva = oferta.reservar(1, agora)
                self.assertEqual(reserva.expira_em, oferta.prazo_de_retirada(agora))
                self.assertEqual(reserva.expira_em, prazo_de_retirada(agora, 4.0, 48.0))


if __name__ == "__main__":
    unittest.main()
