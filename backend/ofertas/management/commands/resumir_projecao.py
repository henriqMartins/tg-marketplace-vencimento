"""
Gera o resumo da projeção (tela G2) a partir das rodadas da simulação.

    python manage.py resumir_projecao            # lê o CSV padrão, grava ofertas/dados/

SÓ LÊ simulacao/resultados_n5000/rodadas_tempo_chegada.csv (não altera a simulação)
e grava ofertas/dados/projecao_resumo.json, que vai para o git: o CSV tem 19 MB e
não entra na imagem do backend. Rodar de novo sempre que a simulação for refeita —
o teste test_projecao.TestResumoBateComOCsv avisa se alguém esquecer.

Usa só a biblioteca padrão (o backend não tem NumPy).
"""
import csv
import json
import math
from pathlib import Path

from django.core.management.base import BaseCommand

from ofertas import projecao

CAMPOS = ("n", "soma_perda", "n_bloq", "soma_bloq", "n_ret", "soma_ret")


def _numero(texto):
    """'nan' (rodada sem comprador) vira None: fica fora da média daquela taxa."""
    valor = float(texto)
    return None if math.isnan(valor) else valor


def resumir(caminho_csv):
    """Uma célula por chegada × lote × procura × janela, com somas e contagens."""
    celulas = {}
    janelas = set()
    with open(caminho_csv, newline="", encoding="utf-8") as f:
        for linha in csv.DictReader(f):
            janela = float(linha["janela"])
            janelas.add(janela)
            chave = (int(float(linha["mediana_tempo_chegada"])),
                     projecao.faixa_de(int(linha["lote"]), projecao.FAIXAS_LOTE),
                     projecao.faixa_de(float(linha["razao"]), projecao.FAIXAS_PROCURA),
                     janela)
            c = celulas.setdefault(chave, dict.fromkeys(CAMPOS, 0))
            c["n"] += 1
            c["soma_perda"] += float(linha["perda_pct"])
            bloq, ret = _numero(linha["bloqueados_pct"]), _numero(linha["taxa_retirada"])
            if bloq is not None:
                c["n_bloq"] += 1
                c["soma_bloq"] += bloq
            if ret is not None:
                c["n_ret"] += 1
                c["soma_ret"] += ret
    # todas as combinações, mesmo as vazias: filtro sem rodadas responde null, não some
    todas = [(ch, lo, pr, ja) for ch in projecao.CHEGADAS for lo in projecao.ROTULOS_LOTE
             for pr in projecao.ROTULOS_PROCURA for ja in sorted(janelas)]
    return {
        "fonte": "simulacao/resultados_n5000/rodadas_tempo_chegada.csv",
        "celulas": [{"chegada": ch, "lote": lo, "procura": pr, "janela": ja,
                     **celulas.get((ch, lo, pr, ja), dict.fromkeys(CAMPOS, 0))}
                    for ch, lo, pr, ja in todas],
    }


class Command(BaseCommand):
    help = "Resume as rodadas da simulação para a tela de projeção (G2)."

    def add_arguments(self, parser):
        parser.add_argument("--csv", dest="caminho_csv", default=str(projecao.CSV_PADRAO))
        parser.add_argument("--saida", default=str(projecao.RESUMO))

    def handle(self, *args, caminho_csv, saida, **opcoes):
        resumo = resumir(caminho_csv)
        saida = Path(saida)
        saida.parent.mkdir(parents=True, exist_ok=True)
        # uma célula por linha: o diff no git fica legível quando a simulação mudar
        linhas = ",\n".join(json.dumps(c) for c in resumo["celulas"])
        saida.write_text(f'{{"fonte": {json.dumps(resumo["fonte"])},\n"celulas": [\n{linhas}\n]}}\n',
                         encoding="utf-8")
        self.stdout.write(f"{len(resumo['celulas'])} células gravadas em {saida}")
