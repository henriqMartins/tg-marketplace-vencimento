"""
Testes da projeção (etapa 13, grupo G do contrato, tela G2).

A rota NÃO simula nada: lê o resumo versionado (ofertas/dados/projecao_resumo.json),
gerado pelo comando `resumir_projecao` a partir de
simulacao/resultados_n5000/rodadas_tempo_chegada.csv.

O gabarito é a Tabela 5 do artigo: sem filtro e com chegada de 2 h, a rota tem de
devolver exatamente aqueles números. Os testes que leem o CSV são pulados se ele
não estiver na máquina (19 MB, fora do git).

Rodar (dentro de backend/):  python manage.py test ofertas.test_projecao
"""
import csv
import io
import json
import tempfile
import unittest
from pathlib import Path

from django.core.management import call_command

from . import projecao
from .test_indicadores import Base

# Tabela 5 do artigo: janela -> (perda %, bloqueados %, retirada %)
TABELA_5 = {
    0.5: (92.6, 0.6, 4.6),
    1: (74.2, 1.3, 16.1),
    2: (48.4, 5.4, 34.7),
    4: (31.3, 13.8, 53.3),
    8: (24.9, 19.5, 64.5),
    12: (23.7, 21.2, 67.4),
    24: (24.4, 21.8, 67.4),
}

CSV = projecao.CSV_PADRAO
sem_csv = unittest.skipUnless(CSV.exists(), "CSV da simulação ausente nesta máquina")


class TestProjecao(Base):

    def projecao(self, quem=None, **params):
        return self.get(f"{self.url}/projecao", quem or self.carlos, **params)

    def test_so_o_responsavel(self):
        self.assertEqual(self.get(f"{self.url}/projecao").status_code, 401)
        self.assertEqual(self.projecao(self.joana).status_code, 403)
        self.assertEqual(self.projecao(self.ana).status_code, 403)

    def test_sem_filtro_e_a_tabela_5(self):
        r = self.projecao()
        self.assertEqual(r.status_code, 200)
        corpo = r.json()
        self.assertEqual(corpo["rodadas"], 5000)
        self.assertEqual(corpo["filtro"], {"lote": None, "procura": None, "chegada": 2})
        obtido = {j["janela_horas"]: (j["perda_pct"], j["bloqueados_pct"], j["retirada_pct"])
                  for j in corpo["janelas"]}
        self.assertEqual(obtido, TABELA_5)
        self.assertEqual([j["janela_horas"] for j in corpo["janelas"]], list(TABELA_5))

    def test_faixas_de_lote_somam_todas_as_rodadas(self):
        total = sum(self.projecao(lote=f).json()["rodadas"] for f in projecao.ROTULOS_LOTE)
        self.assertEqual(total, 5000)

    def test_faixas_de_procura_somam_todas_as_rodadas(self):
        total = sum(self.projecao(procura=f).json()["rodadas"]
                    for f in projecao.ROTULOS_PROCURA)
        self.assertEqual(total, 5000)

    def test_filtro_aparece_na_resposta(self):
        corpo = self.projecao(lote="15-24", procura="1.3-1.8", chegada="4").json()
        self.assertEqual(corpo["filtro"], {"lote": "15-24", "procura": "1.3-1.8", "chegada": 4})
        self.assertLess(corpo["rodadas"], 5000)

    def test_chegada_muda_os_numeros(self):
        def perda(chegada):
            return [j["perda_pct"] for j in self.projecao(chegada=chegada).json()["janelas"]]
        self.assertNotEqual(perda("1"), perda("2"))
        self.assertNotEqual(perda("4"), perda("2"))
        self.assertEqual(self.projecao(chegada="1").json()["rodadas"], 5000)

    def test_parametro_vazio_e_sem_filtro(self):
        self.assertEqual(self.projecao(lote="", procura="").json(), self.projecao().json())

    def test_parametro_invalido_400(self):
        for params in ({"lote": "5-15"}, {"lote": "abc"}, {"procura": "0.3"},
                       {"chegada": "3"}, {"chegada": "dois"}):
            with self.subTest(params=params):
                r = self.projecao(**params)
                self.assertEqual((r.status_code, r.json()["codigo"]), (400, "parametro_invalido"))


class TestMediaDeCelulas(unittest.TestCase):
    """A conta da rota (somar células e dividir), sem banco e sem CSV."""

    def test_celula_sem_rodadas_vem_null(self):
        # o resumo grava todas as combinações, mesmo as sem nenhuma rodada (n = 0)
        vazia = dict.fromkeys(("n", "soma_perda", "n_bloq", "soma_bloq", "n_ret", "soma_ret"), 0)
        janelas, rodadas = projecao.media([{**vazia, "janela": 0.5}])
        self.assertEqual(rodadas, 0)
        self.assertEqual(janelas, [{"janela_horas": 0.5, "perda_pct": None,
                                    "bloqueados_pct": None, "retirada_pct": None}])

    def test_soma_e_divide_uma_vez_so(self):
        # duas células da mesma janela, tamanhos diferentes: média de médias daria errado
        celulas = [
            {"janela": 2.0, "n": 1, "soma_perda": 0.9, "n_bloq": 1, "soma_bloq": 0.0,
             "n_ret": 1, "soma_ret": 0.1},
            {"janela": 2.0, "n": 3, "soma_perda": 0.3, "n_bloq": 2, "soma_bloq": 0.2,
             "n_ret": 0, "soma_ret": 0.0},
        ]
        janelas, rodadas = projecao.media(celulas)
        self.assertEqual(rodadas, 4)
        (j,) = janelas
        self.assertEqual(j["perda_pct"], 30.0)            # (0.9 + 0.3) / 4, não (0.9 + 0.1) / 2
        self.assertEqual(j["bloqueados_pct"], 6.7)        # 0.2 / 3 (contagem própria)
        self.assertEqual(j["retirada_pct"], 10.0)         # 0.1 / 1


@sem_csv
class TestResumoBateComOCsv(unittest.TestCase):
    """Protege contra rodar a simulação de novo e esquecer de regenerar o resumo."""

    def test_resumo_versionado_e_igual_ao_gerado_agora(self):
        with tempfile.TemporaryDirectory() as pasta:
            saida = Path(pasta) / "resumo.json"
            call_command("resumir_projecao", saida=str(saida), stdout=io.StringIO())
            gerado = json.loads(saida.read_text(encoding="utf-8"))
        versionado = json.loads(projecao.RESUMO.read_text(encoding="utf-8"))
        self.assertEqual(gerado, versionado)

    def test_filtro_e_a_media_direta_das_rodadas(self):
        """lote 5-14, chegada 1 h, janela 4 h: resumo = média lida direto do CSV."""
        perdas, rets = [], []
        with open(CSV, newline="", encoding="utf-8") as f:
            for linha in csv.DictReader(f):
                if (float(linha["mediana_tempo_chegada"]) == 1.0
                        and float(linha["janela"]) == 4.0 and 5 <= int(linha["lote"]) <= 14):
                    perdas.append(float(linha["perda_pct"]))
                    if linha["taxa_retirada"] not in ("", "nan"):
                        rets.append(float(linha["taxa_retirada"]))
        janelas, rodadas = projecao.calcular(lote="5-14", procura=None, chegada=1)
        j4 = next(j for j in janelas if j["janela_horas"] == 4)
        self.assertEqual(rodadas, len(perdas))
        self.assertEqual(j4["perda_pct"], round(100 * sum(perdas) / len(perdas), 1))
        self.assertEqual(j4["retirada_pct"], round(100 * sum(rets) / len(rets), 1))
