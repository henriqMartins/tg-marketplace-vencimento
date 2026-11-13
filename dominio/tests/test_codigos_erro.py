"""
Testes dos CÓDIGOS de erro do domínio.

Por quê: a API precisa saber QUAL regra recusou a operação para responder
o código certo à tela (acima_do_livre, venceu...). Ela lê `erro.codigo`,
nunca a frase — a frase pode mudar de redação sem quebrar nada.

Nenhuma regra muda aqui: só o "rótulo" de cada recusa.

Rodar (dentro de dominio/):  py -m unittest discover -s tests -v
"""

import unittest

from dominio import ErroDominio, EstadoReserva, Oferta


def nova_oferta(qtd=10, fim=48.0, janela=2.0):
    return Oferta(quantidade_separada=qtd, fim_da_oferta=fim, janela_reserva=janela)


class TestErroDominio(unittest.TestCase):
    def test_sem_codigo_usa_regra(self):
        erro = ErroDominio("qualquer coisa")
        self.assertEqual(erro.codigo, "regra")
        self.assertEqual(erro.dados, {})
        self.assertEqual(str(erro), "qualquer coisa")

    def test_guarda_codigo_e_dados(self):
        erro = ErroDominio("frase", codigo="x", livre=3)
        self.assertEqual(erro.codigo, "x")
        self.assertEqual(erro.dados, {"livre": 3})


class TestCodigosDoAjuste(unittest.TestCase):
    def test_acima_do_livre_informa_o_livre_atual(self):
        oferta = nova_oferta(qtd=10)
        oferta.reservar(4, agora=0.0)               # livre 6
        with self.assertRaises(ErroDominio) as ctx:
            oferta.ajustar_estoque(7, "Danificada", agora=1.0)
        self.assertEqual(ctx.exception.codigo, "acima_do_livre")
        self.assertEqual(ctx.exception.dados["livre"], 6)

    def test_acima_do_livre_ja_conta_as_vencidas(self):
        # A reserva de 4 venceu na hora 2: o livre "de verdade" é 10.
        oferta = nova_oferta(qtd=10)
        oferta.reservar(4, agora=0.0)
        with self.assertRaises(ErroDominio) as ctx:
            oferta.ajustar_estoque(11, "Danificada", agora=3.0)
        self.assertEqual(ctx.exception.dados["livre"], 10)

    def test_sem_motivo(self):
        with self.assertRaises(ErroDominio) as ctx:
            nova_oferta().ajustar_estoque(1, "   ", agora=0.0)
        self.assertEqual(ctx.exception.codigo, "sem_motivo")

    def test_quantidade_invalida(self):
        with self.assertRaises(ErroDominio) as ctx:
            nova_oferta().ajustar_estoque(0, "Danificada", agora=0.0)
        self.assertEqual(ctx.exception.codigo, "quantidade_invalida")

    def test_oferta_encerrada(self):
        oferta = nova_oferta(fim=48.0)
        oferta.encerrar(agora=48.0)
        with self.assertRaises(ErroDominio) as ctx:
            oferta.ajustar_estoque(1, "Danificada", agora=49.0)
        self.assertEqual(ctx.exception.codigo, "oferta_encerrada")

    def test_oferta_que_chegou_ao_fim_tambem_e_encerrada(self):
        # Passou do fim, mas ninguém processou ainda: para a tela é a mesma coisa.
        with self.assertRaises(ErroDominio) as ctx:
            nova_oferta(fim=48.0).ajustar_estoque(1, "Danificada", agora=50.0)
        self.assertEqual(ctx.exception.codigo, "oferta_encerrada")


class TestCodigosDaRetirada(unittest.TestCase):
    def test_venceu(self):
        oferta = nova_oferta(janela=2.0)
        r = oferta.reservar(3, agora=0.0)           # expira na hora 2
        with self.assertRaises(ErroDominio) as ctx:
            oferta.retirar(r.id, r.codigo, agora=2.5)
        self.assertEqual(ctx.exception.codigo, "venceu")

    def test_venceu_deixa_a_reserva_expirada_e_devolvida(self):
        # O backend vai GRAVAR esse estado: a reserva vencida já sai como
        # expirada e as unidades voltam ao livre (uma vez só).
        oferta = nova_oferta(qtd=10, janela=2.0)
        r = oferta.reservar(3, agora=0.0)
        with self.assertRaises(ErroDominio):
            oferta.retirar(r.id, r.codigo, agora=2.5)
        self.assertIs(r.estado, EstadoReserva.EXPIRADA)
        self.assertEqual(oferta.livre, 10)

    def test_codigo_invalido(self):
        oferta = nova_oferta()
        r = oferta.reservar(1, agora=0.0)
        with self.assertRaises(ErroDominio) as ctx:
            oferta.retirar(r.id, "000000", agora=1.0)
        self.assertEqual(ctx.exception.codigo, "codigo_invalido")

    def test_reserva_ja_retirada_nao_esta_ativa(self):
        oferta = nova_oferta()
        r = oferta.reservar(1, agora=0.0)
        oferta.retirar(r.id, r.codigo, agora=1.0)
        with self.assertRaises(ErroDominio) as ctx:
            oferta.retirar(r.id, r.codigo, agora=1.5)
        self.assertEqual(ctx.exception.codigo, "nao_ativa")

    def test_reserva_inexistente(self):
        with self.assertRaises(ErroDominio) as ctx:
            nova_oferta().retirar(99, "R00099", agora=1.0)
        self.assertEqual(ctx.exception.codigo, "reserva_inexistente")


class TestOutrosCodigos(unittest.TestCase):
    def test_reservar_em_oferta_encerrada(self):
        with self.assertRaises(ErroDominio) as ctx:
            nova_oferta(fim=48.0).reservar(1, agora=48.0)
        self.assertEqual(ctx.exception.codigo, "oferta_encerrada")

    def test_pedido_invalido(self):
        with self.assertRaises(ErroDominio) as ctx:
            nova_oferta().reservar(0, agora=0.0)
        self.assertEqual(ctx.exception.codigo, "pedido_invalido")

    def test_cancelar_reserva_ja_cancelada(self):
        oferta = nova_oferta()
        r = oferta.reservar(1, agora=0.0)
        oferta.cancelar(r.id, agora=0.5)
        with self.assertRaises(ErroDominio) as ctx:
            oferta.cancelar(r.id, agora=0.6)
        self.assertEqual(ctx.exception.codigo, "nao_ativa")


if __name__ == "__main__":
    unittest.main()
