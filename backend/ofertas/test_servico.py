"""
Testes da camada de serviço (etapa 3), contra o PostgreSQL.

Cada ação passa pelos 5 passos: transação -> trava a oferta -> reconstitui o
domínio -> aplica a regra -> grava. Aqui testamos o resultado gravado no banco.
A disputa de várias pessoas AO MESMO TEMPO é a etapa 4.

Rodar (dentro de backend/):  ..\\.venv\\Scripts\\python manage.py test ofertas
"""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase

from dominio import ErroDominio

from . import servico
from .models import Ajuste, Loja, Oferta, Produto, Recusa, Reserva

T0 = datetime(2026, 11, 2, 10, 0, tzinfo=timezone.utc)   # "agora" dos testes


def depois(horas: float) -> datetime:
    return T0 + timedelta(hours=horas)


class Base(TestCase):

    def setUp(self):
        Usuario = get_user_model()
        self.ana = Usuario.objects.create_user("ana", password="x")
        self.bia = Usuario.objects.create_user("bia", password="x")
        self.joao = Usuario.objects.create_user("joao", password="x")
        self.loja = Loja.objects.create(nome="Mercadinho do Zé", endereco="Rua A, 1")
        self.produto = Produto.objects.create(loja=self.loja, nome="Iogurte 170 g")
        self.oferta = self.nova_oferta(self.produto)

    def nova_oferta(self, produto, separado=10):
        return Oferta.objects.create(
            produto=produto, validade=date(2026, 11, 10),
            preco_original=Decimal("5.00"), preco=Decimal("2.50"),
            separado=separado, livre=separado, inicio=T0,
            fim=T0 + timedelta(days=7), janela=timedelta(hours=4))

    def recarregar(self):
        self.oferta.refresh_from_db()
        return self.oferta

    def assertConservacao(self):
        of = self.recarregar()
        reservado = sum(r.quantidade for r in of.reservas.filter(estado="reservada"))
        self.assertEqual(of.separado,
                         of.livre + reservado + of.retirado + of.ajustado + of.perda)


class TestReservar(Base):

    def test_reserva_normal(self):
        r = servico.reservar(self.oferta.id, self.ana, 3, agora=T0)
        self.assertEqual((r.numero, r.quantidade, r.pedido, r.estado), (1, 3, 3, "reservada"))
        self.assertEqual((r.consumidor, r.loja), (self.ana, self.loja))
        self.assertRegex(r.codigo, r"^[0-9]{6}$")
        self.assertEqual(r.expira_em, depois(4))                 # janela de 4 h
        self.assertEqual(self.recarregar().livre, 7)
        self.assertConservacao()

    def test_reserva_parcial(self):
        r = servico.reservar(self.oferta.id, self.ana, 15, agora=T0)
        self.assertEqual((r.quantidade, r.pedido), (10, 15))      # "reservamos 10 de 15"
        self.assertEqual(self.recarregar().livre, 0)

    def test_recusa_total_grava_recusa(self):
        servico.reservar(self.oferta.id, self.ana, 10, agora=T0)
        r = servico.reservar(self.oferta.id, self.bia, 2, agora=depois(1))
        self.assertIsNone(r)
        recusa = Recusa.objects.get()
        self.assertEqual((recusa.consumidor, recusa.pedido), (self.bia, 2))
        self.assertConservacao()

    def test_numeros_seguem_a_ordem(self):
        r1 = servico.reservar(self.oferta.id, self.ana, 1, agora=T0)
        r2 = servico.reservar(self.oferta.id, self.bia, 1, agora=T0)
        self.assertEqual((r1.numero, r2.numero), (1, 2))

    def test_codigos_nao_repetem_entre_ativas_da_loja(self):
        outra = self.nova_oferta(Produto.objects.create(loja=self.loja, nome="Leite"))
        codigos = [servico.reservar(of.id, self.ana, 1, agora=T0).codigo
                   for of in (self.oferta, outra) for _ in range(5)]
        self.assertEqual(len(set(codigos)), 10)

    def test_codigo_sorteado_de_novo_quando_ja_esta_em_uso(self):
        # O sorteio "tira" 123456 duas vezes seguidas: a 2ª reserva tem de
        # perceber que já está em uso e sortear de novo (654321).
        with mock.patch("ofertas.servico.secrets.randbelow",
                        side_effect=[123456, 123456, 654321]):
            r1 = servico.reservar(self.oferta.id, self.ana, 1, agora=T0)
            r2 = servico.reservar(self.oferta.id, self.bia, 1, agora=T0)
        self.assertEqual((r1.codigo, r2.codigo), ("123456", "654321"))

    def test_reserva_vencida_volta_ao_livre_na_proxima_operacao(self):
        r1 = servico.reservar(self.oferta.id, self.ana, 3, agora=T0)      # vence em T0+4h
        servico.reservar(self.oferta.id, self.bia, 1, agora=depois(5))
        r1.refresh_from_db()
        self.assertEqual(r1.estado, "expirada")
        self.assertEqual(self.recarregar().livre, 9)                     # 10 - 1
        self.assertConservacao()


class TestCancelarERetirar(Base):

    def setUp(self):
        super().setUp()
        self.r = servico.reservar(self.oferta.id, self.ana, 3, agora=T0)

    def test_cancelar_devolve_ao_livre(self):
        servico.cancelar(self.r.id, agora=depois(1))
        self.r.refresh_from_db()
        self.assertEqual(self.r.estado, "cancelada")
        self.assertEqual(self.recarregar().livre, 10)
        self.assertConservacao()

    def test_retirar_com_codigo_certo(self):
        r = servico.retirar(self.loja.id, self.r.codigo, agora=depois(1))
        self.assertEqual((r.id, r.estado), (self.r.id, "retirada"))
        self.assertEqual(self.recarregar().retirado, 3)
        self.assertConservacao()

    def test_codigo_certo_em_loja_errada_nao_acha(self):
        loja2 = Loja.objects.create(nome="Empório da Rosa", endereco="Rua B, 2")
        with self.assertRaises(ErroDominio):
            servico.retirar(loja2.id, self.r.codigo, agora=depois(1))

    def test_codigo_inexistente(self):
        codigo_errado = "000000" if self.r.codigo != "000000" else "111111"
        with self.assertRaises(ErroDominio):
            servico.retirar(self.loja.id, codigo_errado, agora=depois(1))

    def test_retirar_depois_da_janela_recusado(self):
        with self.assertRaises(ErroDominio):
            servico.retirar(self.loja.id, self.r.codigo, agora=depois(5))
        self.assertEqual(self.recarregar().retirado, 0)


class TestAjusteEEncerrar(Base):

    def test_ajuste_grava_com_autor(self):
        servico.ajustar(self.oferta.id, self.joao, 2, "embalagem amassada", agora=T0)
        ajuste = Ajuste.objects.get()
        self.assertEqual((ajuste.autor, ajuste.quantidade), (self.joao, 2))
        self.assertEqual(self.recarregar().ajustado, 2)
        self.assertConservacao()

    def test_ajuste_maior_que_o_livre_nao_grava_nada(self):
        servico.reservar(self.oferta.id, self.ana, 8, agora=T0)          # livre 2
        with self.assertRaises(ErroDominio):
            servico.ajustar(self.oferta.id, self.joao, 3, "caiu", agora=T0)
        self.assertEqual(Ajuste.objects.count(), 0)
        self.assertEqual(self.recarregar().livre, 2)

    def test_encerrar_transforma_sobra_em_perda(self):
        r = servico.reservar(self.oferta.id, self.ana, 3, agora=T0)
        servico.retirar(self.loja.id, r.codigo, agora=depois(1))
        perda = servico.encerrar(self.oferta.id, agora=depois(7 * 24))
        of = self.recarregar()
        self.assertEqual((perda, of.perda, of.livre, of.estado), (7, 7, 0, "encerrada"))
        self.assertConservacao()
