"""
Testes das configurações de produção (Render + Neon).

  - o Render preenche RENDER_EXTERNAL_HOSTNAME (xxx.onrender.com): ele entra no
    ALLOWED_HOSTS, senão o Django responderia 400 a todos os pedidos;
  - o Render recebe o HTTPS e repassa em HTTP: o cabeçalho X-Forwarded-Proto diz
    ao Django que o pedido original era seguro;
  - a conexão com o banco é reaproveitada por 60 s e conferida antes de usar.

Rodar (dentro de backend/):  python manage.py test config.test_producao
"""
from django.conf import settings
from django.test import RequestFactory, SimpleTestCase

from config.settings import hosts_permitidos


class TestHostsPermitidos(SimpleTestCase):

    def test_sem_render_usa_so_a_lista_do_ambiente(self):
        self.assertEqual(hosts_permitidos({"DJANGO_ALLOWED_HOSTS": "localhost, 127.0.0.1"}),
                         ["localhost", "127.0.0.1"])

    def test_render_soma_o_proprio_endereco(self):
        ambiente = {"DJANGO_ALLOWED_HOSTS": "api.exemplo.com",
                    "RENDER_EXTERNAL_HOSTNAME": "tg-api.onrender.com"}
        self.assertEqual(hosts_permitidos(ambiente), ["api.exemplo.com", "tg-api.onrender.com"])

    def test_render_sozinho_basta(self):
        self.assertEqual(hosts_permitidos({"RENDER_EXTERNAL_HOSTNAME": "tg-api.onrender.com"}),
                         ["tg-api.onrender.com"])

    def test_nao_repete(self):
        ambiente = {"DJANGO_ALLOWED_HOSTS": "tg-api.onrender.com",
                    "RENDER_EXTERNAL_HOSTNAME": "tg-api.onrender.com"}
        self.assertEqual(hosts_permitidos(ambiente), ["tg-api.onrender.com"])


class TestAtrasDoProxyDoRender(SimpleTestCase):

    def test_https_do_render_e_reconhecido(self):
        pedido = RequestFactory().get("/health", HTTP_X_FORWARDED_PROTO="https")
        self.assertTrue(pedido.is_secure())

    def test_sem_o_cabecalho_continua_http(self):
        self.assertFalse(RequestFactory().get("/health").is_secure())


class TestConexaoComOBanco(SimpleTestCase):

    def test_reaproveita_e_confere_a_conexao(self):
        banco = settings.DATABASES["default"]
        self.assertEqual(banco["CONN_MAX_AGE"], 60)
        self.assertTrue(banco["CONN_HEALTH_CHECKS"])
