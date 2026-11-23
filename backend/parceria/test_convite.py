"""
Testes do aceite do convite (etapa 14, grupo I, tela A7): e-mail certo, e-mail
diferente, vencido, usado e renovado (o antigo falha).

Rodar (dentro de backend/):  python manage.py test parceria
"""
from datetime import timedelta

from django.utils import timezone

from ofertas.models import Loja, Papel, Vinculo

from .models import Convite, EstadoConvite
from .test_lojas import BaseCadastro


class TestConvite(BaseCadastro):
    def setUp(self):
        super().setUp()
        self.loja_id = self.cadastrar().json()["loja"]["id"]
        self.codigo = Convite.objects.get().codigo

    def ver(self, quem=None, codigo=None):
        return self.chamar("get", f"/api/convites/{codigo or self.codigo}", quem or self.marcos)

    def aceitar(self, quem=None, codigo=None):
        return self.chamar("post", f"/api/convites/{codigo or self.codigo}/aceitar",
                           quem or self.marcos)

    def test_ver_convite(self):
        r = self.ver()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["loja"], {"nome": "Mercearia São Jorge",
                                            "endereco": "Rua das Palmeiras, 410 · Boa Vista"})
        self.assertEqual(r.json()["email"], "marcos@example.com")
        self.assertTrue(r.json()["expira_em"].endswith("-03:00"))

    def test_aceite_com_email_certo_vira_responsavel(self):
        r = self.aceitar()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["vinculo"], {"loja": {"id": self.loja_id,
                                                        "nome": "Mercearia São Jorge"},
                                               "papel": "responsavel"})
        self.assertTrue(Vinculo.objects.filter(usuario=self.marcos, loja_id=self.loja_id,
                                               papel=Papel.RESPONSAVEL).exists())
        convite = Convite.objects.get()
        self.assertEqual((convite.estado, convite.aceito_por), (EstadoConvite.ACEITO, self.marcos))
        # Agora a loja aparece no "Eu" e nas rotas de responsável.
        eu = self.chamar("get", "/api/eu", self.marcos).json()
        self.assertEqual(eu["vinculos"][0]["papel"], "responsavel")
        r = self.chamar("get", f"/api/lojas/{self.loja_id}/indicadores", self.marcos)
        self.assertEqual(r.status_code, 200)

    def test_email_sem_diferenciar_maiusculas(self):
        Convite.objects.update(email="MARCOS@example.com")
        self.assertEqual(self.aceitar().status_code, 201)

    def test_email_diferente(self):
        ana = self.pessoa("ana@example.com", "Ana")
        self.assertEqual(self.ver(ana).status_code, 200)          # ver pode; aceitar não
        r = self.aceitar(ana)
        self.assertEqual((r.status_code, r.json()["codigo"]), (403, "email_diferente"))
        self.assertEqual(r.json()["email_convite"], "m…@example.com")
        self.assertEqual(Vinculo.objects.count(), 0)
        self.assertEqual(Convite.objects.get().estado, EstadoConvite.PENDENTE)

    def test_vencido(self):
        Convite.objects.update(expira_em=timezone.now() - timedelta(seconds=1))
        for r in (self.ver(), self.aceitar()):
            self.assertEqual((r.status_code, r.json()["codigo"]), (410, "convite_vencido"))
        self.assertEqual(Vinculo.objects.count(), 0)

    def test_usado(self):
        self.aceitar()
        for r in (self.ver(), self.aceitar()):
            self.assertEqual((r.status_code, r.json()["codigo"]), (409, "convite_usado"))
        self.assertEqual(Vinculo.objects.count(), 1)

    def test_renovado_o_antigo_falha_e_o_novo_vale(self):
        novo = self.chamar("post", f"{self.URL}/{self.loja_id}/convite", self.equipe).json()
        r = self.aceitar()
        self.assertEqual((r.status_code, r.json()["codigo"]), (410, "convite_vencido"))
        self.assertEqual(self.aceitar(codigo=novo["codigo"]).status_code, 201)

    def test_ja_vinculado(self):
        Vinculo.objects.create(usuario=self.marcos, loja_id=self.loja_id,
                               papel=Papel.FUNCIONARIO)
        r = self.aceitar()
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "ja_vinculado"))
        self.assertEqual(Convite.objects.get().estado, EstadoConvite.PENDENTE)

    def test_inexistente_e_sem_login(self):
        self.assertEqual(self.ver(codigo="nao-existe").status_code, 404)
        self.assertEqual(self.aceitar(codigo="nao-existe").status_code, 404)
        self.assertEqual(self.client.get(f"/api/convites/{self.codigo}").status_code, 401)
        self.assertEqual(self.client.post(f"/api/convites/{self.codigo}/aceitar").status_code, 401)

    def test_codigo_de_outra_loja_nao_mistura(self):
        with self.subTest("cada convite aponta para a sua loja"):
            outra = self.cadastrar(cnpj="33000167000101", nome="Empório",
                                   email_responsavel="ana@example.com").json()
            ana = self.pessoa("ana@example.com", "Ana")
            codigo_ana = Convite.objects.get(loja_id=outra["loja"]["id"]).codigo
            self.assertEqual(self.aceitar(ana, codigo_ana).json()["vinculo"]["loja"]["id"],
                             outra["loja"]["id"])
            self.assertFalse(Vinculo.objects.filter(usuario=ana, loja_id=self.loja_id).exists())
            self.assertEqual(Loja.objects.count(), 2)
