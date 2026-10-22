"""
test_dominio.py — confere se as regras de dominio.py estão certas.

Cada teste é uma frase do tipo "se acontecer X, espero Y", escrita em código.
Para rodar (na pasta Codigo):
    python -m unittest -v
Não precisa instalar nada: usa só o que já vem com o Python.
"""

import random
import unittest

from dominio import ErroDominio, EstadoOferta, EstadoReserva, Oferta


def nova_oferta(qtd=10, fim=48.0, janela=2.0):
    # Oferta padrão dos testes: começa na hora 0, termina na hora 48,
    # cada reserva vale 2 horas.
    return Oferta(quantidade_separada=qtd, fim_da_oferta=fim, janela_reserva=janela)


class TestPublicacao(unittest.TestCase):
    def test_livre_nasce_igual_ao_separado(self):
        oferta = nova_oferta(qtd=10)
        self.assertEqual(oferta.livre, 10)
        self.assertEqual(oferta.reservado, 0)


class TestReserva(unittest.TestCase):
    def test_reserva_normal_tira_do_livre(self):
        oferta = nova_oferta(qtd=10)
        r = oferta.reservar(3, agora=0.0)
        self.assertEqual(r.quantidade, 3)
        self.assertEqual(oferta.livre, 7)
        self.assertEqual(oferta.reservado, 3)

    def test_reserva_parcial_quando_pede_mais_que_o_livre(self):
        # "lote de 5, cliente pede 8 -> reserva 5, livre 0"
        oferta = nova_oferta(qtd=5)
        r = oferta.reservar(8, agora=0.0)
        self.assertEqual(r.quantidade, 5)
        self.assertTrue(r.parcial)
        self.assertEqual(oferta.livre, 0)

    def test_recusa_quando_livre_e_zero(self):
        oferta = nova_oferta(qtd=2)
        oferta.reservar(2, agora=0.0)
        self.assertIsNone(oferta.reservar(1, agora=0.5))

    def test_ultima_unidade_disputada(self):
        # Duas pessoas, uma unidade: só uma consegue.
        # (Aqui é em sequência; a disputa simultânea de verdade é garantida
        #  pelo banco de dados no backend, com trava/lock.)
        oferta = nova_oferta(qtd=1)
        primeira = oferta.reservar(1, agora=0.0)
        segunda = oferta.reservar(1, agora=0.0)
        self.assertIsNotNone(primeira)
        self.assertIsNone(segunda)
        self.assertEqual(oferta.livre, 0)

    def test_pedido_zero_e_proibido(self):
        with self.assertRaises(ErroDominio):
            nova_oferta().reservar(0, agora=0.0)


class TestJanela(unittest.TestCase):
    def test_reserva_expira_e_devolve(self):
        oferta = nova_oferta(qtd=10, janela=2.0)
        r = oferta.reservar(4, agora=1.0)            # expira na hora 3
        oferta.expirar_vencidas(agora=2.9)
        self.assertEqual(r.estado, EstadoReserva.RESERVADA)
        oferta.expirar_vencidas(agora=3.0)
        self.assertEqual(r.estado, EstadoReserva.EXPIRADA)
        self.assertEqual(oferta.livre, 10)

    def test_janela_nunca_passa_do_fim_da_oferta(self):
        oferta = nova_oferta(fim=10.0, janela=5.0)
        r = oferta.reservar(1, agora=8.0)            # 8+5=13, mas o fim é 10
        self.assertEqual(r.expira_em, 10.0)

    def test_reservar_depois_do_fim_e_proibido(self):
        oferta = nova_oferta(fim=10.0)
        with self.assertRaises(ErroDominio):
            oferta.reservar(1, agora=10.0)


class TestCancelamento(unittest.TestCase):
    def test_cancelar_devolve_ao_livre(self):
        oferta = nova_oferta(qtd=10)
        r = oferta.reservar(4, agora=0.0)
        oferta.cancelar(r.id, agora=0.5)
        self.assertEqual(r.estado, EstadoReserva.CANCELADA)
        self.assertEqual(oferta.livre, 10)


class TestDevolucaoUnica(unittest.TestCase):
    """Cancelamento x expiração 'ao mesmo tempo': a unidade volta UMA vez só."""

    def test_cancelar_depois_de_expirar_e_recusado(self):
        oferta = nova_oferta(qtd=10, janela=2.0)
        r = oferta.reservar(4, agora=0.0)
        with self.assertRaises(ErroDominio):
            oferta.cancelar(r.id, agora=2.0)         # já venceu na hora 2
        self.assertEqual(r.estado, EstadoReserva.EXPIRADA)
        self.assertEqual(oferta.livre, 10)           # não virou 14

    def test_expirar_depois_de_cancelar_nao_devolve_de_novo(self):
        oferta = nova_oferta(qtd=10, janela=2.0)
        r = oferta.reservar(4, agora=0.0)
        oferta.cancelar(r.id, agora=1.0)
        oferta.expirar_vencidas(agora=5.0)
        self.assertEqual(r.estado, EstadoReserva.CANCELADA)
        self.assertEqual(oferta.livre, 10)


class TestRetirada(unittest.TestCase):
    def test_retirada_com_codigo_certo_leva_tudo(self):
        oferta = nova_oferta(qtd=10)
        r = oferta.reservar(3, agora=0.0)
        oferta.retirar(r.id, r.codigo, agora=1.0)
        self.assertEqual(r.estado, EstadoReserva.RETIRADA)
        self.assertEqual(oferta.retirado, 3)
        self.assertEqual(oferta.livre, 7)

    def test_codigo_errado_e_recusado(self):
        oferta = nova_oferta()
        r = oferta.reservar(3, agora=0.0)
        with self.assertRaises(ErroDominio):
            oferta.retirar(r.id, "CODIGO-ERRADO", agora=1.0)
        self.assertEqual(r.estado, EstadoReserva.RESERVADA)

    def test_retirada_depois_da_janela_e_recusada(self):
        oferta = nova_oferta(qtd=10, janela=2.0)
        r = oferta.reservar(3, agora=0.0)
        with self.assertRaises(ErroDominio):
            oferta.retirar(r.id, r.codigo, agora=2.5)
        self.assertEqual(r.estado, EstadoReserva.EXPIRADA)
        self.assertEqual(oferta.retirado, 0)


class TestAjuste(unittest.TestCase):
    def test_ajuste_reduz_o_livre(self):
        oferta = nova_oferta(qtd=10)
        oferta.ajustar_estoque(2, "embalagem amassada", agora=0.0)
        self.assertEqual(oferta.livre, 8)
        self.assertEqual(oferta.ajustado, 2)

    def test_ajuste_nao_mexe_em_unidade_reservada(self):
        oferta = nova_oferta(qtd=5)
        oferta.reservar(4, agora=0.0)                # livre = 1
        with self.assertRaises(ErroDominio):
            oferta.ajustar_estoque(2, "quebrou", agora=0.5)
        self.assertEqual(oferta.livre, 1)

    def test_ajuste_sem_motivo_e_recusado(self):
        with self.assertRaises(ErroDominio):
            nova_oferta().ajustar_estoque(1, "  ", agora=0.0)


class TestFimDaOferta(unittest.TestCase):
    def test_sobra_livre_vira_perda(self):
        oferta = nova_oferta(qtd=10, fim=24.0, janela=2.0)
        r1 = oferta.reservar(3, agora=0.0)
        oferta.retirar(r1.id, r1.codigo, agora=1.0)  # 3 vendidas
        oferta.reservar(2, agora=23.0)               # pendente até o fim
        perda = oferta.encerrar(agora=24.0)
        self.assertEqual(perda, 7)                   # 10 - 3 retiradas
        self.assertEqual(oferta.estado, EstadoOferta.ENCERRADA)
        self.assertEqual(oferta.reservas_ativas(), [])

    def test_nao_encerra_antes_do_fim(self):
        with self.assertRaises(ErroDominio):
            nova_oferta(fim=24.0).encerrar(agora=10.0)


class TestConservacaoSobSorteio(unittest.TestCase):
    """
    Mini Monte Carlo das REGRAS (não do negócio): 300 ofertas, cada uma com
    operações sorteadas em ordem aleatória. Se alguma combinação quebrasse a
    conservação, verificar_invariantes() acusaria. Semente fixa = reproduzível.
    """

    def test_invariantes_resistem_a_operacoes_sorteadas(self):
        rnd = random.Random(2026)
        for _ in range(300):
            oferta = nova_oferta(qtd=rnd.randint(1, 20), fim=48.0,
                                 janela=rnd.choice([0.5, 1.0, 2.0, 6.0]))
            agora = 0.0
            while agora < 48.0:
                acao = rnd.choice(["reservar", "cancelar", "retirar", "ajustar", "tempo"])
                ativas = oferta.reservas_ativas()
                try:
                    if acao == "reservar":
                        oferta.reservar(rnd.randint(1, 6), agora)
                    elif acao == "cancelar" and ativas:
                        oferta.cancelar(rnd.choice(ativas).id, agora)
                    elif acao == "retirar" and ativas:
                        r = rnd.choice(ativas)
                        oferta.retirar(r.id, r.codigo, agora)
                    elif acao == "ajustar":
                        oferta.ajustar_estoque(rnd.randint(1, 3), "teste", agora)
                except ErroDominio:
                    pass                              # regra recusou: tudo bem
                agora += rnd.uniform(0.0, 1.5)
            oferta.encerrar(agora=max(agora, 48.0))
            soma = oferta.retirado + oferta.ajustado + oferta.perda
            self.assertEqual(soma, oferta.separado)


if __name__ == "__main__":
    unittest.main(verbosity=2)
