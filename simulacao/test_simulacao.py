"""
test_simulacao.py — verificação da simulação.

1. Testes DEGENERADOS: sem aleatoriedade (chegadas em intervalos fixos,
   pedido sempre 1, tempo de chegada fixo, ninguém falta nem cancela).
   O resultado tem de bater com a conta feita à mão, escrita em cada teste.
2. Reprodutibilidade: mesma semente -> mesmo resultado.
3. Conservação em rodadas aleatórias: nenhuma unidade some ou aparece.

Rodar: py -m unittest -v
"""

import unittest

import numpy as np

from simulacao import (TEMPO_CHEGADA_FAIXA, Cenario, rodar_experimento,
                       simular_oferta, sortear_cenario, sortear_compradores)


def degenerado(razao: float, tempo_chegada: float) -> Cenario:
    """Lote 10, oferta de 100 h, nenhuma aleatoriedade."""
    return Cenario(lote=10, duracao=100.0, razao=razao,
                   frac_nao_aparece=0.0, frac_cancela=0.0,
                   pedido_fixo=1, tempo_chegada_fixo=tempo_chegada,
                   chegadas_regulares=True)


def rodar(cen: Cenario, janela: float) -> dict:
    compradores = sortear_compradores(cen, np.random.default_rng(0))
    return simular_oferta(cen, janela, compradores)


class TestDegenerado(unittest.TestCase):

    def test_todos_retiram_dentro_da_janela(self):
        # Conta à mão: razão 1 -> 1 × 10 ÷ (1 × 100) = 0,1 comprador/h
        # -> 10 compradores, em t = 0, 10, 20, ..., 90.
        # Cada um reserva 1 e chega 1 h depois (< janela de 4 h) -> retira.
        # Retirado = 10, perda = 0, bloqueados = 0.
        r = rodar(degenerado(razao=1.0, tempo_chegada=1.0), janela=4.0)
        self.assertEqual(r["compradores"], 10)
        self.assertEqual(r["retirado"], 10)
        self.assertEqual(r["perda"], 0)
        self.assertEqual(r["bloq_total"] + r["bloq_parcial"], 0)
        self.assertEqual(r["taxa_retirada"], 1.0)

    def test_todos_se_atrasam(self):
        # Conta à mão: mesmos 10 compradores, mas cada um precisa de 5 h e a
        # janela é de 4 h. Cada reserva expira em t + 4, a unidade volta ao
        # livre antes do próximo comprador (t + 10). Ninguém é bloqueado,
        # ninguém retira: as 10 reservas expiram por atraso e o lote inteiro
        # vira perda no fim.
        r = rodar(degenerado(razao=1.0, tempo_chegada=5.0), janela=4.0)
        self.assertEqual(r["retirado"], 0)
        self.assertEqual(r["perda"], 10)
        self.assertEqual(r["exp_atraso"], 10)
        self.assertEqual(r["exp_nao_aparece"], 0)
        self.assertEqual(r["bloq_total"] + r["bloq_parcial"], 0)

    def test_procura_dobrada(self):
        # Conta à mão: razão 2 -> 0,2 comprador/h -> 20 compradores,
        # em t = 0, 5, ..., 95. Os 10 primeiros reservam e retiram 1 h depois;
        # retirada não devolve nada ao livre, então os 10 seguintes encontram
        # livre = 0 e são recusados (bloqueio total).
        r = rodar(degenerado(razao=2.0, tempo_chegada=1.0), janela=4.0)
        self.assertEqual(r["compradores"], 20)
        self.assertEqual(r["retirado"], 10)
        self.assertEqual(r["perda"], 0)
        self.assertEqual(r["bloq_total"], 10)
        self.assertEqual(r["bloq_parcial"], 0)

    def test_janela_longa_salva_o_atrasado(self):
        # Mesmo caso do "todos se atrasam", mas com janela de 8 h (> 5 h):
        # agora todos chegam a tempo. Retirado = 10, perda = 0.
        # Junto com o teste anterior, é a H1 em miniatura: a janela decide.
        r = rodar(degenerado(razao=1.0, tempo_chegada=5.0), janela=8.0)
        self.assertEqual(r["retirado"], 10)
        self.assertEqual(r["perda"], 0)


class TestReprodutibilidade(unittest.TestCase):

    def test_mesma_semente_mesmo_resultado(self):
        self.assertEqual(rodar_experimento(30, semente=2026),
                         rodar_experimento(30, semente=2026))

    def test_semente_diferente_muda_resultado(self):
        self.assertNotEqual(rodar_experimento(30, semente=2026),
                            rodar_experimento(30, semente=7))

    def test_rodada_nao_depende_de_n(self):
        # A rodada 0 é a mesma com N = 5 ou N = 50.
        a = [l for l in rodar_experimento(5) if l["rodada"] == 0]
        b = [l for l in rodar_experimento(50) if l["rodada"] == 0]
        self.assertEqual(a, b)


class TestConservacao(unittest.TestCase):

    def test_contas_fecham_em_rodadas_aleatorias(self):
        for l in rodar_experimento(300, semente=99):
            # Sem ajuste do lojista: no fim, todo o lote foi retirado ou perdido.
            self.assertEqual(l["retirado"] + l["perda"], l["lote"])
            # Toda reserva termina em exatamente um estado final.
            self.assertEqual(l["retiradas"] + l["canceladas"]
                             + l["exp_nao_aparece"] + l["exp_atraso"],
                             l["reservas"])
            # Cada comprador ou foi recusado ou criou uma reserva.
            self.assertEqual(l["bloq_total"] + l["reservas"], l["compradores"])


class TestSensibilidadeTempoChegada(unittest.TestCase):

    def test_mediana_nao_muda_cenario_nem_compradores(self):
        # Mesma semente: só o tempo de chegada pode mudar entre medianas.
        colunas = ["rodada", "janela", "lote", "duracao", "razao",
                   "frac_nao_aparece", "frac_cancela", "compradores"]
        a = rodar_experimento(50, mediana_tempo_chegada=1.0)
        b = rodar_experimento(50, mediana_tempo_chegada=4.0)
        for la, lb in zip(a, b):
            self.assertEqual([la[c] for c in colunas], [lb[c] for c in colunas])

    def test_mediana_maior_atrasa_todo_comprador(self):
        # Mesmo número aleatório -> tempo maior com mediana maior, sempre
        # dentro da faixa de 15 min a 12 h. Os outros sorteios são idênticos.
        def compradores(mediana, semente):
            rng = np.random.default_rng(semente)
            cen = sortear_cenario(rng, mediana)
            return sortear_compradores(cen, rng)
        # Escolhe a primeira semente (a partir de 123) cujo cenário tem
        # compradores; com faixas amplas, um cenário pode não ter nenhum.
        semente = next(s for s in range(123, 1123) if compradores(1.0, s))
        rapidos, lentos = compradores(1.0, semente), compradores(4.0, semente)
        self.assertGreater(len(rapidos), 0)
        for r, l in zip(rapidos, lentos):
            self.assertEqual((r.chegada, r.pedido, r.destino, r.u_cancela),
                             (l.chegada, l.pedido, l.destino, l.u_cancela))
            self.assertLess(r.tempo_chegada, l.tempo_chegada)
            for t in (r.tempo_chegada, l.tempo_chegada):
                self.assertTrue(TEMPO_CHEGADA_FAIXA[0] <= t <= TEMPO_CHEGADA_FAIXA[1])


if __name__ == "__main__":
    unittest.main()
