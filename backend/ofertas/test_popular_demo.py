"""
Teste do comando de demonstração (python manage.py popular_demo).

Confere que o cenário do vídeo sai como planejado, que rodar duas vezes não
duplica nada e que a CONSERVAÇÃO fecha em todas as ofertas — os dados passam
pelos serviços reais, então qualquer furo de regra apareceria aqui.

Rodar (dentro de backend/):  python manage.py test ofertas.test_popular_demo
"""
from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db.models import F
from django.test import TestCase
from django.utils import timezone

from . import indicadores, servico
from parceria.models import Interesse

from .models import Grupo, Loja, Oferta, Produto, Recusa, Reserva
from .servico_lotes import situacao_exibida


def popular():
    call_command("popular_demo", stdout=StringIO())


class TestPopularDemo(TestCase):

    def setUp(self):
        popular()
        self.vila = Loja.objects.get(nome="Mercadinho Vila Nova")

    def contagem(self):
        return [m.objects.count() for m in (get_user_model(), Loja, Produto, Grupo,
                                             Oferta, Reserva, Recusa, Interesse)]

    def test_rodar_duas_vezes_nao_duplica(self):
        antes = self.contagem()
        popular()
        self.assertEqual(self.contagem(), antes)

    def test_parceria_equipe_e_marcos_com_pedido_novo(self):
        Usuario = get_user_model()
        equipe = Usuario.objects.get(email="equipe@example.com")
        self.assertTrue(equipe.is_staff)
        self.assertTrue(equipe.check_password("demo1234"))
        marcos = Usuario.objects.get(email="marcos@example.com")
        self.assertFalse(marcos.is_staff)
        self.assertFalse(marcos.vinculos.exists())                 # consumidor
        interesse = Interesse.objects.get()
        self.assertEqual((interesse.pessoa, interesse.estado, interesse.nome_mercado),
                         (marcos, "novo", "Mercearia São Jorge"))

    def test_banco_ja_populado_ganha_so_a_parceria(self):
        # Banco populado antes da etapa 14: sem equipe nem Marcos.
        get_user_model().objects.filter(email__in=["equipe@example.com",
                                                   "marcos@example.com"]).delete()
        lojas = Loja.objects.count()
        popular()
        self.assertTrue(get_user_model().objects.filter(email="equipe@example.com").exists())
        self.assertEqual(Interesse.objects.count(), 1)
        self.assertEqual(Loja.objects.count(), lojas)              # lojas não duplicam

    def test_senha_de_demonstracao(self):
        carlos = get_user_model().objects.get(email="carlos@example.com")
        self.assertTrue(carlos.check_password("demo1234"))

    def test_conservacao_fecha_em_todas_as_ofertas(self):
        servico.varrer()                           # processa a reserva que venceu
        for oferta in Oferta.objects.all():
            reservado = sum(r.quantidade for r in oferta.reservas.filter(estado="reservada"))
            with self.subTest(oferta=oferta.produto.nome):
                self.assertGreaterEqual(oferta.livre, 0)
                self.assertEqual(oferta.separado, oferta.livre + reservado + oferta.retirado
                                 + oferta.ajustado + oferta.perda)

    def test_cenario_do_video(self):
        servico.varrer()
        self.assertEqual(Oferta.objects.filter(estado="ativa").count(), 5)
        estados = set(Reserva.objects.values_list("estado", flat=True))
        self.assertEqual(estados, {"reservada", "retirada", "cancelada", "expirada"})
        self.assertEqual(Recusa.objects.count(), 4)              # 1 de hoje + 3 do passado
        self.assertTrue(Reserva.objects.filter(quantidade__lt=F("pedido")).exists())  # parcial

        hoje = timezone.localdate()
        grupos = Grupo.objects.filter(produto__loja=self.vila).select_related("produto")
        situacoes = {g.produto.nome: situacao_exibida(g, hoje) for g in grupos
                     if g.produto.nome in ("Presunto fatiado 200 g", "Doce de leite 400 g")}
        self.assertEqual(situacoes, {"Presunto fatiado 200 g": "conferir",
                                     "Doce de leite 400 g": "adiado"})
        self.assertTrue(grupos.filter(colisao_validade__isnull=False).exists())  # colisão
        leite = grupos.get(produto__nome="Leite integral 1 L", oferta__estado="ativa")
        self.assertEqual(leite.lotes.count(), 2)                                 # 2 lotes, 1 grupo
        # Datas de 3 a 150 dias à frente: 3 ou 4 bimestres, conforme o dia em que roda.
        self.assertGreaterEqual(len({g.cor for g in grupos}), 3)

    def test_painel_dos_ultimos_30_dias_tem_historico(self):
        """O vídeo mostra o G1: as 4 semanas de passado têm de aparecer nele."""
        servico.varrer()
        hoje = timezone.localdate()
        painel = indicadores.calcular(self.vila.id, hoje - timedelta(days=29), hoje)
        # Passado: 42 retiradas + 3 dos "esgotou", 11 expiradas, 5 canceladas.
        # Hoje: 2 retiradas (iogurte, pão), 1 expirada (requeijão), 1 cancelada (iogurte).
        self.assertEqual(painel["encerradas"],
                         {"total": 65, "retiradas": 47, "expiradas": 12, "canceladas": 6})
        self.assertEqual(painel["bloqueados"]["recusas"], 4)
        self.assertGreater(painel["perda_unidades"], 0)
        self.assertEqual(Oferta.objects.filter(estado="encerrada").count(), 7)
