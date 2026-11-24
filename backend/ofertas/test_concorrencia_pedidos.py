"""
Concorrência do pedido (grupo J, etapa 15) — o teste obrigatório do CLAUDE.md, agora
com VÁRIAS ofertas por transação.

1. Ana pede iogurte + leite e Bruno pede leite + iogurte NO MESMO INSTANTE, com 1
   unidade de cada. Exige-se: nenhum deadlock (nenhum erro), nada vendido a mais,
   conservação fechando. Para forçar o pior caso, cada trava "demora" 0,3 s.
2. Cinco balcões digitam o código do mesmo pedido de 3 itens: uma retirada só.

Mesmo molde de test_concorrencia.py: uma thread por pessoa, cada uma com a própria
conexão; uma barreira solta todas juntas. TransactionTestCase para as threads
enxergarem os dados de verdade.

Rodar (dentro de backend/):  python manage.py test ofertas.test_concorrencia_pedidos
Controle negativo (trava na ordem ENVIADA, sem ordenar → o PostgreSQL acusa deadlock):
  PowerShell:  $env:CONTROLE_NEGATIVO="1"; python manage.py test ofertas.test_concorrencia_pedidos
"""
import os
import threading
import time
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest import mock, skipUnless

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TransactionTestCase

from . import servico_pedidos
from .models import Loja, Oferta, Pedido, Produto, Reserva
from .servico import _travar

T0 = datetime(2026, 11, 2, 10, 0, tzinfo=timezone.utc)
RODADAS = 5
BALCOES = 5


def _travar_devagar(oferta_id):
    """A trava de verdade + 0,3 s: dá tempo de a outra pessoa travar a dela."""
    linha = _travar(oferta_id)
    time.sleep(0.3)
    return linha


class Disputa(TransactionTestCase):
    def setUp(self):
        Usuario = get_user_model()
        self.ana = Usuario.objects.create_user("ana", password="x", nome="Ana Souza")
        self.bruno = Usuario.objects.create_user("bruno", password="x", nome="Bruno Costa")
        self.loja = Loja.objects.create(nome="Mercadinho do Zé", endereco="Rua A, 1")

    def nova_oferta(self, nome, separado):
        produto = Produto.objects.create(loja=self.loja, nome=nome)
        return Oferta.objects.create(
            produto=produto, validade=date(2026, 11, 10), preco_original=Decimal("5.00"),
            preco=Decimal("2.50"), separado=separado, livre=separado, inicio=T0,
            fim=T0 + timedelta(days=7), janela=timedelta(hours=4))

    def em_paralelo(self, tarefas):
        """Roda as funções ao mesmo tempo. Devolve (resultados, erros)."""
        barreira = threading.Barrier(len(tarefas))
        resultados, erros = [None] * len(tarefas), []

        def rodar(i, tarefa):
            try:
                barreira.wait()
                resultados[i] = tarefa()
            except Exception as e:                   # deadlock vira erro aqui
                erros.append(e)
            finally:
                connection.close()

        threads = [threading.Thread(target=rodar, args=(i, t)) for i, t in enumerate(tarefas)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        return resultados, erros

    def ordem_inversa(self):
        """Ana: iogurte + leite; Bruno: leite + iogurte. 1 unidade de cada."""
        iogurte, leite = self.nova_oferta("Iogurte", 1), self.nova_oferta("Leite", 1)
        ana = lambda: servico_pedidos.confirmar(self.ana, self.loja.id, [
            {"oferta_id": iogurte.id, "pedido": 1}, {"oferta_id": leite.id, "pedido": 1}], agora=T0)
        bruno = lambda: servico_pedidos.confirmar(self.bruno, self.loja.id, [
            {"oferta_id": leite.id, "pedido": 1}, {"oferta_id": iogurte.id, "pedido": 1}], agora=T0)
        resultados, erros = self.em_paralelo([ana, bruno])
        return (iogurte, leite), resultados, erros

    def conferir_conta(self, oferta):
        oferta.refresh_from_db()
        reservado = sum(r.quantidade for r in oferta.reservas.filter(estado="reservada"))
        self.assertGreaterEqual(oferta.livre, 0)
        self.assertLessEqual(reservado, oferta.separado)                   # nada vendido a mais
        self.assertEqual(oferta.separado, oferta.livre + reservado + oferta.retirado
                         + oferta.ajustado + oferta.perda)


class TestOrdemInversa(Disputa):
    def test_dois_pedidos_em_ordem_inversa_sem_deadlock_nem_venda_a_mais(self):
        with mock.patch.object(servico_pedidos, "_travar", _travar_devagar):
            for rodada in range(RODADAS):
                with self.subTest(rodada=rodada):
                    ofertas, resultados, erros = self.ordem_inversa()
                    self.assertEqual(erros, [])                            # sem deadlock
                    pedidos = [p for p, _ in resultados if p is not None]
                    # Quem travou primeiro leva as duas; o outro recebe "tudo esgotado".
                    self.assertEqual(len(pedidos), 1)
                    self.assertEqual(pedidos[0].itens.count(), 2)
                    for oferta in ofertas:
                        self.conferir_conta(oferta)

    @skipUnless(os.environ.get("CONTROLE_NEGATIVO") == "1",
                "controle negativo: ligue com CONTROLE_NEGATIVO=1")
    def test_controle_negativo_sem_ordenar_da_deadlock(self):
        """Trava na ordem ENVIADA: Ana segura o iogurte e espera o leite; Bruno, o contrário."""
        deadlocks = []
        with mock.patch.object(servico_pedidos, "_travar", _travar_devagar), \
                mock.patch.object(servico_pedidos, "_ordem_de_trava", lambda ids: list(ids)):
            for _ in range(RODADAS):
                ofertas, _, erros = self.ordem_inversa()
                deadlocks.append(sum("deadlock" in str(e).lower() for e in erros))
                for oferta in ofertas:                  # mesmo assim, nada vendido a mais
                    self.conferir_conta(oferta)
        print(f"\n[controle negativo] SEM ordenar as travas, deadlocks por rodada: {deadlocks}")
        self.assertTrue(any(deadlocks), "sem ordenar, nenhuma rodada travou: rode de novo")


class TestRetiradaDoPedidoSimultanea(Disputa):
    def test_cinco_balcoes_mesmo_codigo_uma_retirada(self):
        for rodada in range(RODADAS):
            with self.subTest(rodada=rodada):
                ofertas = [self.nova_oferta(f"Item {i}", 3) for i in range(3)]
                pedido, _ = servico_pedidos.confirmar(
                    self.ana, self.loja.id, [{"oferta_id": o.id, "pedido": 2} for o in ofertas],
                    agora=T0)
                balcao = lambda: servico_pedidos.retirar_pedido(
                    self.loja.id, pedido.codigo, self.bruno, agora=T0 + timedelta(hours=1))
                resultados, erros = self.em_paralelo([balcao] * BALCOES)
                self.assertEqual(sum(r is not None for r in resultados), 1)     # um retira
                self.assertEqual([e.codigo for e in erros], ["nao_encontrada"] * (BALCOES - 1))
                self.assertEqual(Reserva.objects.filter(pedido_retirada=pedido,
                                                        estado="retirada").count(), 3)
                for oferta in ofertas:
                    oferta.refresh_from_db()
                    self.assertEqual(oferta.retirado, 2)                        # nada em dobro
                    self.conferir_conta(oferta)
                self.assertEqual(Pedido.objects.filter(pk=pedido.pk).count(), 1)
