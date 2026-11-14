"""
Projeção da tela G2 (etapa 13, grupo G do contrato).

NÃO roda simulação no servidor (decidido 05/11/2026). Lê um resumo pequeno e
versionado (dados/projecao_resumo.json), gerado pelo comando `resumir_projecao`
a partir de simulacao/resultados_n5000/rodadas_tempo_chegada.csv.

O resumo é como a apuração por seção de uma eleição: para cada
chegada × faixa de lote × faixa de procura × janela, guarda SOMAS e CONTAGENS
(não médias). Filtrar = escolher as seções; somar e dividir uma vez dá a média
exata das rodadas escolhidas — a mesma conta da Tabela 5, só que recortada.
"""
import json
from functools import lru_cache
from pathlib import Path

from django.conf import settings

RESUMO = Path(__file__).resolve().parent / "dados" / "projecao_resumo.json"
CSV_PADRAO = (Path(settings.BASE_DIR).parent / "simulacao" / "resultados_n5000"
              / "rodadas_tempo_chegada.csv")

# (rótulo, mínimo, máximo). Mínimo entra, máximo não — exceto na última faixa,
# que inclui o topo (lote 60, procura 3.0). Lote é inteiro: 5-14 = 5..14.
FAIXAS_LOTE = (("5-14", 5, 15), ("15-24", 15, 25), ("25-34", 25, 35),
               ("35-44", 35, 45), ("45-60", 45, 60))
FAIXAS_PROCURA = (("0.3-0.8", 0.3, 0.8), ("0.8-1.3", 0.8, 1.3), ("1.3-1.8", 1.3, 1.8),
                  ("1.8-2.3", 1.8, 2.3), ("2.3-3.0", 2.3, 3.0))
ROTULOS_LOTE = tuple(f[0] for f in FAIXAS_LOTE)
ROTULOS_PROCURA = tuple(f[0] for f in FAIXAS_PROCURA)
CHEGADAS = (1, 2, 4)                    # mediana do tempo até o cliente chegar (horas)
CHEGADA_PADRAO = 2


def faixa_de(valor, faixas):
    """Rótulo da faixa onde o valor cai (usado pelo comando que gera o resumo)."""
    for i, (rotulo, minimo, maximo) in enumerate(faixas):
        ultima = i == len(faixas) - 1
        if minimo <= valor < maximo or (ultima and valor == maximo):
            return rotulo
    raise ValueError(f"{valor} fora das faixas")


@lru_cache(maxsize=1)
def _celulas():
    """Lê o resumo uma vez por processo (o arquivo só muda com novo deploy)."""
    return json.loads(RESUMO.read_text(encoding="utf-8"))["celulas"]


def _pct(soma, n):
    return None if n == 0 else round(100 * soma / n, 1)


def media(celulas):
    """
    Soma as células de cada janela e divide UMA vez. Devolve (janelas, rodadas).
    📖 ESTUDAR: por que somar e dividir, e não tirar a média das médias? Uma célula
    com 1 rodada pesaria igual a uma com 300. E por que três contagens? Rodada sem
    comprador não tem taxa de bloqueados nem de retirada (era NaN na simulação) —
    ela entra na perda, mas fica fora dessas duas médias, igual ao simulacao.py.
    """
    por_janela = {}
    for c in celulas:
        t = por_janela.setdefault(c["janela"], dict.fromkeys(
            ("n", "soma_perda", "n_bloq", "soma_bloq", "n_ret", "soma_ret"), 0))
        for chave in t:
            t[chave] += c[chave]
    janelas = [{"janela_horas": int(j) if j == int(j) else j,
                "perda_pct": _pct(t["soma_perda"], t["n"]),
                "bloqueados_pct": _pct(t["soma_bloq"], t["n_bloq"]),
                "retirada_pct": _pct(t["soma_ret"], t["n_ret"])}
               for j, t in sorted(por_janela.items())]
    # cada rodada aparece uma vez em cada janela: as rodadas são o n de qualquer janela
    rodadas = next(iter(por_janela.values()))["n"] if por_janela else 0
    return janelas, rodadas


def calcular(lote, procura, chegada):
    """Filtra as células (None = todas as faixas) e devolve (janelas, rodadas)."""
    escolhidas = [c for c in _celulas()
                  if c["chegada"] == chegada
                  and lote in (None, c["lote"]) and procura in (None, c["procura"])]
    return media(escolhidas)
