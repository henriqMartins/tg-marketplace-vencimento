"""
Testes da cor da fita (método de conferência): 6 cores fixas, uma por BIMESTRE
de vencimento (data absoluta), ciclo anual, iguais para qualquer produto.

Não usa banco (SimpleTestCase): a regra é uma conta sobre a data.
Rodar (dentro de backend/):  python manage.py test ofertas.test_fita
"""
from datetime import date

from django.test import SimpleTestCase

from .fita import fita


class TestCorDaFita(SimpleTestCase):

    def test_os_12_meses(self):
        esperado = ["vermelho", "vermelho", "amarelo", "amarelo", "verde", "verde",
                    "azul", "azul", "branco", "branco", "preto", "preto"]
        for mes, cor in enumerate(esperado, start=1):
            with self.subTest(mes=mes):
                self.assertEqual(fita(date(2026, mes, 15))["cor"], cor)

    def test_virada_de_bimestre(self):
        self.assertEqual(fita(date(2026, 2, 28))["cor"], "vermelho")
        self.assertEqual(fita(date(2026, 3, 1))["cor"], "amarelo")

    def test_virada_de_ano_mesma_cor_ano_diferente(self):
        # Mesma cor que dezembro só no ano seguinte? Não: jan é vermelho, dez é preto.
        # E o ANO acompanha a validade (é o que separa grupos e gera a colisão de ciclo).
        dezembro, janeiro = fita(date(2026, 12, 31)), fita(date(2027, 1, 1))
        self.assertEqual((dezembro["cor"], dezembro["ano"]), ("preto", 2026))
        self.assertEqual((janeiro["cor"], janeiro["ano"]), ("vermelho", 2027))

    def test_formato_do_contrato(self):
        self.assertEqual(fita(date(2026, 10, 28)),
                         {"cor": "branco", "bimestre": "set–out", "ano": 2026})
