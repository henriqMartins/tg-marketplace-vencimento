"""
Testes da fundação do backend: a casa tem água e luz antes dos cômodos.

Rodar (dentro de backend/):  ..\\.venv\\Scripts\\python manage.py test
O Django cria um banco TEMPORÁRIO (test_tg) no PostgreSQL e apaga no fim.
"""
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.db import DatabaseError, connection
from django.test import TestCase

import dominio


class TestHealth(TestCase):
    # /health (Render) e /api/saude (frontend; o /health é barrado por bloqueador de anúncio).
    CAMINHOS = ("/health", "/api/saude")

    def test_responde_ok_com_banco_ligado(self):
        for caminho in self.CAMINHOS:
            with self.subTest(caminho=caminho):
                resposta = self.client.get(caminho)
                self.assertEqual(resposta.status_code, 200)
                self.assertEqual(resposta.json(), {"status": "ok", "banco": "ok"})

    def test_responde_503_quando_o_banco_falha(self):
        # Simula o banco fora do ar: a consulta levanta DatabaseError.
        falso = mock.MagicMock()
        falso.cursor.side_effect = DatabaseError("banco fora")
        for caminho in self.CAMINHOS:
            with self.subTest(caminho=caminho), mock.patch("config.views.connection", falso):
                resposta = self.client.get(caminho)
                self.assertEqual(resposta.status_code, 503)
                self.assertEqual(resposta.json()["banco"], "indisponível")

    def test_saude_nao_exige_login(self):
        # O app chama antes de saber se há alguém logado (tela A1).
        resposta = self.client.get("/api/saude", HTTP_AUTHORIZATION="Token chave-invalida")
        self.assertEqual(resposta.status_code, 200)


class TestFundacao(TestCase):

    def test_banco_e_postgresql(self):
        # Regra 5 virando teste: se alguém trocar para SQLite, quebra aqui.
        self.assertEqual(connection.vendor, "postgresql")

    def test_dominio_vem_do_pacote_instalado_sem_copia(self):
        # Regra 1: o arquivo carregado é o de dominio/src/, não uma cópia no backend.
        esperado = settings.BASE_DIR.parent / "dominio" / "src" / "dominio"
        self.assertEqual(Path(dominio.__file__).resolve().parent, esperado.resolve())
