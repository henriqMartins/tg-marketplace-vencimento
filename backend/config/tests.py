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

    def test_responde_ok_com_banco_ligado(self):
        resposta = self.client.get("/health")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json(), {"status": "ok", "banco": "ok"})

    def test_responde_503_quando_o_banco_falha(self):
        # Simula o banco fora do ar: a consulta levanta DatabaseError.
        falso = mock.MagicMock()
        falso.cursor.side_effect = DatabaseError("banco fora")
        with mock.patch("config.views.connection", falso):
            resposta = self.client.get("/health")
        self.assertEqual(resposta.status_code, 503)
        self.assertEqual(resposta.json()["banco"], "indisponível")


class TestFundacao(TestCase):

    def test_banco_e_postgresql(self):
        # Regra 5 virando teste: se alguém trocar para SQLite, quebra aqui.
        self.assertEqual(connection.vendor, "postgresql")

    def test_dominio_vem_do_pacote_instalado_sem_copia(self):
        # Regra 1: o arquivo carregado é o de dominio/src/, não uma cópia no backend.
        esperado = settings.BASE_DIR.parent / "dominio" / "src" / "dominio"
        self.assertEqual(Path(dominio.__file__).resolve().parent, esperado.resolve())
