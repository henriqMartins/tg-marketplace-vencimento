"""
Teste de concorrência (etapa 4): várias pessoas reservando AO MESMO TEMPO.

Cada pessoa é uma thread (um "trabalhador" em paralelo) com a própria conexão
ao banco, como celulares diferentes. Uma barreira segura todas na largada e
solta juntas. O que se exige: ninguém leva o que não existe — o livre nunca
fica negativo e a conservação fecha.

Usa TransactionTestCase (grava de verdade e limpa no fim): no TestCase comum
tudo roda numa transação só, as threads nem veriam a oferta e a trava não
seria testada de verdade.

Rodar (dentro de backend/):  ..\\.venv\\Scripts\\python manage.py test ofertas.test_concorrencia
Controle negativo (sem a trava, de propósito):
  PowerShell:  $env:CONTROLE_NEGATIVO="1"; ..\\.venv\\Scripts\\python manage.py test ofertas.test_concorrencia
"""
import os
import threading
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest import mock, skipUnless

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TransactionTestCase

from . import servico
from .models import Loja, Oferta, Produto, Recusa, Reserva

T0 = datetime(2026, 11, 2, 10, 0, tzinfo=timezone.utc)
PESSOAS = 20
RODADAS = 5


class Disputa(TransactionTestCase):

    def setUp(self):
        Usuario = get_user_model()
        self.pessoas = [Usuario.objects.create_user(f"cliente{i}", password="x")
                        for i in range(PESSOAS)]
        loja = Loja.objects.create(nome="Mercadinho do Zé", endereco="Rua A, 1")
        self.produto = Produto.objects.create(loja=loja, nome="Iogurte 170 g")

    def nova_oferta(self, separado):
        return Oferta.objects.create(
            produto=self.produto, validade=date(2026, 11, 10),
            preco_original=Decimal("5.00"), preco=Decimal("2.50"),
            separado=separado, livre=separado, inicio=T0,
            fim=T0 + timedelta(days=7), janela=timedelta(hours=4))

    def disputar(self, oferta, pedidos):
        """
        Dispara uma reserva por pessoa, todas no mesmo instante.
        pedidos[i] = quantas unidades a pessoa i pede.
        Devolve a lista de resultados: a Reserva de quem ganhou, None de quem foi recusado.
        """
        barreira = threading.Barrier(len(pedidos))
        resultados = [None] * len(pedidos)
        erros = []

        def cliente(i, pedido):
            try:
                barreira.wait()                       # todos largam juntos
                resultados[i] = servico.reservar(oferta.id, self.pessoas[i],
                                                 pedido, agora=T0)
            except Exception as erro:                 # erro inesperado = teste falha
                erros.append(erro)
            finally:
                connection.close()                    # cada thread fecha a sua conexão

        threads = [threading.Thread(target=cliente, args=(i, p))
                   for i, p in enumerate(pedidos)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()                                  # espera todas terminarem
        self.assertEqual(erros, [])
        return resultados

    def conferir_conta(self, oferta, resultados):
        """O que vale em QUALQUER cenário: livre >= 0, conservação, sem repetição."""
        oferta.refresh_from_db()
        ativas = list(Reserva.objects.filter(oferta=oferta, estado="reservada"))
        reservado = sum(r.quantidade for r in ativas)
        self.assertGreaterEqual(oferta.livre, 0)
        self.assertEqual(oferta.separado, oferta.livre + reservado + oferta.retirado
                         + oferta.ajustado + oferta.perda)
        # Quem "ganhou" tem a SUA reserva no banco (ninguém recebeu a de outro).
        ganhadores = [(i, r) for i, r in enumerate(resultados) if r is not None]
        self.assertEqual(len(ganhadores), len(ativas))
        for i, r in ganhadores:
            self.assertEqual(r.consumidor_id, self.pessoas[i].id)
        self.assertEqual(len({r.codigo for r in ativas}), len(ativas))


class TestUltimaUnidade(Disputa):

    def test_20_pessoas_pela_ultima_unidade(self):
        for rodada in range(RODADAS):
            with self.subTest(rodada=rodada):
                oferta = self.nova_oferta(separado=1)
                resultados = self.disputar(oferta, [1] * PESSOAS)
                ganhou = [r for r in resultados if r is not None]

                self.assertEqual(len(ganhou), 1)                                   # 1 ganhou
                self.assertEqual(Recusa.objects.filter(oferta=oferta).count(), PESSOAS - 1)  # 19 recusas
                oferta.refresh_from_db()                                           # relê do banco
                self.assertEqual(oferta.livre, 0)                                  # nada sobrou
                self.conferir_conta(oferta, resultados)                            # a conta fecha


class TestPoucasUnidades(Disputa):

    def test_20_pessoas_por_5_unidades(self):
        for rodada in range(RODADAS):
            with self.subTest(rodada=rodada):
                oferta = self.nova_oferta(separado=5)
                resultados = self.disputar(oferta, [1] * PESSOAS)
                self.assertEqual(sum(r is not None for r in resultados), 5)
                self.assertEqual(Recusa.objects.filter(oferta=oferta).count(), PESSOAS - 5)
                self.conferir_conta(oferta, resultados)


class TestParcial(Disputa):

    def test_10_pessoas_pedindo_3_de_10_unidades(self):
        for rodada in range(RODADAS):
            with self.subTest(rodada=rodada):
                oferta = self.nova_oferta(separado=10)
                resultados = self.disputar(oferta, [3] * 10)
                quantidades = sorted(r.quantidade for r in resultados if r is not None)
                self.assertEqual(quantidades, [1, 3, 3, 3])    # a 4ª leva o que sobrou
                self.assertEqual(Recusa.objects.filter(oferta=oferta).count(), 6)
                self.conferir_conta(oferta, resultados)


@skipUnless(os.environ.get("CONTROLE_NEGATIVO") == "1",
            "controle negativo: ligue com CONTROLE_NEGATIVO=1")
class TestControleNegativo(Disputa):
    """
    A "fumaça de propósito": troca a leitura TRAVADA por uma leitura comum.
    Sem a trava, várias pessoas leem "livre = 1" ao mesmo tempo e mais de uma
    recebe "reservado!". Se este teste NÃO encontrar o problema, o teste de
    concorrência não estaria provando nada.
    """

    def test_sem_trava_mais_de_uma_pessoa_leva_a_ultima_unidade(self):
        sem_trava = lambda oferta_id: Oferta.objects.get(pk=oferta_id)
        ganhadores_por_rodada = []
        with mock.patch("ofertas.servico._travar", sem_trava):
            for _ in range(RODADAS):
                oferta = self.nova_oferta(separado=1)
                resultados = self.disputar(oferta, [1] * PESSOAS)
                ganhadores_por_rodada.append(sum(r is not None for r in resultados))
        print(f"\n[controle negativo] SEM trava, quantas pessoas 'ganharam' "
              f"a última unidade em cada rodada: {ganhadores_por_rodada}")
        self.assertTrue(any(n > 1 for n in ganhadores_por_rodada),
                        "sem a trava ninguém colidiu: rode de novo")
