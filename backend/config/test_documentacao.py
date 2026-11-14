"""
Testes do Swagger (documentação interativa da API, só em desenvolvimento).

O contrato oficial continua sendo docs/api/contrato.md; o Swagger é a ferramenta
para TESTAR as rotas no navegador. Estes testes garantem que:
  - nenhuma rota da API fica de fora (rota nova sem anotação = teste vermelho);
  - cada rota está no grupo certo do contrato (A a G);
  - o documento gerado é válido e sai sem nenhum aviso;
  - com DEBUG desligado (produção), /api/docs não existe.

Rodar (dentro de backend/):  python manage.py test config.test_documentacao
"""
import io
import re

from django.core.management import call_command
from django.test import SimpleTestCase, override_settings
from django.urls import URLPattern, URLResolver, get_resolver, path
from drf_spectacular.generators import SchemaGenerator
from rest_framework.views import APIView

from . import documentacao

# urlconf de teste: as rotas normais + as do Swagger (no runserver, só com DEBUG)
urlpatterns = list(get_resolver("config.urls").url_patterns) + documentacao.rotas()

METODOS = ("get", "post", "patch", "delete")


def _rotas_da_api(padroes, prefixo=""):
    """(caminho no formato OpenAPI, classe) de cada rota DRF: /api/lojas/{loja_id}..."""
    for p in padroes:
        if isinstance(p, URLResolver):
            yield from _rotas_da_api(p.url_patterns, prefixo + str(p.pattern))
        elif isinstance(p, URLPattern):
            classe = getattr(p.callback, "cls", None)
            if classe is not None and issubclass(classe, APIView):
                caminho = "/" + prefixo + str(p.pattern)
                yield re.sub(r"<(?:\w+:)?(\w+)>", r"{\1}", caminho), classe


class TestSwagger(SimpleTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.schema = SchemaGenerator().get_schema(request=None, public=True)

    def test_toda_rota_da_api_esta_documentada_no_grupo_certo(self):
        grupos = set(documentacao.GRUPOS.values())
        rotas = list(_rotas_da_api(get_resolver("config.urls").url_patterns))
        self.assertGreaterEqual(len(rotas), 25)
        for caminho, classe in rotas:
            for metodo in METODOS:
                if not hasattr(classe, metodo):
                    continue
                with self.subTest(rota=f"{metodo.upper()} {caminho}"):
                    operacao = self.schema["paths"].get(caminho, {}).get(metodo)
                    self.assertIsNotNone(operacao, "rota sem documentação no Swagger")
                    self.assertEqual(len(operacao["tags"]), 1)
                    self.assertIn(operacao["tags"][0], grupos)
                    self.assertTrue(operacao.get("summary"), "rota sem resumo")

    def test_rotas_publicas_nao_pedem_token_e_as_outras_pedem(self):
        publicas = {("post", "/api/auth/conta"), ("post", "/api/auth/login"),
                    ("get", "/api/ofertas"), ("get", "/api/ofertas/{oferta_id}")}
        for caminho, operacoes in self.schema["paths"].items():
            for metodo, operacao in operacoes.items():
                with self.subTest(rota=f"{metodo.upper()} {caminho}"):
                    pede_token = {"tokenAuth": []} in operacao.get("security", [])
                    self.assertEqual(pede_token, (metodo, caminho) not in publicas)

    def test_post_com_corpo_traz_exemplo_do_contrato(self):
        reservar = self.schema["paths"]["/api/ofertas/{oferta_id}/reservas"]["post"]
        exemplos = reservar["requestBody"]["content"]["application/json"]["examples"]
        self.assertEqual(next(iter(exemplos.values()))["value"], {"pedido": 2})

    def test_documento_valido_e_sem_avisos(self):
        call_command("spectacular", "--validate", "--fail-on-warn",
                     stdout=io.StringIO(), stderr=io.StringIO())


@override_settings(ROOT_URLCONF=__name__)
class TestPaginaDoSwagger(SimpleTestCase):

    def test_pagina_e_documento_abrem(self):
        self.assertEqual(self.client.get("/api/docs").status_code, 200)
        self.assertEqual(self.client.get("/api/schema").status_code, 200)


class TestSoEmDesenvolvimento(SimpleTestCase):

    def test_sem_debug_nao_existe(self):
        # O executor de testes roda com DEBUG=False, como em produção.
        self.assertEqual(self.client.get("/api/docs").status_code, 404)
        self.assertEqual(self.client.get("/api/schema").status_code, 404)
