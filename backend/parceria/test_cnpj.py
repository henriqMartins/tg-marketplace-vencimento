"""
CNPJ (etapa 14): dígito verificador e a consulta à Receita com a BrasilAPI SIMULADA.
Nenhum teste aqui usa rede: a urlopen do módulo é trocada por uma falsa.

Rodar (dentro de backend/):  python manage.py test parceria
"""
import io
import json
from unittest import TestCase, mock
from urllib.error import HTTPError, URLError

from . import cnpj as m

VALIDO = "11222333000181"


def resposta_brasilapi(**mudancas):
    """Um pedaço realista do JSON da BrasilAPI (só os campos que usamos)."""
    d = {"cnpj": VALIDO, "razao_social": "MERCEARIA SAO JORGE LTDA",
         "nome_fantasia": "MERCEARIA SAO JORGE", "descricao_situacao_cadastral": "ATIVA",
         "cnae_fiscal": 4712100,
         "cnae_fiscal_descricao": "Comércio varejista de mercadorias em geral, com "
                                  "predominância de produtos alimentícios - minimercados",
         "descricao_tipo_de_logradouro": "RUA", "logradouro": "DAS PALMEIRAS", "numero": "410",
         "bairro": "BOA VISTA", "municipio": "SAO JOSE DO RIO PRETO", "uf": "SP",
         "cep": "15025-000"}
    d.update(mudancas)
    return d


class _Resposta(io.BytesIO):
    """Imita a resposta da urlopen (usada com "with")."""

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def devolve(dados):
    """BrasilAPI simulada respondendo 200 com estes dados."""
    return mock.patch.object(m, "urlopen",
                             return_value=_Resposta(json.dumps(dados).encode("utf-8")))


def falha(excecao):
    """BrasilAPI simulada falhando com esta exceção."""
    return mock.patch.object(m, "urlopen", side_effect=excecao)


class TestDigito(TestCase):
    def test_cnpj_valido(self):
        self.assertTrue(m.cnpj_valido(VALIDO))
        self.assertTrue(m.cnpj_valido("33000167000101"))

    def test_digito_errado(self):
        self.assertFalse(m.cnpj_valido("11222333000182"))   # último dígito trocado
        self.assertFalse(m.cnpj_valido("11222333000191"))   # penúltimo trocado

    def test_digitos_trocados_de_lugar(self):
        self.assertFalse(m.cnpj_valido("12122333000181"))

    def test_formato_e_repetidos(self):
        for ruim in ("", "1122233300018", "112223330001811", "11.222.333/0001-81",
                     "00000000000000", "11111111111111"):
            self.assertFalse(m.cnpj_valido(ruim), ruim)

    def test_so_digitos_tira_a_mascara(self):
        self.assertEqual(m.so_digitos("11.222.333/0001-81"), VALIDO)


class TestConsulta(TestCase):
    def test_ativa_e_alimentar(self):
        with devolve(resposta_brasilapi()) as falso:
            c = m.consultar(VALIDO)
        self.assertTrue(c["ativa"])
        self.assertTrue(c["alimentar"])
        self.assertEqual(c["situacao"], "ATIVA")
        self.assertEqual(c["cnae_principal"]["codigo"], "4712100")
        self.assertEqual(c["endereco"]["logradouro"], "RUA DAS PALMEIRAS")
        self.assertEqual(c["endereco"]["cep"], "15025000")
        # Chamou a BrasilAPI certa, com limite de tempo de 5 s.
        pedido = falso.call_args.args[0]
        self.assertEqual(pedido.full_url, f"https://brasilapi.com.br/api/cnpj/v1/{VALIDO}")
        self.assertEqual(falso.call_args.kwargs["timeout"], 5)

    def test_inativa(self):
        with devolve(resposta_brasilapi(descricao_situacao_cadastral="BAIXADA")):
            c = m.consultar(VALIDO)
        self.assertFalse(c["ativa"])
        self.assertEqual(c["situacao"], "BAIXADA")

    def test_fora_do_varejo_de_alimentos_so_informa(self):
        # 4751201 = informática: não é 47.1 nem 47.2 -> alimentar false (só alerta na tela).
        with devolve(resposta_brasilapi(cnae_fiscal=4751201)):
            self.assertFalse(m.consultar(VALIDO)["alimentar"])
        # 4721102 = padaria (47.2) -> alimentar.
        with devolve(resposta_brasilapi(cnae_fiscal=4721102)):
            self.assertTrue(m.consultar(VALIDO)["alimentar"])

    def test_nao_encontrado(self):
        with falha(HTTPError("u", 404, "Not Found", {}, None)):
            with self.assertRaises(m.CnpjNaoEncontrado):
                m.consultar(VALIDO)

    def test_fora_do_ar(self):
        for exc in (URLError("sem rede"), TimeoutError("lenta"),
                    HTTPError("u", 500, "Erro", {}, None),
                    HTTPError("u", 429, "Muitas", {}, None)):
            with self.subTest(exc=exc), falha(exc):
                with self.assertRaises(m.ReceitaIndisponivel):
                    m.consultar(VALIDO)

    def test_resposta_quebrada_conta_como_fora_do_ar(self):
        with mock.patch.object(m, "urlopen", return_value=_Resposta(b"<html>erro</html>")):
            with self.assertRaises(m.ReceitaIndisponivel):
                m.consultar(VALIDO)
