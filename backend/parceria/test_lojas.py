"""
Testes da equipe da plataforma (etapa 14, grupo I): consulta de CNPJ, cadastro da
loja com convite e renovação do convite (P2, P3).

A Receita é SIMULADA: a função cnpj.consultar é trocada (nenhum teste usa rede).
A conversão da resposta da BrasilAPI é testada à parte, em test_cnpj.py.

Rodar (dentro de backend/):  python manage.py test parceria
"""
from datetime import timedelta
from unittest import mock

from django.utils import timezone

from ofertas.models import Loja, Papel, Vinculo

from . import cnpj as receita
from . import servico
from .models import Convite, EstadoConvite, EstadoInteresse, Interesse
from .test_api import BaseParceria

CNPJ = "11222333000181"
OUTRO_CNPJ = "33000167000101"


def consulta(ativa=True, **mudancas):
    """ConsultaCnpj já normalizada, como cnpj.consultar devolveria."""
    c = {"cnpj": CNPJ, "razao_social": "MERCEARIA SAO JORGE LTDA",
         "nome_fantasia": "MERCEARIA SAO JORGE", "situacao": "ATIVA" if ativa else "BAIXADA",
         "ativa": ativa, "cnae_principal": {"codigo": "4712100", "descricao": "Minimercados"},
         "alimentar": True,
         "endereco": {"logradouro": "RUA DAS PALMEIRAS", "numero": "410", "bairro": "BOA VISTA",
                      "municipio": "SAO JOSE DO RIO PRETO", "uf": "SP", "cep": "15025000"}}
    c.update(mudancas)
    return c


def receita_responde(valor=None, erro=None):
    """Receita simulada: devolve `valor` ou levanta `erro`."""
    return mock.patch.object(receita, "consultar", return_value=valor, side_effect=erro)


class TestConsultaCnpj(BaseParceria):
    def url(self, cnpj=CNPJ):
        return f"/api/plataforma/cnpj/{cnpj}"

    def test_ativa(self):
        with receita_responde(consulta()) as falso:
            r = self.chamar("get", self.url(), self.equipe)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["ativa"])
        falso.assert_called_once_with(CNPJ)

    def test_mascara_e_tirada(self):
        with receita_responde(consulta()) as falso:
            r = self.chamar("get", self.url("11.222.333-0001-81"), self.equipe)
        self.assertEqual(r.status_code, 200)
        falso.assert_called_once_with(CNPJ)

    def test_inativa_so_informa_na_consulta(self):
        with receita_responde(consulta(ativa=False)):
            r = self.chamar("get", self.url(), self.equipe)
        self.assertEqual((r.status_code, r.json()["ativa"]), (200, False))

    def test_digito_errado_nem_chama_a_receita(self):
        with receita_responde(consulta()) as falso:
            r = self.chamar("get", self.url("11222333000182"), self.equipe)
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "cnpj_invalido"))
        falso.assert_not_called()

    def test_nao_encontrado(self):
        with receita_responde(erro=receita.CnpjNaoEncontrado(CNPJ)):
            r = self.chamar("get", self.url(), self.equipe)
        self.assertEqual((r.status_code, r.json()["codigo"]), (404, "cnpj_nao_encontrado"))

    def test_fora_do_ar(self):
        with receita_responde(erro=receita.ReceitaIndisponivel("lenta")):
            r = self.chamar("get", self.url(), self.equipe)
        self.assertEqual((r.status_code, r.json()["codigo"]), (503, "consulta_indisponivel"))


class BaseCadastro(BaseParceria):
    URL = "/api/plataforma/lojas"

    def corpo(self, **mudancas):
        c = {"cnpj": "11.222.333/0001-81", "nome": "Mercearia São Jorge",
             "endereco": "Rua das Palmeiras, 410 · Boa Vista", "telefone": "(17) 99999-0000",
             "email_responsavel": " Marcos@Example.com "}
        c.update(mudancas)
        return {k: v for k, v in c.items() if v is not ...}

    def cadastrar(self, valor=None, erro=None, **mudancas):
        valor = consulta() if valor is None and erro is None else valor
        with receita_responde(valor, erro):
            return self.chamar("post", self.URL, self.equipe, self.corpo(**mudancas))


class TestCadastrarLoja(BaseCadastro):
    def test_cria_loja_com_padroes_e_convite(self):
        antes = timezone.now()
        r = self.cadastrar()
        self.assertEqual(r.status_code, 201)
        corpo = r.json()
        loja = Loja.objects.get()
        self.assertEqual(loja.cnpj, CNPJ)
        self.assertTrue(loja.cnpj_verificado)
        self.assertEqual(loja.telefone, "17999990000")
        self.assertEqual((loja.janela_padrao, loja.margem_fim, loja.antecedencia_aviso_dias),
                         (timedelta(hours=4), timedelta(days=1), 10))
        self.assertIsNone(loja.latitude)                       # coordenadas opcionais
        self.assertEqual(corpo["loja"]["responsavel"], None)
        self.assertEqual(corpo["loja"]["convite"]["estado"], "pendente")
        # Convite: e-mail em minúsculas, 7 dias, código longo e aleatório.
        convite = Convite.objects.get()
        self.assertEqual(corpo["convite"]["codigo"], convite.codigo)
        self.assertEqual(corpo["convite"]["email"], "marcos@example.com")
        self.assertGreaterEqual(len(convite.codigo), 32)
        self.assertAlmostEqual(convite.expira_em - antes, timedelta(days=7),
                               delta=timedelta(minutes=1))
        # Loja sem responsável não aparece na vitrine (não tem oferta).
        self.assertEqual(self.client.get("/api/ofertas").json(), [])

    def test_com_coordenadas(self):
        r = self.cadastrar(latitude=-20.8113, longitude=-49.3758)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(float(Loja.objects.get().latitude), -20.8113)

    def test_coordenadas_pela_regra_da_l14(self):
        r = self.cadastrar(latitude=-20.8)
        self.assertEqual(r.json()["codigo"], "coordenadas_incompletas")
        r = self.cadastrar(latitude=-200, longitude=10)
        self.assertEqual(r.json()["codigo"], "coordenadas_invalidas")
        self.assertEqual(Loja.objects.count(), 0)

    def test_vindo_de_um_interesse(self):
        id_ = self.pedir().json()["id"]
        r = self.cadastrar(interesse_id=id_)
        self.assertEqual(r.status_code, 201)
        interesse = Interesse.objects.get()
        self.assertEqual(interesse.estado, EstadoInteresse.VIROU_LOJA)
        self.assertEqual(interesse.loja_id, r.json()["loja"]["id"])

    def test_interesse_fora_de_aberto_ou_inexistente(self):
        id_ = self.pedir().json()["id"]
        Interesse.objects.update(estado=EstadoInteresse.DESCARTADO, motivo_descarte="x")
        r = self.cadastrar(interesse_id=id_)
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "estado_invalido"))
        self.assertEqual(self.cadastrar(interesse_id=999999).status_code, 404)
        self.assertEqual(self.cadastrar(interesse_id="abc").status_code, 404)
        self.assertEqual(Loja.objects.count(), 0)

    def test_inativa_bloqueia(self):
        r = self.cadastrar(consulta(ativa=False))
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "cnpj_inativo"))
        self.assertIn("BAIXADA", r.json()["erro"])
        self.assertEqual(Loja.objects.count(), 0)

    def test_nao_encontrado_bloqueia(self):
        r = self.cadastrar(erro=receita.CnpjNaoEncontrado(CNPJ))
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "cnpj_nao_encontrado"))
        self.assertEqual(Loja.objects.count(), 0)

    def test_receita_fora_do_ar_cria_nao_verificada(self):
        r = self.cadastrar(erro=receita.ReceitaIndisponivel("lenta"))
        self.assertEqual(r.status_code, 201)
        self.assertFalse(r.json()["loja"]["cnpj_verificado"])
        self.assertEqual(Convite.objects.count(), 1)

    def test_digito_errado_nem_chama_a_receita(self):
        with receita_responde(consulta()) as falso:
            r = self.chamar("post", self.URL, self.equipe, self.corpo(cnpj="11222333000182"))
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "cnpj_invalido"))
        falso.assert_not_called()

    def test_cnpj_repetido(self):
        self.cadastrar()
        r = self.cadastrar()
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "cnpj_ja_cadastrado"))
        self.assertEqual(Loja.objects.count(), 1)

    def test_campos(self):
        casos = [({"email_responsavel": "sem-arroba"}, "email_invalido"),
                 ({"nome": " "}, "campo_obrigatorio"),
                 ({"endereco": ...}, "campo_obrigatorio"),
                 ({"telefone": ""}, "campo_obrigatorio")]
        for mudanca, codigo in casos:
            with self.subTest(mudanca=mudanca):
                r = self.cadastrar(**mudanca)
                self.assertEqual((r.status_code, r.json()["codigo"]), (400, codigo))
        self.assertEqual(Loja.objects.count(), 0)

    def test_tudo_ou_nada(self):
        # Se o convite falhar depois de a loja ser criada, a loja também é desfeita.
        id_ = self.pedir().json()["id"]
        with receita_responde(consulta()), \
                mock.patch.object(servico, "_gerar_convite", side_effect=RuntimeError("falhou")):
            with self.assertRaises(RuntimeError):
                servico.cadastrar_loja(self.corpo(interesse_id=id_))
        self.assertEqual(Loja.objects.count(), 0)
        self.assertEqual(Interesse.objects.get().estado, EstadoInteresse.NOVO)

    def test_so_a_equipe(self):
        loja = Loja.objects.create(nome="X", endereco="Y")
        for metodo, url in (("get", self.URL), ("post", self.URL),
                            ("get", f"/api/plataforma/cnpj/{CNPJ}"),
                            ("post", f"{self.URL}/{loja.id}/convite")):
            with self.subTest(rota=f"{metodo} {url}"), receita_responde(consulta()):
                self.assertEqual(self.chamar(metodo, url, self.marcos, self.corpo()).status_code,
                                 403)
                self.assertEqual(getattr(self.client, metodo)(url).status_code, 401)
        self.assertEqual(Loja.objects.count(), 1)


class TestLojasEConvites(BaseCadastro):
    def setUp(self):
        super().setUp()
        self.loja_id = self.cadastrar().json()["loja"]["id"]
        self.codigo = Convite.objects.get().codigo

    def lojas(self):
        return self.chamar("get", self.URL, self.equipe).json()

    def renovar(self, loja_id=None):
        return self.chamar("post", f"{self.URL}/{loja_id or self.loja_id}/convite", self.equipe)

    def test_lista_com_estado_do_convite(self):
        antiga = Loja.objects.create(nome="Mercadinho antigo", endereco="Rua A")   # demonstração
        lista = self.lojas()
        self.assertEqual([l["id"] for l in lista], [antiga.id, self.loja_id])   # mais recente 1º
        self.assertIsNone(lista[0]["convite"])
        self.assertIsNone(lista[0]["cnpj"])
        self.assertEqual(lista[1]["convite"]["estado"], "pendente")
        Convite.objects.update(expira_em=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.lojas()[1]["convite"]["estado"], "vencido")

    def test_renovar_invalida_o_anterior(self):
        r = self.renovar()
        self.assertEqual(r.status_code, 201)
        novo = r.json()["codigo"]
        self.assertNotEqual(novo, self.codigo)
        self.assertEqual(r.json()["email"], "marcos@example.com")
        self.assertEqual(Convite.objects.get(codigo=self.codigo).estado,
                         EstadoConvite.SUBSTITUIDO)
        self.assertEqual(Convite.objects.filter(estado=EstadoConvite.PENDENTE).count(), 1)
        self.assertEqual(self.lojas()[0]["convite"]["estado"], "pendente")

    def test_renovar_convite_vencido(self):
        Convite.objects.update(expira_em=timezone.now() - timedelta(days=1))
        self.assertEqual(self.renovar().status_code, 201)
        self.assertEqual(self.lojas()[0]["convite"]["estado"], "pendente")

    def test_loja_ja_ativa(self):
        Vinculo.objects.create(usuario=self.marcos, loja_id=self.loja_id, papel=Papel.RESPONSAVEL)
        r = self.renovar()
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "loja_ja_ativa"))
        self.assertEqual(self.lojas()[0]["responsavel"],
                         {"nome": "Marcos Lima", "email": "marcos@example.com"})

    def test_loja_sem_convite_e_inexistente(self):
        antiga = Loja.objects.create(nome="Mercadinho antigo", endereco="Rua A")
        self.assertEqual(self.renovar(antiga.id).json()["codigo"], "sem_convite")
        self.assertEqual(self.renovar(999999).status_code, 404)
