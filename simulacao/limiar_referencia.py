"""
limiar_referencia.py — limiar de equilíbrio contra o cenário "sem plataforma".

NÃO roda o modelo: só lê os resultados já gerados por simulacao.py
(resultados/rodadas.csv) e faz contas sobre eles.

A pergunta: a partir de qual taxa de descarte SEM plataforma a perda COM
plataforma passa a ser menor?

  taxa de referência r = unidades descartadas sem plataforma
                         ÷ unidades no momento do alerta
  perda com plataforma = perda ÷ lote separado   (coluna perda_pct)

A plataforma vence numa rodada quando perda_pct < r (empate não conta).
A taxa r NÃO é estimada (não há dado para isso): ela é VARRIDA de 0% a 100%,
e o resultado é lido como limiar. Ver parametros.md, seção 2.2.

Premissa da comparação: o lote separado é igual às unidades que havia no
momento do alerta (o lojista separa tudo o que tem daquele produto).

Saídas:
  - tabela no terminal;
  - resultados/limiar_referencia.png;
  - resultados/limiar_referencia.csv (curva completa, r de 1 em 1 ponto).

Uso:
  py limiar_referencia.py
  py limiar_referencia.py --entrada resultados_n5000/rodadas.csv --saida resultados_n5000
"""

import argparse
import csv
import os
from collections import defaultdict
from typing import Dict, List, Tuple

import numpy as np

from simulacao import DPI, EIXO, FUNDO, MUDO, TINTA, _estilo, _media_ic95

# Taxas de referência varridas, em pontos percentuais inteiros (0, 1, ..., 100)
TAXAS_REFERENCIA = list(range(0, 101))
TAXAS_NA_TABELA = (0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100)

# Paleta categórica de referência (dataviz), em ordem fixa: uma cor por janela
COR_JANELA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100",
              "#e87ba4", "#008300", "#6250d6", "#e34948"]


def ler_rodadas(caminho: str) -> Dict[float, List[Tuple[int, int]]]:
    """Devolve {janela: [(perda, lote), ...]} em unidades inteiras."""
    por_janela = defaultdict(list)
    with open(caminho, encoding="utf-8") as f:
        for linha in csv.DictReader(f):
            por_janela[float(linha["janela"])].append(
                (int(linha["perda"]), int(linha["lote"])))
    return dict(sorted(por_janela.items()))


def fracao_plataforma_vence(rodadas: List[Tuple[int, int]], r: int) -> float:
    """
    Fração das rodadas em que perda/lote < r/100.
    Comparação em inteiros (perda × 100 < r × lote): sem erro de arredondamento.
    """
    vence = sum(1 for perda, lote in rodadas if perda * 100 < r * lote)
    return vence / len(rodadas)


def limiar_metade(rodadas: List[Tuple[int, int]]) -> float:
    """
    Taxa acima da qual a plataforma vence em pelo menos metade das rodadas.
    Como empate não conta, é preciso r > k-ésima menor perda (k = metade,
    arredondada para cima). Se essa perda é 100%, nenhuma taxa basta: NaN.
    """
    perdas = sorted(p / l for p, l in rodadas)
    v = perdas[(len(perdas) + 1) // 2 - 1]
    return v if v < 1.0 else float("nan")


def calcular(por_janela) -> Dict[float, dict]:
    resultado = {}
    for janela, rodadas in por_janela.items():
        perdas = np.array([p / l for p, l in rodadas])
        media, ic = _media_ic95(perdas)
        resultado[janela] = dict(
            n=len(rodadas),
            limiar_medio=media,
            ic95=ic,
            limiar_mediano=limiar_metade(rodadas),
            curva=[fracao_plataforma_vence(rodadas, r) for r in TAXAS_REFERENCIA],
        )
    return resultado


def imprimir_tabela(res) -> None:
    print("\nLimiar de equilíbrio por janela (cálculo sobre resultados da "
          "simulação; cenário projetado)\n")
    print("Limiar médio = perda média com plataforma: acima dessa taxa de "
          "descarte sem plataforma,\na plataforma perde menos EM MÉDIA.\n")
    print("Limiar mediano = taxa acima da qual a plataforma perde menos em pelo "
          "menos METADE das rodadas.\n")
    cab = f"{'janela (h)':>10} | {'limiar médio (IC95)':>19} | {'limiar mediano':>14}"
    print(cab)
    print("-" * len(cab))
    for janela, d in res.items():
        mediano = (f"{'nunca':>14}" if np.isnan(d["limiar_mediano"])
                   else f"{100 * d['limiar_mediano']:>13.1f}%")
        print(f"{janela:>10g} | {100 * d['limiar_medio']:>10.1f}% ± {100 * d['ic95']:>4.1f}"
              f" | {mediano}")

    print("\n% das rodadas em que a plataforma perde menos, por taxa de "
          "descarte sem plataforma\n")
    cab = f"{'janela (h)':>10} | " + " ".join(f"{f'{r}%':>5}" for r in TAXAS_NA_TABELA)
    print(cab)
    print("-" * len(cab))
    for janela, d in res.items():
        print(f"{janela:>10g} | " + " ".join(
            f"{100 * d['curva'][r]:>5.0f}" for r in TAXAS_NA_TABELA))
    n = next(iter(res.values()))["n"]
    print(f"\n{n} rodadas por janela. Empate (perda igual à taxa) não conta "
          "como vitória.")


def salvar_csv(res, caminho: str) -> None:
    with open(caminho, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["janela", "taxa_referencia_pct", "fracao_rodadas_plataforma_vence"])
        for janela, d in res.items():
            for r, frac in zip(TAXAS_REFERENCIA, d["curva"]):
                w.writerow([janela, r, frac])


def grafico(res, caminho: str) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    _estilo(plt)

    janelas = list(res)
    fig, (esq, dir_) = plt.subplots(1, 2, figsize=(11, 4.3),
                                    gridspec_kw={"width_ratios": [1, 1.4]})

    # Esquerda: limiar médio por janela, com IC 95%
    medias = 100 * np.array([res[j]["limiar_medio"] for j in janelas])
    ics = 100 * np.array([res[j]["ic95"] for j in janelas])
    medianas = 100 * np.array([res[j]["limiar_mediano"] for j in janelas])
    esq.fill_between(janelas, medias - ics, medias + ics, color=COR_JANELA[0],
                     alpha=0.3, linewidth=0, label="IC 95% da média")
    esq.plot(janelas, medias, color=COR_JANELA[0], marker="o", markersize=5,
             markeredgecolor=FUNDO, markeredgewidth=1.5, label="Limiar médio")
    esq.plot(janelas, medianas, color=MUDO, linewidth=1.5, linestyle="--",
             marker="o", markersize=4, markerfacecolor=FUNDO,
             label="Limiar mediano (vence em ≥ 50% das rodadas)")
    esq.set_xscale("log")
    esq.set_xticks(janelas)
    esq.set_xticklabels([f"{j:g}" for j in janelas])
    esq.minorticks_off()
    esq.set_xlabel("Janela de reserva (h, escala log)")
    esq.set_ylabel("Taxa de descarte sem plataforma (%)")
    esq.set_ylim(0, 100)
    esq.set_title("Limiar de equilíbrio por janela", loc="left")
    esq.legend(loc="lower left")

    # Direita: em quantas rodadas a plataforma vence, para cada taxa de referência
    for janela, cor in zip(janelas, COR_JANELA):
        dir_.plot(TAXAS_REFERENCIA, 100 * np.array(res[janela]["curva"]),
                  color=cor, label=f"Janela {janela:g} h")
    dir_.axhline(50, color=EIXO, linewidth=1, zorder=0)
    dir_.set_xlim(0, 100)
    dir_.set_ylim(0, 100)
    dir_.set_xlabel("Taxa de descarte sem plataforma (% das unidades no alerta)")
    dir_.set_ylabel("Rodadas em que a plataforma perde menos (%)")
    dir_.set_title("Distribuição por rodada", loc="left")
    dir_.legend(loc="upper left", fontsize=8)

    n = res[janelas[0]]["n"]
    fig.suptitle("Limiar contra o cenário sem plataforma (taxa de referência "
                 f"varrida, não estimada; N = {n} rodadas por janela)",
                 x=0.01, ha="left", color=TINTA)
    fig.tight_layout()
    fig.savefig(caminho, dpi=DPI)
    plt.close(fig)


def main() -> None:
    p = argparse.ArgumentParser(description="Limiar contra o cenário sem plataforma.")
    p.add_argument("--entrada", default=os.path.join("resultados", "rodadas.csv"))
    p.add_argument("--saida", default="resultados", help="pasta de saída")
    args = p.parse_args()

    res = calcular(ler_rodadas(args.entrada))
    imprimir_tabela(res)
    os.makedirs(args.saida, exist_ok=True)
    salvar_csv(res, os.path.join(args.saida, "limiar_referencia.csv"))
    grafico(res, os.path.join(args.saida, "limiar_referencia.png"))
    print(f"\nArquivos em {os.path.abspath(args.saida)}")
    print("Lembrete: a taxa sem plataforma não foi medida — é varrida como "
          "limiar. Resultado é cenário projetado.")


if __name__ == "__main__":
    main()
