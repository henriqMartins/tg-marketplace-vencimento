"""
Testes da API do consumidor (etapa 8, grupo B do contrato): vitrine, detalhe,
reservar, minhas reservas, ver e cancelar a própria reserva. E o CORS.

As rotas usam o relógio REAL (não dá para informar "agora" pela internet), então
as ofertas daqui são criadas em volta de agora().

Rodar (dentro de backend/):  python manage.py test ofertas.test_api_consumidor
"""
import math
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token

from . import servico
from .models import Loja, Oferta, Pedido, Produto, Recusa, Reserva

# Rio Preto: loja perto do consumidor, loja longe; consumidor no meio do bairro.
PERTO = (Decimal("-20.811300"), Decimal("-49.375800"))
LONGE = (Decimal("-20.850000"), Decimal("-49.400000"))
CONSUMIDOR = (-20.819700, -49.379400)


def haversine_python(lat1, lng1, lat2, lng2):
    """A mesma conta do SQL, em Python, só para conferir o resultado do banco."""
    r = 6371.0
    f1, f2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((f2 - f1) / 2) ** 2
         + math.cos(f1) * math.cos(f2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(a))


class Base(TestCase):

    def setUp(self):
        Usuario = get_user_model()
        self.ana = Usuario.objects.create_user("ana@email.com", email="ana@email.com",
                                               password="x", nome="Ana Souza")
        self.bia = Usuario.objects.create_user("bia@email.com", email="bia@email.com",
                                               password="x", nome="Bia Lima")
        self.agora = timezone.now()
        self.perto = Loja.objects.create(nome="Mercadinho Vila Nova", endereco="Rua das Palmeiras, 410",
                                         latitude=PERTO[0], longitude=PERTO[1])
        self.longe = Loja.objects.create(nome="Empório da Rosa", endereco="Rua B, 2",
                                         latitude=LONGE[0], longitude=LONGE[1])
        self.iogurte = self.nova_oferta(self.perto, "Iogurte natural 170 g", "laticinios")

    def nova_oferta(self, loja, nome, categoria, separado=10, preco="3.14",
                    preco_original="4.49", **mudancas):
        produto = Produto.objects.create(loja=loja, nome=nome, categoria=categoria)
        dados = dict(produto=produto, validade=date(2026, 10, 28),
                     preco_original=Decimal(preco_original), preco=Decimal(preco),
                     separado=separado, livre=separado,
                     inicio=self.agora - timedelta(hours=1),
                     fim=self.agora + timedelta(days=7), janela=timedelta(hours=4))
        dados.update(mudancas)
        return Oferta.objects.create(**dados)

    def como(self, usuario):
        token = Token.objects.get_or_create(user=usuario)[0].key
        return {"Authorization": f"Token {token}"}

    def get(self, url, usuario=None, **params):
        return self.client.get(url, params, headers=self.como(usuario) if usuario else {})

    def post(self, url, corpo=None, usuario=None):
        return self.client.post(url, corpo or {}, content_type="application/json",
                                headers=self.como(usuario) if usuario else {})


class TestVitrine(Base):

    def test_publica_sem_login(self):
        self.assertEqual(self.get("/api/ofertas").status_code, 200)

    def test_formato_do_contrato(self):
        item = self.get("/api/ofertas").json()[0]
        self.assertEqual(item["produto"], {"nome": "Iogurte natural 170 g", "categoria": "laticinios"})
        self.assertEqual(item["loja"]["nome"], "Mercadinho Vila Nova")
        self.assertEqual((item["preco"], item["preco_original"], item["desconto"]),
                         ("3.14", "4.49", 30))                  # dinheiro como texto; desconto em %
        self.assertEqual((item["livre"], item["validade"], item["janela_horas"]),
                         (10, "2026-10-28", 4))
        self.assertEqual(item["fita"], {"cor": "branco", "bimestre": "set–out", "ano": 2026})
        self.assertTrue(item["fim"].endswith("-03:00"))         # horário de Brasília
        self.assertIsNone(item["distancia_km"])                 # sem lat/lng, sem distância

    def test_distancia_por_haversine_e_ordem(self):
        leite = self.nova_oferta(self.longe, "Leite integral 1 L", "leite")
        lista = self.get("/api/ofertas", lat=CONSUMIDOR[0], lng=CONSUMIDOR[1]).json()
        self.assertEqual([o["id"] for o in lista], [self.iogurte.id, leite.id])   # perto primeiro
        esperado = haversine_python(*CONSUMIDOR, float(PERTO[0]), float(PERTO[1]))
        self.assertAlmostEqual(lista[0]["distancia_km"], round(esperado, 1))
        self.assertGreater(lista[1]["distancia_km"], lista[0]["distancia_km"])

    def test_filtros(self):
        self.nova_oferta(self.longe, "Presunto 200 g", "frios", preco="2.00", preco_original="4.00")
        self.assertEqual([o["produto"]["nome"] for o in
                          self.get("/api/ofertas", categoria="frios").json()], ["Presunto 200 g"])
        self.assertEqual([o["desconto"] for o in
                          self.get("/api/ofertas", faixa_desconto="50mais").json()], [50])
        self.assertEqual([o["produto"]["nome"] for o in
                          self.get("/api/ofertas", q="iogurte").json()], ["Iogurte natural 170 g"])

    def test_filtro_invalido_400(self):
        self.assertEqual(self.get("/api/ofertas", categoria="bebidas").status_code, 400)
        self.assertEqual(self.get("/api/ofertas", lat="abc", lng="1").status_code, 400)

    def test_livre_ja_desconta_reservas_vencidas_nao_processadas(self):
        # Reserva de 3 que venceu há 1 h e ninguém processou ainda: o banco diz livre 7,
        # mas a vitrine já mostra 10 (regra 6). Só leitura: o banco continua 7.
        Oferta.objects.filter(pk=self.iogurte.pk).update(livre=7)
        pedido = Pedido.objects.create(cliente=self.ana, loja=self.perto, codigo="123456",
                                       criado_em=self.agora - timedelta(hours=5))
        Reserva.objects.create(oferta=self.iogurte, numero=1, loja=self.perto, consumidor=self.ana,
                               pedido_retirada=pedido, quantidade=3, pedido=3, codigo="123456",
                               criada_em=self.agora - timedelta(hours=5),
                               expira_em=self.agora - timedelta(hours=1))
        self.assertEqual(self.get("/api/ofertas").json()[0]["livre"], 10)
        self.iogurte.refresh_from_db()
        self.assertEqual(self.iogurte.livre, 7)

    def test_esgotada_nao_aparece_mas_o_detalhe_responde(self):
        Oferta.objects.filter(pk=self.iogurte.pk).update(livre=0, ajustado=10)
        self.assertEqual(self.get("/api/ofertas").json(), [])
        detalhe = self.get(f"/api/ofertas/{self.iogurte.id}").json()
        self.assertEqual(detalhe["livre"], 0)

    def test_encerrada_nao_aparece_e_detalhe_diz_encerrada(self):
        Oferta.objects.filter(pk=self.iogurte.pk).update(
            estado="encerrada", livre=0, perda=10)
        self.assertEqual(self.get("/api/ofertas").json(), [])
        detalhe = self.get(f"/api/ofertas/{self.iogurte.id}").json()
        self.assertEqual((detalhe["estado"], detalhe["livre"]), ("encerrada", 0))

    def test_detalhe_inexistente_404(self):
        r = self.get("/api/ofertas/999999")
        self.assertEqual((r.status_code, r.json()["codigo"]), (404, "nao_encontrada"))


class TestReservar(Base):

    def url(self):
        return f"/api/ofertas/{self.iogurte.id}/reservas"

    def test_sem_login_401(self):
        self.assertEqual(self.post(self.url(), {"pedido": 1}).status_code, 401)

    def test_confirmada(self):
        r = self.post(self.url(), {"pedido": 2}, self.ana)
        self.assertEqual(r.status_code, 201)
        corpo = r.json()
        self.assertEqual(corpo["status"], "confirmada")
        reserva = corpo["reserva"]
        self.assertEqual((reserva["quantidade"], reserva["pedido"], reserva["estado"]),
                         (2, 2, "reservada"))
        self.assertRegex(reserva["codigo"], r"^[0-9]{6}$")
        self.assertEqual((reserva["total"], reserva["economia"]), ("6.28", "2.70"))
        self.assertEqual(reserva["oferta"]["loja"]["nome"], "Mercadinho Vila Nova")

    def test_parcial_e_sucesso(self):
        r = self.post(self.url(), {"pedido": 15}, self.ana)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["status"], "parcial")
        self.assertEqual(r.json()["reserva"]["quantidade"], 10)

    def test_recusada_409_e_grava_recusa(self):
        self.post(self.url(), {"pedido": 10}, self.ana)
        r = self.post(self.url(), {"pedido": 3}, self.bia)
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json(), {"status": "recusada", "pedido": 3,
                                    "erro": "Esgotou agora há pouco", "codigo": "esgotada"})
        self.assertEqual(Recusa.objects.get().consumidor, self.bia)

    def test_pedido_invalido_400(self):
        for pedido in (0, -1, "dois", None):
            with self.subTest(pedido=pedido):
                r = self.post(self.url(), {"pedido": pedido}, self.ana)
                self.assertEqual((r.status_code, r.json()["codigo"]), (400, "pedido_invalido"))

    def test_oferta_encerrada_409(self):
        Oferta.objects.filter(pk=self.iogurte.pk).update(estado="encerrada", livre=0, perda=10)
        r = self.post(self.url(), {"pedido": 1}, self.ana)
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "oferta_encerrada"))

    def test_oferta_inexistente_404(self):
        r = self.post("/api/ofertas/999999/reservas", {"pedido": 1}, self.ana)
        self.assertEqual(r.status_code, 404)


class TestMinhasReservas(Base):

    def setUp(self):
        super().setUp()
        self.minha = servico.reservar(self.iogurte.id, self.ana, 2)
        self.da_bia = servico.reservar(self.iogurte.id, self.bia, 1)

    def test_so_as_proprias(self):
        lista = self.get("/api/minhas-reservas", self.ana, estado="ativa").json()
        self.assertEqual([r["id"] for r in lista], [self.minha.id])

    def test_reserva_de_outra_pessoa_404(self):
        # 404 e não 403: não confirma nem que a reserva existe.
        self.assertEqual(self.get(f"/api/reservas/{self.da_bia.id}", self.ana).status_code, 404)
        self.assertEqual(self.post(f"/api/reservas/{self.da_bia.id}/cancelar",
                                   usuario=self.ana).status_code, 404)

    def test_ver_a_propria_traz_o_codigo_completo(self):
        r = self.get(f"/api/reservas/{self.minha.id}", self.ana).json()
        self.assertEqual(r["codigo"], self.minha.codigo)

    def test_cancelar_a_propria(self):
        r = self.post(f"/api/reservas/{self.minha.id}/cancelar", usuario=self.ana)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["estado"], "cancelada")
        self.assertIsNotNone(r.json()["encerrada_em"])
        self.iogurte.refresh_from_db()
        self.assertEqual(self.iogurte.livre, 9)                  # 10 - 1 (só a da Bia segue)

    def test_cancelar_duas_vezes_409(self):
        self.post(f"/api/reservas/{self.minha.id}/cancelar", usuario=self.ana)
        r = self.post(f"/api/reservas/{self.minha.id}/cancelar", usuario=self.ana)
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "nao_ativa"))

    def test_leitura_expira_a_vencida_antes_de_responder(self):
        # A reserva venceu e ninguém processou: ao ler, a tela já recebe "expirada".
        Reserva.objects.filter(pk=self.minha.pk).update(
            expira_em=self.agora - timedelta(minutes=1))
        r = self.get(f"/api/reservas/{self.minha.id}", self.ana).json()
        self.assertEqual(r["estado"], "expirada")
        self.assertEqual(self.get("/api/minhas-reservas", self.ana, estado="ativa").json(), [])
        encerradas = self.get("/api/minhas-reservas", self.ana, estado="encerrada").json()
        self.assertEqual([x["id"] for x in encerradas], [self.minha.id])

    def test_estado_invalido_400(self):
        r = self.get("/api/minhas-reservas", self.ana, estado="todas")
        self.assertEqual(r.status_code, 400)


@override_settings(CORS_ALLOWED_ORIGINS=["http://localhost:5173"])
class TestCors(Base):

    def preflight(self, origem):
        # O navegador pergunta antes ("posso?") com um OPTIONS.
        return self.client.options("/api/ofertas", headers={
            "Origin": origem, "Access-Control-Request-Method": "GET"})

    def test_frontend_autorizado(self):
        r = self.preflight("http://localhost:5173")
        self.assertEqual(r.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")

    def test_outro_site_nao_autorizado(self):
        r = self.preflight("https://site-qualquer.com")
        self.assertNotIn("Access-Control-Allow-Origin", r.headers)
