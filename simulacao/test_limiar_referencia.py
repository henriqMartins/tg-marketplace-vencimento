"""
test_limiar_referencia.py — a conta do limiar, conferida à mão.

Rodar: py -m unittest -v
"""

import math
import unittest

from limiar_referencia import fracao_plataforma_vence, limiar_metade

# Três rodadas com lote 10: perdas de 0%, 50% e 100%.
RODADAS = [(0, 10), (5, 10), (10, 10)]


class TestFracaoVence(unittest.TestCase):

    def test_taxa_zero_plataforma_nunca_vence(self):
        # Perda 0% contra descarte 0%: empate, não é vitória.
        self.assertEqual(fracao_plataforma_vence(RODADAS, 0), 0)

    def test_empate_nao_conta(self):
        # r = 50%: só a rodada de 0% vence; a de 50% empata.
        self.assertAlmostEqual(fracao_plataforma_vence(RODADAS, 50), 1 / 3)
        # r = 51%: agora a de 50% também vence.
        self.assertAlmostEqual(fracao_plataforma_vence(RODADAS, 51), 2 / 3)

    def test_perda_total_nunca_vence(self):
        # Rodada com perda 100% não vence nem contra descarte de 100%.
        self.assertAlmostEqual(fracao_plataforma_vence(RODADAS, 100), 2 / 3)

    def test_comparacao_exata_em_inteiros(self):
        # 3 de 10 = 30%: empata em r = 30, vence em r = 31.
        self.assertEqual(fracao_plataforma_vence([(3, 10)], 30), 0)
        self.assertEqual(fracao_plataforma_vence([(3, 10)], 31), 1)


class TestLimiarMetade(unittest.TestCase):

    def test_limiar_e_a_perda_do_meio(self):
        # Ordenadas: 0%, 50%, 100%. Acima de 50%, vence em 2 de 3 rodadas.
        self.assertEqual(limiar_metade(RODADAS), 0.5)

    def test_nunca_quando_maioria_perde_tudo(self):
        # Ordenadas: 0%, 100%, 100%. Nenhuma taxa dá vitória em metade.
        self.assertTrue(math.isnan(limiar_metade([(10, 10), (10, 10), (0, 10)])))


if __name__ == "__main__":
    unittest.main()
