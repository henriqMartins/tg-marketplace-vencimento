"""
Testes do acesso (etapa 6, grupo A do contrato): conta, login, sair, "eu"
e os porteiros por papel (EhDaLoja, EhResponsavel).

O "crachá" é o token do DRF: vai no cabeçalho  Authorization: Token <chave>.
Sem crachá numa rota protegida -> 401; com crachá, mas sem papel -> 403.

Rodar (dentro de backend/):  python manage.py test contas
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from ofertas.models import Loja, Vinculo

from .permissoes import EhDaLoja, EhResponsavel

Usuario = get_user_model()


def cabecalho(token):
    return {"Authorization": f"Token {token}"}


class TestCriarConta(TestCase):
    URL = "/api/auth/conta"

    def dados(self, **mudancas):
        d = {"nome": "Ana Souza", "email": "ana@email.com", "senha": "senha-boa-123",
             "aceite_termos": True}
        d.update(mudancas)
        return d

    def test_cria_conta_e_devolve_cracha(self):
        r = self.client.post(self.URL, self.dados(), content_type="application/json")
        self.assertEqual(r.status_code, 201)
        corpo = r.json()
        self.assertEqual(corpo["usuario"]["nome"], "Ana Souza")
        self.assertEqual(corpo["usuario"]["vinculos"], [])           # sem vínculo = consumidor
        self.assertTrue(Token.objects.filter(key=corpo["token"]).exists())

    def test_email_repetido_mesmo_com_maiuscula(self):
        self.client.post(self.URL, self.dados(), content_type="application/json")
        r = self.client.post(self.URL, self.dados(email="ANA@Email.com"),
                             content_type="application/json")
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "email_em_uso"))

    def test_senha_curta(self):
        r = self.client.post(self.URL, self.dados(senha="1234567"), content_type="application/json")
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "senha_curta"))

    def test_sem_aceite_dos_termos(self):
        r = self.client.post(self.URL, self.dados(aceite_termos=False),
                             content_type="application/json")
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "termos"))

    def test_email_invalido(self):
        r = self.client.post(self.URL, self.dados(email="ana-sem-arroba"),
                             content_type="application/json")
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "email_invalido"))

    def test_senha_nao_fica_gravada_como_texto(self):
        self.client.post(self.URL, self.dados(), content_type="application/json")
        ana = Usuario.objects.get(email="ana@email.com")
        self.assertNotEqual(ana.password, "senha-boa-123")             # guarda só o "resumo" (hash)
        self.assertTrue(ana.check_password("senha-boa-123"))


class TestLoginSairEu(TestCase):

    def setUp(self):
        self.ana = Usuario.objects.create_user(
            username="ana@email.com", email="ana@email.com", password="senha-boa-123",
            nome="Ana Souza")
        self.loja = Loja.objects.create(nome="Mercadinho Vila Nova", endereco="Rua das Palmeiras, 410")

    def login(self, email="ana@email.com", senha="senha-boa-123"):
        return self.client.post("/api/auth/login", {"email": email, "senha": senha},
                                content_type="application/json")

    def test_login_certo(self):
        r = self.login(email="Ana@Email.com")                          # maiúscula não importa
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["usuario"]["email"], "ana@email.com")

    def test_login_errado_mesma_mensagem_para_email_e_senha(self):
        # Não conta se o e-mail existe: os dois erros são iguais.
        senha_errada = self.login(senha="errada-123")
        email_errado = self.login(email="ninguem@email.com")
        for r in (senha_errada, email_errado):
            self.assertEqual((r.status_code, r.json()["codigo"]), (400, "credenciais_invalidas"))

    def test_eu_sem_cracha_401(self):
        r = self.client.get("/api/eu")
        self.assertEqual((r.status_code, r.json()["codigo"]), (401, "nao_autenticado"))

    def test_eu_traz_os_vinculos(self):
        Vinculo.objects.create(usuario=self.ana, loja=self.loja, papel="responsavel")
        token = self.login().json()["token"]
        r = self.client.get("/api/eu", headers=cabecalho(token))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["vinculos"], [
            {"loja": {"id": self.loja.id, "nome": "Mercadinho Vila Nova"}, "papel": "responsavel"}])

    def test_sair_invalida_o_cracha(self):
        token = self.login().json()["token"]
        self.assertEqual(self.client.post("/api/auth/sair", headers=cabecalho(token)).status_code, 204)
        self.assertEqual(self.client.get("/api/eu", headers=cabecalho(token)).status_code, 401)


# ---------------------------------------------------------------- porteiros

class RotaDaLoja(APIView):
    """Rota de teste: só existe aqui, para exercitar os porteiros."""
    permission_classes = [EhDaLoja]

    def get(self, request, loja_id):
        return Response({"ok": True})


class RotaDoResponsavel(RotaDaLoja):
    permission_classes = [EhResponsavel]


class TestPorteiros(TestCase):

    def setUp(self):
        self.loja = Loja.objects.create(nome="Mercadinho Vila Nova", endereco="Rua A, 1")
        self.outra = Loja.objects.create(nome="Empório da Rosa", endereco="Rua B, 2")
        self.ana = Usuario.objects.create_user("ana", password="x")         # consumidora
        self.carla = Usuario.objects.create_user("carla", password="x")     # funcionária
        self.joao = Usuario.objects.create_user("joao", password="x")       # responsável
        Vinculo.objects.create(usuario=self.carla, loja=self.loja, papel="funcionario")
        Vinculo.objects.create(usuario=self.joao, loja=self.loja, papel="responsavel")

    def status(self, rota, usuario, loja):
        cab = cabecalho(Token.objects.get_or_create(user=usuario)[0].key) if usuario else {}
        request = APIRequestFactory().get("/", headers=cab)
        return rota.as_view()(request, loja_id=loja.id).status_code

    def test_sem_cracha_401(self):
        self.assertEqual(self.status(RotaDaLoja, None, self.loja), 401)

    def test_consumidor_403(self):
        self.assertEqual(self.status(RotaDaLoja, self.ana, self.loja), 403)

    def test_funcionario_entra_na_operacao_mas_nao_no_painel(self):
        self.assertEqual(self.status(RotaDaLoja, self.carla, self.loja), 200)
        self.assertEqual(self.status(RotaDoResponsavel, self.carla, self.loja), 403)

    def test_responsavel_entra_nos_dois(self):
        self.assertEqual(self.status(RotaDaLoja, self.joao, self.loja), 200)
        self.assertEqual(self.status(RotaDoResponsavel, self.joao, self.loja), 200)

    def test_vinculo_de_outra_loja_nao_vale(self):
        self.assertEqual(self.status(RotaDaLoja, self.joao, self.outra), 403)
        self.assertEqual(self.status(RotaDoResponsavel, self.joao, self.outra), 403)
