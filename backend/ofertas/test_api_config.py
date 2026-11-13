"""
Testes da configuração da loja e da equipe (etapa 10b, grupo E do contrato, tela L14).

Leitura: qualquer vínculo com a loja (funcionário ou responsável).
Escrita (PATCH, POST, DELETE): só o responsável — o funcionário recebe 403.

Rodar (dentro de backend/):  python manage.py test ofertas.test_api_config
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model

from . import servico_lotes
from .models import Loja, Papel, Produto, Vinculo
from .test_api_loja import Base as BaseLoja


class Base(BaseLoja):
    """Herda da etapa 9: Carlos (responsável), Joana (funcionária), Rosa (outra loja), Ana e Bia."""

    def patch(self, url, corpo, usuario=None):
        return self.client.patch(url, corpo, content_type="application/json",
                                 headers=self.como(usuario) if usuario else {})

    def delete(self, url, usuario=None):
        return self.client.delete(url, headers=self.como(usuario) if usuario else {})

    def vinculo(self, usuario):
        return Vinculo.objects.get(usuario=usuario, loja=self.perto)


class TestPorteiroDaConfiguracao(Base):
    """Permissão por MÉTODO: na mesma rota, ler é da equipe e mudar é do responsável."""

    def test_sem_login_401(self):
        self.assertEqual(self.get(self.url).status_code, 401)

    def test_consumidor_e_outra_loja_403(self):
        for quem in (self.ana, self.rosa):
            self.assertEqual(self.get(self.url, quem).status_code, 403)
            self.assertEqual(self.get(f"{self.url}/vinculos", quem).status_code, 403)

    def test_funcionario_le_configuracao_e_equipe(self):
        self.assertEqual(self.get(self.url, self.joana).status_code, 200)
        self.assertEqual(self.get(f"{self.url}/vinculos", self.joana).status_code, 200)

    def test_funcionario_nao_altera_nada(self):
        r = self.patch(self.url, {"margem_fim_dias": 2}, self.joana)
        self.assertEqual((r.status_code, r.json()["codigo"]), (403, "sem_permissao"))
        r = self.post(f"{self.url}/vinculos", {"email": "bia@email.com", "papel": "funcionario"},
                      self.joana)
        self.assertEqual(r.status_code, 403)
        r = self.delete(f"{self.url}/vinculos/{self.vinculo(self.carlos).id}", self.joana)
        self.assertEqual(r.status_code, 403)
        self.perto.refresh_from_db()
        self.assertEqual(self.perto.margem_fim, timedelta(days=1))          # nada mudou
        self.assertEqual(Vinculo.objects.filter(loja=self.perto).count(), 2)


class TestLerConfiguracao(Base):

    def test_formato_loja_config(self):
        r = self.get(self.url, self.joana)
        self.assertEqual(r.json(), {
            "id": self.perto.id, "nome": "Mercadinho Vila Nova",
            "endereco": "Rua das Palmeiras, 410",
            "latitude": float(self.perto.latitude), "longitude": float(self.perto.longitude),
            "janela_padrao_horas": 4, "margem_fim_dias": 1, "antecedencia_aviso_dias": 10,
        })

    def test_sem_coordenadas_vem_null(self):
        Loja.objects.filter(pk=self.perto.pk).update(latitude=None, longitude=None)
        corpo = self.get(self.url, self.carlos).json()
        self.assertIsNone(corpo["latitude"])
        self.assertIsNone(corpo["longitude"])


class TestAlterarConfiguracao(Base):

    def test_muda_varios_campos_de_uma_vez(self):
        r = self.patch(self.url, {"janela_padrao_horas": 8, "margem_fim_dias": 0,
                                  "antecedencia_aviso_dias": 15}, self.carlos)
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.json()["janela_padrao_horas"], r.json()["margem_fim_dias"],
                          r.json()["antecedencia_aviso_dias"]), (8, 0, 15))
        self.perto.refresh_from_db()
        self.assertEqual(self.perto.janela_padrao, timedelta(hours=8))
        self.assertEqual(self.perto.margem_fim, timedelta(0))      # 0 é valor, não "vazio"

    def test_campo_ausente_nao_muda(self):
        self.patch(self.url, {"margem_fim_dias": 3}, self.carlos)
        self.perto.refresh_from_db()
        self.assertEqual(self.perto.janela_padrao, timedelta(hours=4))
        self.assertEqual(self.perto.nome, "Mercadinho Vila Nova")

    def test_nome_endereco_e_coordenadas(self):
        r = self.patch(self.url, {"nome": "  Mercadinho Novo  ", "endereco": "Rua C, 3",
                                  "latitude": -20.5, "longitude": -49.25}, self.carlos)
        self.assertEqual(r.status_code, 200)
        self.perto.refresh_from_db()
        self.assertEqual(self.perto.nome, "Mercadinho Novo")         # sem espaços nas pontas
        self.assertEqual(self.perto.latitude, Decimal("-20.5"))

    def test_coordenadas_podem_ser_apagadas_juntas(self):
        r = self.patch(self.url, {"latitude": None, "longitude": None}, self.carlos)
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.json()["latitude"])

    def test_erros_por_campo(self):
        casos = [
            ({"janela_padrao_horas": 3}, "janela_invalida"),
            ({"janela_padrao_horas": "4"}, "janela_invalida"),
            ({"margem_fim_dias": 8}, "margem_invalida"),
            ({"margem_fim_dias": -1}, "margem_invalida"),
            ({"margem_fim_dias": True}, "margem_invalida"),
            ({"antecedencia_aviso_dias": 0}, "antecedencia_invalida"),
            ({"antecedencia_aviso_dias": 31}, "antecedencia_invalida"),
            ({"nome": "   "}, "sem_nome"),
            ({"nome": "x" * 121}, "nome_longo"),
            ({"endereco": ""}, "sem_endereco"),
            ({"endereco": "x" * 256}, "endereco_longo"),
            ({"latitude": -20.5}, "coordenadas_incompletas"),
            ({"latitude": -20.5, "longitude": None}, "coordenadas_incompletas"),
            ({"latitude": 91, "longitude": 0}, "coordenadas_invalidas"),
            ({"latitude": 0, "longitude": -181}, "coordenadas_invalidas"),
            ({"latitude": "-20.5", "longitude": "-49"}, "coordenadas_invalidas"),
        ]
        for corpo, codigo in casos:
            with self.subTest(corpo=corpo):
                r = self.patch(self.url, corpo, self.carlos)
                self.assertEqual((r.status_code, r.json()["codigo"]), (400, codigo))

    def test_com_um_campo_errado_nada_e_gravado(self):
        r = self.patch(self.url, {"margem_fim_dias": 2, "janela_padrao_horas": 5}, self.carlos)
        self.assertEqual(r.status_code, 400)
        self.perto.refresh_from_db()
        self.assertEqual(self.perto.margem_fim, timedelta(days=1))   # a margem certa não entrou

    def test_corpo_que_nao_e_objeto_400(self):
        r = self.patch(self.url, [1, 2], self.carlos)
        self.assertEqual(r.status_code, 400)


class TestAntecedenciaMaiorQueMargem(Base):
    """
    O aviso tem de chegar ANTES do último dia da oferta (decidido 13/11/2026):
    antecedência > margem. Ex.: margem 3 e antecedência 1 -> o aviso chegaria
    depois de a oferta já ter acabado. A loja começa com margem 1 e antecedência 10.
    """

    def conferir(self, corpo, status):
        r = self.patch(self.url, corpo, self.carlos)
        self.assertEqual(r.status_code, status, corpo)
        if status == 400:
            self.assertEqual(r.json()["codigo"], "antecedencia_menor_que_margem")
        return r

    def test_antecedencia_igual_a_margem_400(self):
        self.conferir({"antecedencia_aviso_dias": 1}, 400)          # margem é 1

    def test_um_dia_a_mais_que_a_margem_passa(self):
        self.conferir({"antecedencia_aviso_dias": 2}, 200)

    def test_subir_a_margem_acima_da_antecedencia_400(self):
        self.conferir({"antecedencia_aviso_dias": 5}, 200)
        self.conferir({"margem_fim_dias": 5}, 400)                  # a margem também é barrada
        self.perto.refresh_from_db()
        self.assertEqual(self.perto.margem_fim, timedelta(days=1))  # nada gravado

    def test_os_dois_no_mesmo_pedido_vale_o_par_novo(self):
        self.conferir({"margem_fim_dias": 3, "antecedencia_aviso_dias": 3}, 400)
        self.conferir({"margem_fim_dias": 3, "antecedencia_aviso_dias": 4}, 200)


class TestMudancaValeSoParaNovos(Base):
    """
    Contrato: mudar margem ou antecedência vale só para lotes e ofertas NOVOS.
    Funciona sem código extra porque `fim` e `aviso_em` são GRAVADOS na criação.
    """

    def test_grupo_existente_mantem_o_aviso(self):
        produto = Produto.objects.create(loja=self.perto, nome="Leite 1 L", categoria="leite")
        validade = date.today() + timedelta(days=40)
        _, grupo, _, _ = servico_lotes.registrar_lote(produto.id, validade, 12, self.carlos)
        aviso_antes = grupo.aviso_em

        self.patch(self.url, {"antecedencia_aviso_dias": 20}, self.carlos)

        grupo.refresh_from_db()
        self.assertEqual(grupo.aviso_em, aviso_antes)                     # o antigo não muda
        outro = Produto.objects.create(loja=self.perto, nome="Leite 2 L", categoria="leite")
        _, novo, _, _ = servico_lotes.registrar_lote(outro.id, validade, 12, self.carlos)
        self.assertEqual(novo.aviso_em, validade - timedelta(days=20))    # o novo usa 20


class TestListarEquipe(Base):

    def test_lista_com_eu_e_responsavel_primeiro(self):
        r = self.get(f"{self.url}/vinculos", self.joana)
        self.assertEqual(r.json(), [
            {"id": self.vinculo(self.carlos).id, "papel": "responsavel", "eu": False,
             "usuario": {"nome": "Carlos Lima", "email": "carlos@vilanova.com"}},
            {"id": self.vinculo(self.joana).id, "papel": "funcionario", "eu": True,
             "usuario": {"nome": "Joana Prado", "email": "joana@vilanova.com"}},
        ])

    def test_nao_mostra_equipe_de_outra_loja(self):
        emails = [v["usuario"]["email"] for v in self.get(f"{self.url}/vinculos", self.carlos).json()]
        self.assertNotIn("rosa@emporio.com", emails)


class TestAdicionarNaEquipe(Base):

    def adicionar(self, email, papel="funcionario"):
        return self.post(f"{self.url}/vinculos", {"email": email, "papel": papel}, self.carlos)

    def test_adiciona_pelo_email(self):
        r = self.adicionar("bia@email.com")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["usuario"], {"nome": "Bia Lima", "email": "bia@email.com"})
        self.assertEqual((r.json()["papel"], r.json()["eu"]), ("funcionario", False))
        self.assertTrue(Vinculo.objects.filter(usuario=self.bia, loja=self.perto).exists())

    def test_email_sem_diferenciar_maiusculas_e_espacos(self):
        self.assertEqual(self.adicionar("  BIA@Email.com ").status_code, 201)

    def test_pode_adicionar_outro_responsavel(self):
        r = self.adicionar("bia@email.com", "responsavel")
        self.assertEqual(r.json()["papel"], "responsavel")

    def test_quem_e_de_outra_loja_tambem_pode_entrar(self):
        """Uma pessoa pode ter vínculo com várias lojas (uma por loja)."""
        self.assertEqual(self.adicionar("rosa@emporio.com").status_code, 201)

    def test_conta_nao_existe_404(self):
        r = self.adicionar("ninguem@email.com")
        self.assertEqual((r.status_code, r.json()["codigo"]), (404, "conta_nao_existe"))

    def test_ja_vinculado_409(self):
        r = self.adicionar("joana@vilanova.com", "responsavel")
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "ja_vinculado"))
        self.assertEqual(self.vinculo(self.joana).papel, "funcionario")      # não trocou o papel

    def test_entrada_invalida_400(self):
        casos = [({"papel": "funcionario"}, "email_invalido"),
                 ({"email": "sem-arroba", "papel": "funcionario"}, "email_invalido"),
                 ({"email": "bia@email.com"}, "papel_invalido"),
                 ({"email": "bia@email.com", "papel": "dono"}, "papel_invalido")]
        for corpo, codigo in casos:
            with self.subTest(corpo=corpo):
                r = self.post(f"{self.url}/vinculos", corpo, self.carlos)
                self.assertEqual((r.status_code, r.json()["codigo"]), (400, codigo))


class TestRemoverDaEquipe(Base):

    def remover(self, usuario, quem=None):
        return self.delete(f"{self.url}/vinculos/{self.vinculo(usuario).id}", quem or self.carlos)

    def test_remove_funcionario_204(self):
        r = self.remover(self.joana)
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Vinculo.objects.filter(usuario=self.joana, loja=self.perto).exists())
        self.assertEqual(self.get(self.url, self.joana).status_code, 403)    # perdeu o acesso

    def test_a_conta_continua_existindo(self):
        """Remover da equipe não apaga a pessoa: ela volta a ser só consumidora."""
        self.remover(self.joana)
        self.assertTrue(get_user_model().objects.filter(pk=self.joana.pk).exists())

    def test_proprio_vinculo_409(self):
        r = self.remover(self.carlos)
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "proprio_vinculo"))

    def test_remove_outro_responsavel(self):
        Vinculo.objects.create(usuario=self.bia, loja=self.perto, papel=Papel.RESPONSAVEL)
        self.assertEqual(self.remover(self.bia).status_code, 204)

    def test_vinculo_de_outra_loja_404(self):
        de_la = Vinculo.objects.get(usuario=self.rosa)
        r = self.delete(f"{self.url}/vinculos/{de_la.id}", self.carlos)
        self.assertEqual(r.status_code, 404)
        self.assertTrue(Vinculo.objects.filter(pk=de_la.pk).exists())

    def test_inexistente_404(self):
        self.assertEqual(self.delete(f"{self.url}/vinculos/99999", self.carlos).status_code, 404)
