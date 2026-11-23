"""
Testes das rotas do grupo I (parceria, etapa 14). A BrasilAPI é SIMULADA: nenhum
teste usa rede (ver test_cnpj.py para a simulação da urlopen; aqui, a função
cnpj.consultar inteira é trocada).

Rodar (dentro de backend/):  python manage.py test parceria
"""
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.authtoken.models import Token

from .models import EstadoInteresse, Interesse

Usuario = get_user_model()


class BaseParceria(TestCase):
    def setUp(self):
        self.marcos = self.pessoa("marcos@example.com", "Marcos Lima")
        self.equipe = self.pessoa("equipe@example.com", "Equipe", is_staff=True)

    def pessoa(self, email, nome, **extras):
        u = Usuario.objects.create_user(username=email, email=email, password="senha-boa-123",
                                        nome=nome, **extras)
        u.token = Token.objects.create(user=u).key
        return u

    def chamar(self, metodo, url, quem=None, corpo=None):
        extras = {"HTTP_AUTHORIZATION": f"Token {quem.token}"} if quem else {}
        return getattr(self.client, metodo)(url, corpo, content_type="application/json",
                                            **extras)

    def pedir(self, quem=None, **mudancas):
        corpo = {"nome_mercado": "Mercearia São Jorge", "cidade": "São José do Rio Preto",
                 "telefone": "(17) 99999-0000", "mensagem": "Abrimos às 7h"}
        corpo.update(mudancas)
        return self.chamar("post", "/api/interesses", quem or self.marcos, corpo)


class TestPedirParceria(BaseParceria):
    def test_cria_interesse_novo(self):
        r = self.pedir()
        self.assertEqual(r.status_code, 201)
        corpo = r.json()
        self.assertEqual(corpo["estado"], "novo")
        self.assertEqual(corpo["telefone"], "17999990000")       # só dígitos
        self.assertEqual(corpo["pessoa"], {"nome": "Marcos Lima", "email": "marcos@example.com"})
        self.assertIsNone(corpo["loja_id"])
        self.assertTrue(corpo["criado_em"].endswith("-03:00"))

    def test_campo_obrigatorio(self):
        for campo in ("nome_mercado", "cidade", "telefone"):
            with self.subTest(campo=campo):
                r = self.pedir(**{campo: "  "})
                self.assertEqual(r.status_code, 400)
                self.assertEqual(r.json()["codigo"], "campo_obrigatorio")
                self.assertEqual(r.json()["campo"], campo)
        self.assertEqual(Interesse.objects.count(), 0)

    def test_mensagem_e_opcional(self):
        self.assertEqual(self.pedir(mensagem=None).status_code, 201)

    def test_um_em_aberto_por_pessoa(self):
        self.assertEqual(self.pedir().status_code, 201)
        r = self.pedir(nome_mercado="Outro")
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()["codigo"], "interesse_em_aberto")
        # "em conversa" também conta como em aberto
        Interesse.objects.update(estado=EstadoInteresse.EM_CONVERSA)
        self.assertEqual(self.pedir().status_code, 409)

    def test_depois_de_descartado_pode_pedir_de_novo(self):
        self.pedir()
        Interesse.objects.update(estado=EstadoInteresse.DESCARTADO, motivo_descarte="x")
        self.assertEqual(self.pedir().status_code, 201)
        self.assertEqual(Interesse.objects.count(), 2)

    def test_trava_do_banco_segura_o_segundo_em_aberto(self):
        # Mesmo se o "if" do serviço for driblado (dois pedidos no mesmo instante),
        # a restrição única parcial recusa o segundo em aberto.
        Interesse.objects.create(pessoa=self.marcos, nome_mercado="A", cidade="B", telefone="1")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Interesse.objects.create(pessoa=self.marcos, nome_mercado="C", cidade="D",
                                     telefone="2", estado=EstadoInteresse.EM_CONVERSA)

    def test_sem_login_401(self):
        r = self.client.post("/api/interesses", {}, content_type="application/json")
        self.assertEqual(r.status_code, 401)


class TestEu(BaseParceria):
    def eu(self, quem):
        return self.chamar("get", "/api/eu", quem).json()

    def test_plataforma(self):
        self.assertFalse(self.eu(self.marcos)["plataforma"])
        self.assertTrue(self.eu(self.equipe)["plataforma"])

    def test_interesse_em_aberto_ou_null(self):
        self.assertIsNone(self.eu(self.marcos)["interesse"])
        enviado = self.pedir().json()
        interesse = self.eu(self.marcos)["interesse"]
        # Pedido 5 do front: o Interesse inteiro, igual ao que o POST devolveu (A6 em leitura).
        self.assertEqual(interesse, enviado)
        self.assertEqual((interesse["nome_mercado"], interesse["cidade"], interesse["telefone"]),
                         ("Mercearia São Jorge", "São José do Rio Preto", "17999990000"))
        self.assertTrue(interesse["criado_em"].endswith("-03:00"))
        Interesse.objects.update(estado=EstadoInteresse.DESCARTADO, motivo_descarte="x")
        self.assertIsNone(self.eu(self.marcos)["interesse"])

    def test_login_tambem_traz_os_campos(self):
        r = self.client.post("/api/auth/login",
                             {"email": "equipe@example.com", "senha": "senha-boa-123"},
                             content_type="application/json")
        self.assertTrue(r.json()["usuario"]["plataforma"])


class TestInteressesDaPlataforma(BaseParceria):
    URL = "/api/plataforma/interesses"

    def setUp(self):
        super().setUp()
        self.id = self.pedir().json()["id"]

    def mudar(self, corpo, quem=None):
        return self.chamar("patch", f"{self.URL}/{self.id}", quem or self.equipe, corpo)

    def test_so_a_equipe(self):
        self.assertEqual(self.chamar("get", self.URL, self.marcos).status_code, 403)
        self.assertEqual(self.mudar({"estado": "em_conversa"}, self.marcos).status_code, 403)
        self.assertEqual(self.client.get(self.URL).status_code, 401)
        self.assertEqual(Interesse.objects.get().estado, "novo")

    def test_lista_e_filtra_por_estado(self):
        ana = self.pessoa("ana@example.com", "Ana")
        outro = self.pedir(ana, nome_mercado="Empório da Ana").json()["id"]
        self.mudar({"estado": "em_conversa"})
        todos = self.chamar("get", self.URL, self.equipe).json()
        self.assertEqual([i["id"] for i in todos], [outro, self.id])      # mais recente primeiro
        novos = self.chamar("get", self.URL + "?estado=novo", self.equipe).json()
        self.assertEqual([i["id"] for i in novos], [outro])
        r = self.chamar("get", self.URL + "?estado=qualquer", self.equipe)
        self.assertEqual(r.json()["codigo"], "estado_invalido")

    def test_novo_para_em_conversa_para_descartado(self):
        r = self.mudar({"estado": "em_conversa"})
        self.assertEqual((r.status_code, r.json()["estado"]), (200, "em_conversa"))
        r = self.mudar({"estado": "descartado", "motivo": "Não vende embalados"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["motivo_descarte"], "Não vende embalados")

    def test_descartar_exige_motivo(self):
        r = self.mudar({"estado": "descartado", "motivo": " "})
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "campo_obrigatorio"))
        self.assertEqual(Interesse.objects.get().estado, "novo")

    def test_mudancas_proibidas(self):
        for estado in ("novo", "virou_loja", "qualquer", None):
            with self.subTest(estado=estado):
                r = self.mudar({"estado": estado})
                self.assertEqual((r.status_code, r.json()["codigo"]), (400, "estado_invalido"))
        self.mudar({"estado": "em_conversa"})
        self.assertEqual(self.mudar({"estado": "em_conversa"}).status_code, 400)   # já está
        self.mudar({"estado": "descartado", "motivo": "x"})
        self.assertEqual(self.mudar({"estado": "em_conversa"}).status_code, 400)   # descartado é fim

    def test_inexistente_404(self):
        r = self.chamar("patch", f"{self.URL}/999999", self.equipe, {"estado": "em_conversa"})
        self.assertEqual(r.status_code, 404)
