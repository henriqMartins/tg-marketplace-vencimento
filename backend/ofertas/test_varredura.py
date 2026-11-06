"""
Testes da varredura (etapa 5): a "ronda do vigia" que devolve reservas vencidas
e encerra ofertas que passaram do fim. Precisa ser IDEMPOTENTE: rodar duas
vezes dá o mesmo resultado que rodar uma (não devolve unidades em dobro).

Rodar (dentro de backend/):  python manage.py test ofertas.test_varredura
"""
import threading
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection, transaction
from django.test import TransactionTestCase, override_settings

from . import servico
from .models import Loja, Oferta, Produto
from .test_servico import T0, Base, depois

TOKEN = "segredo-de-teste"
URL = "/tarefas/varrer"


class TestVarrer(Base):

    def test_devolve_as_reservas_vencidas(self):
        r = servico.reservar(self.oferta.id, self.ana, 3, agora=T0)      # vence em T0+4h
        resumo = servico.varrer(agora=depois(5))
        r.refresh_from_db()
        self.assertEqual(r.estado, "expirada")
        self.assertEqual(resumo["expiradas"], 1)
        self.assertEqual(self.recarregar().livre, 10)
        self.assertConservacao()

    def test_nao_mexe_em_reserva_ainda_na_janela(self):
        r = servico.reservar(self.oferta.id, self.ana, 3, agora=T0)
        resumo = servico.varrer(agora=depois(1))                          # janela vai até T0+4h
        r.refresh_from_db()
        self.assertEqual(r.estado, "reservada")
        self.assertEqual(resumo["expiradas"], 0)
        self.assertEqual(self.recarregar().livre, 7)

    def test_encerra_oferta_que_passou_do_fim(self):
        servico.reservar(self.oferta.id, self.ana, 3, agora=T0)
        resumo = servico.varrer(agora=depois(7 * 24))                     # fim = T0 + 7 dias
        of = self.recarregar()
        self.assertEqual((of.estado, of.perda, of.livre), ("encerrada", 10, 0))
        self.assertEqual((resumo["encerradas"], resumo["perda"]), (1, 10))
        self.assertConservacao()

    def test_nao_encerra_oferta_ainda_no_prazo(self):
        resumo = servico.varrer(agora=depois(24))
        self.assertEqual(self.recarregar().estado, "ativa")
        self.assertEqual(resumo["encerradas"], 0)

    def test_rodar_duas_vezes_nao_devolve_em_dobro(self):
        servico.reservar(self.oferta.id, self.ana, 3, agora=T0)          # livre 7; vence T0+4h
        primeira = servico.varrer(agora=depois(5))                        # devolve: livre 10
        livre_depois_da_primeira = self.recarregar().livre

        segunda = servico.varrer(agora=depois(5))                         # MESMO "agora"
        self.assertEqual(primeira["expiradas"], 1)                        # a 1ª devolveu a reserva
        self.assertEqual(segunda["expiradas"], 0)                         # a 2ª não achou nada
        self.assertEqual(self.recarregar().livre, livre_depois_da_primeira)  # nada em dobro
        self.assertConservacao()                                          # a conta fecha


class TestOfertaOcupadaEPulada(TransactionTestCase):
    """Se alguém está mexendo na oferta (trava ativa), a ronda pula e não espera."""

    def test_varredura_pula_oferta_travada(self):
        ana = get_user_model().objects.create_user("ana", password="x")
        loja = Loja.objects.create(nome="Mercadinho do Zé", endereco="Rua A, 1")
        produto = Produto.objects.create(loja=loja, nome="Iogurte 170 g")
        oferta = Oferta.objects.create(
            produto=produto, validade=date(2026, 11, 10),
            preco_original=Decimal("5.00"), preco=Decimal("2.50"),
            separado=10, livre=10, inicio=T0, fim=T0 + timedelta(days=7),
            janela=timedelta(hours=4))
        servico.reservar(oferta.id, ana, 3, agora=T0)

        travou, soltar = threading.Event(), threading.Event()

        def outra_operacao():                     # segura a trava da oferta
            with transaction.atomic():
                Oferta.objects.select_for_update().get(pk=oferta.id)
                travou.set()
                soltar.wait(timeout=10)
            connection.close()

        t = threading.Thread(target=outra_operacao)
        t.start()
        travou.wait(timeout=10)
        try:
            resumo = servico.varrer(agora=depois(5))
        finally:
            soltar.set()
            t.join()
        self.assertEqual((resumo["puladas"], resumo["expiradas"]), (1, 0))
        # Na próxima ronda, sem ninguém mexendo, ela é processada.
        self.assertEqual(servico.varrer(agora=depois(5))["expiradas"], 1)


@override_settings(CRON_TOKEN=TOKEN)
class TestEndpoint(Base):

    def post(self, cabecalho=None):
        headers = {"Authorization": cabecalho} if cabecalho else {}
        return self.client.post(URL, headers=headers)

    def test_sem_token_401(self):
        self.assertEqual(self.post().status_code, 401)

    def test_token_errado_403(self):
        self.assertEqual(self.post("Bearer outro-token").status_code, 403)

    def test_token_certo_varre_e_devolve_resumo(self):
        # Oferta que já passou do fim (no relógio real): a varredura encerra.
        agora = datetime.now(timezone.utc)
        Oferta.objects.filter(pk=self.oferta.pk).update(
            inicio=agora - timedelta(days=10), fim=agora - timedelta(days=1))
        resposta = self.post(f"Bearer {TOKEN}")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["encerradas"], 1)
        self.assertEqual(self.recarregar().estado, "encerrada")

    def test_get_nao_e_aceito(self):
        resposta = self.client.get(URL, headers={"Authorization": f"Bearer {TOKEN}"})
        self.assertEqual(resposta.status_code, 405)

    @override_settings(CRON_TOKEN="")
    def test_sem_cron_token_configurado_recusa_sempre(self):
        self.assertEqual(self.post("Bearer ").status_code, 503)
        self.assertEqual(self.post(f"Bearer {TOKEN}").status_code, 503)
