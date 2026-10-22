"""
simulacao.py — Monte Carlo da reserva (v0).

Objetivo: responder como a janela de reserva afeta o desperdício e o bloqueio
(pergunta exploratória; a antiga hipótese H1 não entra no artigo). Ideia original: reduzir a janela diminui o
desperdício (perda) e aumenta os compradores bloqueados; não existe janela
que zere os dois.

Como funciona (uma rodada = uma oferta):
  1. Sorteia um cenário (tamanho do lote, duração, procura...) dentro das faixas.
  2. Sorteia os compradores: quando chegam, quanto pedem, qual o destino
     (não aparece, cancela ou tenta retirar) e quanto tempo levam para chegar.
  3. Roda a MESMA lista de compradores para cada janela de reserva. Assim a
     única coisa que muda entre as janelas é a janela (números aleatórios
     comuns: a comparação fica justa e com menos ruído).
  4. Cada ação passa por dominio.Oferta — esta simulação NÃO reimplementa
     nenhuma regra de reserva. É isso que permite dizer que "a simulação
     executa a mesma lógica do sistema".

O resultado é CENÁRIO PROJETADO, não previsão. Os parâmetros são assumidos
(ver parametros.md) e por isso entram como faixas.

Uso:
  py simulacao.py                 # N = 1000, semente 2026, gráficos em resultados/
  py simulacao.py --n 5000        # mais repetições (ver gráfico de convergência)
  py simulacao.py --sem-graficos  # só a tabela no terminal e o CSV
"""

import argparse
import csv
import heapq
import itertools
import math
import os
from dataclasses import dataclass
from statistics import NormalDist
from typing import Dict, List, Optional

import numpy as np

from dominio import EstadoReserva, ErroDominio, Oferta


# ====================================================================
# PARÂMETROS — copiados de parametros.md.
# STATUS: aprovada 14/10/2026; revisada 15/10/2026 (lote, validade, pedido).
# Base de cada faixa: ver parametros.md. Mudou o parametros.md? Mude só aqui.
# ====================================================================

DPI = 300  # resolução das figuras (modelo Fatec recomenda 300 dpi)
SEMENTE = 2026
N_PADRAO = 1000

# Parâmetro de controle (eixo X do gráfico principal), em horas
JANELAS = (0.5, 1.0, 2.0, 4.0, 8.0, 12.0, 24.0)

# Parâmetros do cenário: sorteados uma vez por rodada
FAIXA_LOTE = (5, 60)                 # unidades, inteiro uniforme
FAIXA_DURACAO = (24.0, 720.0)        # horas (1 a 30 dias), uniforme: validade restante na publicação
FAIXA_RAZAO = (0.3, 3.0)             # procura/oferta, uniforme
FAIXA_NAO_APARECE = (0.10, 0.40)     # fração, uniforme por cenário
FAIXA_CANCELA = (0.00, 0.15)         # fração, uniforme por cenário

# Parâmetros do comprador: sorteados para cada comprador
PEDIDO_VALORES = (1, 2, 3, 4, 5, 6, 7, 8)
PEDIDO_PROBS = (0.35, 0.25, 0.15, 0.10, 0.06, 0.04, 0.03, 0.02)
PEDIDO_MEDIO = sum(v * p for v, p in zip(PEDIDO_VALORES, PEDIDO_PROBS))  # 2,61

# Tempo que o cliente precisa para chegar: lognormal, mediana 2 h,
# limitada a [15 min, 12 h]. O parametros.md não fixa o desvio da lognormal;
# aqui ele é DERIVADO da faixa: escolhido para que o intervalo de 95% tenha a
# mesma largura (em escala log) que 15 min–12 h. A lognormal é truncada na
# faixa (sem acumular massa nas bordas) e sorteada por inversão: exatamente UM
# número aleatório por comprador, qualquer que seja a mediana.
TEMPO_CHEGADA_MEDIANA = 2.0
TEMPO_CHEGADA_FAIXA = (0.25, 12.0)
TEMPO_CHEGADA_SIGMA = (math.log(TEMPO_CHEGADA_FAIXA[1] / TEMPO_CHEGADA_FAIXA[0])
                       / (2 * 1.96))                                   # ≈ 0,99

# Análise de sensibilidade: medianas testadas (desvio e faixa ficam iguais)
MEDIANAS_TEMPO_CHEGADA = (1.0, 2.0, 4.0)


# ====================================================================
# Cenário e compradores
# ====================================================================

@dataclass(frozen=True)
class Cenario:
    lote: int
    duracao: float
    razao: float
    frac_nao_aparece: float
    frac_cancela: float
    mediana_tempo_chegada: float = TEMPO_CHEGADA_MEDIANA
    # Só para o teste degenerado: None = sortear normalmente.
    pedido_fixo: Optional[int] = None
    tempo_chegada_fixo: Optional[float] = None
    chegadas_regulares: bool = False

    @property
    def taxa_chegada(self) -> float:
        """Compradores por hora: razão × lote ÷ (pedido médio × duração)."""
        pedido_medio = self.pedido_fixo or PEDIDO_MEDIO
        return self.razao * self.lote / (pedido_medio * self.duracao)


@dataclass(frozen=True)
class Comprador:
    chegada: float          # instante em que tenta reservar
    pedido: int             # unidades pedidas
    destino: str            # "nao_aparece" | "cancela" | "retira"
    tempo_chegada: float    # horas entre reservar e chegar à loja (se "retira")
    u_cancela: float        # posição do cancelamento dentro da janela (0 a 1)


def sortear_cenario(rng: np.random.Generator,
                    mediana_tempo_chegada: float = TEMPO_CHEGADA_MEDIANA) -> Cenario:
    return Cenario(
        lote=int(rng.integers(FAIXA_LOTE[0], FAIXA_LOTE[1] + 1)),
        duracao=float(rng.uniform(*FAIXA_DURACAO)),
        razao=float(rng.uniform(*FAIXA_RAZAO)),
        frac_nao_aparece=float(rng.uniform(*FAIXA_NAO_APARECE)),
        frac_cancela=float(rng.uniform(*FAIXA_CANCELA)),
        mediana_tempo_chegada=mediana_tempo_chegada,
    )


def _instantes_de_chegada(cen: Cenario, rng: np.random.Generator) -> List[float]:
    taxa = cen.taxa_chegada
    if cen.chegadas_regulares:
        n = round(taxa * cen.duracao)
        return [k * cen.duracao / n for k in range(n)]
    # Processo de Poisson: intervalos exponenciais entre chegadas.
    instantes, t = [], rng.exponential(1 / taxa)
    while t < cen.duracao:
        instantes.append(float(t))
        t += rng.exponential(1 / taxa)
    return instantes


def _tempo_chegada(cen: Cenario, rng: np.random.Generator) -> float:
    if cen.tempo_chegada_fixo is not None:
        return cen.tempo_chegada_fixo
    u = rng.random()
    # Inversão da lognormal truncada: u escolhe um ponto entre as
    # probabilidades acumuladas das duas bordas da faixa.
    mu = math.log(cen.mediana_tempo_chegada)
    normal = NormalDist()
    a, b = (normal.cdf((math.log(x) - mu) / TEMPO_CHEGADA_SIGMA)
            for x in TEMPO_CHEGADA_FAIXA)
    z = normal.inv_cdf(a + u * (b - a))
    t = math.exp(mu + TEMPO_CHEGADA_SIGMA * z)
    # Proteção contra arredondamento nas bordas.
    return min(max(t, TEMPO_CHEGADA_FAIXA[0]), TEMPO_CHEGADA_FAIXA[1])


def sortear_compradores(cen: Cenario, rng: np.random.Generator) -> List[Comprador]:
    """
    Sorteia TUDO de cada comprador de antemão, inclusive o que só seria usado
    se ele conseguisse reservar. Assim a lista não depende da janela e pode ser
    reaproveitada em todas elas.
    """
    compradores = []
    for chegada in _instantes_de_chegada(cen, rng):
        pedido = (cen.pedido_fixo if cen.pedido_fixo is not None
                  else int(rng.choice(PEDIDO_VALORES, p=PEDIDO_PROBS)))
        u = rng.random()
        if u < cen.frac_nao_aparece:
            destino = "nao_aparece"
        elif u < cen.frac_nao_aparece + cen.frac_cancela:
            destino = "cancela"
        else:
            destino = "retira"
        compradores.append(Comprador(
            chegada=chegada, pedido=pedido, destino=destino,
            tempo_chegada=_tempo_chegada(cen, rng),
            u_cancela=float(rng.random()),
        ))
    return compradores


# ====================================================================
# Uma rodada
# ====================================================================

def simular_oferta(cen: Cenario, janela: float,
                   compradores: List[Comprador]) -> Dict[str, float]:
    """
    Executa uma oferta do início ao fim, em ordem cronológica de eventos,
    chamando apenas as operações de dominio.Oferta.
    """
    oferta = Oferta(cen.lote, fim_da_oferta=cen.duracao, janela_reserva=janela)

    eventos: list = []          # (instante, desempate, tipo, dado)
    ordem = itertools.count()
    for c in compradores:
        heapq.heappush(eventos, (c.chegada, next(ordem), "chega", c))

    destino_da_reserva: Dict[int, str] = {}
    bloq_total = bloq_parcial = 0

    while eventos:
        agora, _, tipo, dado = heapq.heappop(eventos)
        if agora >= cen.duracao:
            break  # o que sobrou na fila já venceu; encerrar() expira

        if tipo == "chega":
            c: Comprador = dado
            reserva = oferta.reservar(c.pedido, agora)
            if reserva is None:
                bloq_total += 1
                continue
            if reserva.parcial:
                bloq_parcial += 1
            destino_da_reserva[reserva.id] = c.destino
            if c.destino == "cancela":
                janela_efetiva = reserva.expira_em - reserva.criada_em
                quando = agora + c.u_cancela * janela_efetiva
                heapq.heappush(eventos, (quando, next(ordem), "cancela", reserva))
            elif c.destino == "retira":
                quando = agora + c.tempo_chegada
                heapq.heappush(eventos, (quando, next(ordem), "retira", reserva))
            # "nao_aparece": nenhum evento; a reserva expira sozinha.

        elif tipo == "cancela":
            oferta.cancelar(dado.id, agora)

        elif tipo == "retira":
            try:
                oferta.retirar(dado.id, dado.codigo, agora)
            except ErroDominio:
                # Chegou depois de expira_em: o domínio já expirou a reserva.
                assert dado.estado is EstadoReserva.EXPIRADA

    perda = oferta.encerrar(cen.duracao)

    # Contagem por estado final, separando os dois motivos de expiração.
    contagem = dict(retiradas=0, canceladas=0, exp_nao_aparece=0, exp_atraso=0)
    for r in oferta.reservas.values():
        if r.estado is EstadoReserva.RETIRADA:
            contagem["retiradas"] += 1
        elif r.estado is EstadoReserva.CANCELADA:
            contagem["canceladas"] += 1
        elif destino_da_reserva[r.id] == "nao_aparece":
            contagem["exp_nao_aparece"] += 1
        else:
            contagem["exp_atraso"] += 1

    n_compradores = len(compradores)
    n_reservas = len(oferta.reservas)
    bloqueados = bloq_total + bloq_parcial

    def fracao(parte: int, todo: int) -> float:
        return parte / todo if todo else math.nan

    return dict(
        janela=janela,
        lote=cen.lote,
        duracao=cen.duracao,
        razao=cen.razao,
        frac_nao_aparece=cen.frac_nao_aparece,
        frac_cancela=cen.frac_cancela,
        mediana_tempo_chegada=cen.mediana_tempo_chegada,
        compradores=n_compradores,
        reservas=n_reservas,
        perda=perda,
        perda_pct=perda / cen.lote,
        retirado=oferta.retirado,
        bloq_total=bloq_total,
        bloq_parcial=bloq_parcial,
        bloqueados_pct=fracao(bloqueados, n_compradores),
        taxa_retirada=fracao(contagem["retiradas"], n_reservas),
        taxa_cancelamento=fracao(contagem["canceladas"], n_reservas),
        taxa_exp_nao_aparece=fracao(contagem["exp_nao_aparece"], n_reservas),
        taxa_exp_atraso=fracao(contagem["exp_atraso"], n_reservas),
        **contagem,
    )


# ====================================================================
# Experimento: N rodadas × todas as janelas
# ====================================================================

def rodar_experimento(n: int, semente: int = SEMENTE, janelas=JANELAS,
                      mediana_tempo_chegada: float = TEMPO_CHEGADA_MEDIANA
                      ) -> List[Dict[str, float]]:
    """
    Cada rodada recebe sua própria semente filha (derivada da semente fixa),
    então a rodada i é sempre a mesma, qualquer que seja o N total.
    Trocar a mediana do tempo de chegada não muda o cenário nem os demais
    sorteios da rodada i: só o tempo de cada comprador.
    """
    sementes = np.random.SeedSequence(semente).spawn(n)
    linhas = []
    for i, s in enumerate(sementes):
        rng = np.random.default_rng(s)
        cen = sortear_cenario(rng, mediana_tempo_chegada)
        compradores = sortear_compradores(cen, rng)
        for janela in janelas:
            linha = simular_oferta(cen, janela, compradores)
            linha["rodada"] = i
            linhas.append(linha)
    return linhas


def _media_ic95(valores: np.ndarray):
    v = valores[~np.isnan(valores)]
    if len(v) < 2:
        return math.nan, math.nan
    return float(v.mean()), float(1.96 * v.std(ddof=1) / math.sqrt(len(v)))


def rodar_sensibilidade_tempo_chegada(n: int, semente: int = SEMENTE,
                                      janelas=JANELAS, base=None
                                      ) -> Dict[float, List[Dict[str, float]]]:
    """
    Repete o experimento para cada mediana em MEDIANAS_TEMPO_CHEGADA, com a
    mesma semente (mesmos cenários e compradores). `base` reaproveita a rodada
    principal, que já usa a mediana padrão.
    """
    return {m: (base if base is not None and m == TEMPO_CHEGADA_MEDIANA
                else rodar_experimento(n, semente, janelas, m))
            for m in MEDIANAS_TEMPO_CHEGADA}


def resumir_sensibilidade_tempo(por_mediana, janelas=JANELAS) -> None:
    print("\nSensibilidade à mediana do tempo de chegada — média por janela\n")
    medianas = list(por_mediana)
    cab = (f"{'janela (h)':>10} | "
           + " | ".join(f"{'perda med. ' + f'{m:g}h':>13}" for m in medianas)
           + " | "
           + " | ".join(f"{'bloq. med. ' + f'{m:g}h':>13}" for m in medianas))
    print(cab)
    print("-" * len(cab))
    for j in janelas:
        perdas, bloqs = [], []
        for m in medianas:
            sub = [l for l in por_mediana[m] if l["janela"] == j]
            perdas.append(_media_ic95(np.array([l["perda_pct"] for l in sub]))[0])
            bloqs.append(_media_ic95(np.array([l["bloqueados_pct"] for l in sub],
                                              float))[0])
        print(f"{j:>10g} | "
              + " | ".join(f"{100 * v:>12.1f}%" for v in perdas) + " | "
              + " | ".join(f"{100 * v:>12.1f}%" for v in bloqs))


def resumir(linhas, janelas=JANELAS) -> None:
    metricas = [
        ("perda_pct", "Perda (% lote)"),
        ("bloqueados_pct", "Bloqueados (% compr.)"),
        ("taxa_retirada", "Retirada"),
        ("taxa_exp_nao_aparece", "Exp. não aparece"),
        ("taxa_exp_atraso", "Exp. atraso"),
        ("taxa_cancelamento", "Cancelamento"),
    ]
    print("\nMédia ± IC95% por janela (todas as taxas como % das reservas,"
          " exceto bloqueados)\n")
    cab = f"{'janela (h)':>10} | " + " | ".join(f"{t:>21}" for _, t in metricas)
    print(cab)
    print("-" * len(cab))
    for j in janelas:
        sub = [l for l in linhas if l["janela"] == j]
        cels = []
        for chave, _ in metricas:
            m, ic = _media_ic95(np.array([l[chave] for l in sub], float))
            cels.append(f"{100 * m:>13.1f} ± {100 * ic:>4.1f}")
        print(f"{j:>10g} | " + " | ".join(cels))
    sem_compradores = sum(1 for l in linhas if l["compradores"] == 0
                          and l["janela"] == janelas[0])
    n = len(linhas) // len(janelas)
    print(f"\n{n} rodadas por janela. Rodadas sem nenhum comprador: "
          f"{sem_compradores} (ficam fora das médias de taxas e bloqueados).")


def salvar_csv(linhas, caminho: str) -> None:
    campos = ["rodada"] + [k for k in linhas[0] if k != "rodada"]
    with open(caminho, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=campos)
        w.writeheader()
        w.writerows(linhas)


# ====================================================================
# Gráficos (paleta de referência do dataviz: tinta neutra, séries em ordem fixa)
# ====================================================================

COR_SERIE = ["#2a78d6", "#eb6834", "#1baf7a"]   # azul, laranja, aqua
TINTA, TINTA_2, MUDO = "#0b0b0b", "#52514e", "#898781"
GRADE, EIXO, FUNDO = "#e1e0d9", "#c3c2b7", "#fcfcfb"


def _estilo(plt) -> None:
    plt.rcParams.update({
        "figure.facecolor": FUNDO, "axes.facecolor": FUNDO,
        "axes.edgecolor": EIXO, "axes.labelcolor": TINTA_2,
        "axes.titlecolor": TINTA, "axes.titlesize": 11,
        "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.color": GRADE, "grid.linewidth": 0.6,
        "xtick.color": MUDO, "ytick.color": MUDO,
        "xtick.labelcolor": TINTA_2, "ytick.labelcolor": TINTA_2,
        "legend.frameon": False, "legend.labelcolor": TINTA_2,
        "lines.linewidth": 2, "font.size": 9,
    })


def _por_janela(linhas, chave, janelas):
    return {j: np.array([l[chave] for l in linhas if l["janela"] == j], float)
            for j in janelas}


def _eixo_janela(ax, janelas) -> None:
    ax.set_xscale("log")
    ax.set_xticks(janelas)
    ax.set_xticklabels([f"{j:g}" for j in janelas])
    ax.minorticks_off()
    ax.set_xlabel("Janela de reserva (h, escala log)")


def grafico_tradeoff(linhas, janelas, caminho, plt) -> None:
    """Trade-off: janela × perda e janela × bloqueados (dois painéis, nunca eixo duplo)."""
    fig, eixos = plt.subplots(1, 2, figsize=(10, 4))
    for ax, chave, titulo, cor in [
        (eixos[0], "perda_pct", "Perda (% do lote)", COR_SERIE[0]),
        (eixos[1], "bloqueados_pct", "Compradores bloqueados (% dos compradores)",
         COR_SERIE[1]),
    ]:
        dados = _por_janela(linhas, chave, janelas)
        medias, ics, p25, p75 = [], [], [], []
        for j in janelas:
            v = dados[j][~np.isnan(dados[j])]
            m, ic = _media_ic95(dados[j])
            medias.append(100 * m)
            ics.append(100 * ic)
            p25.append(100 * np.percentile(v, 25))
            p75.append(100 * np.percentile(v, 75))
        medias, ics = np.array(medias), np.array(ics)
        ax.fill_between(janelas, p25, p75, color=cor, alpha=0.12, linewidth=0,
                        label="Quartis 25–75% das rodadas")
        ax.fill_between(janelas, medias - ics, medias + ics, color=cor,
                        alpha=0.35, linewidth=0, label="IC 95% da média")
        ax.plot(janelas, medias, color=cor, marker="o", markersize=5,
                markeredgecolor=FUNDO, markeredgewidth=1.5, label="Média")
        _eixo_janela(ax, janelas)
        ax.set_title(titulo, loc="left")
        ax.set_ylim(bottom=0)
        ax.legend(loc="best")
    fig.suptitle("Trade-off da janela de reserva (cenário projetado, "
                 f"N = {len(dados[janelas[0]])} rodadas por janela)",
                 x=0.01, ha="left", color=TINTA)
    fig.tight_layout()
    fig.savefig(caminho, dpi=DPI)
    plt.close(fig)


def grafico_histogramas(linhas, janelas, caminho, plt) -> None:
    escolhidas = [janelas[0], janelas[len(janelas) // 2], janelas[-1]]
    fig, eixos = plt.subplots(2, 3, figsize=(10, 5.5), sharey="row")
    for linha_ax, chave, rotulo, cor in [
        (eixos[0], "perda_pct", "Perda (% do lote)", COR_SERIE[0]),
        (eixos[1], "bloqueados_pct", "Bloqueados (% dos compradores)",
         COR_SERIE[1]),
    ]:
        dados = _por_janela(linhas, chave, escolhidas)
        bordas = np.linspace(0, 100, 21)
        for ax, j in zip(linha_ax, escolhidas):
            v = 100 * dados[j][~np.isnan(dados[j])]
            ax.hist(v, bins=bordas, color=cor, edgecolor=FUNDO, linewidth=1.5)
            ax.set_title(f"Janela {j:g} h", loc="left")
            ax.set_xlabel(rotulo)
        linha_ax[0].set_ylabel("Rodadas")
    fig.suptitle("Distribuição dos resultados por rodada", x=0.01, ha="left",
                 color=TINTA)
    fig.tight_layout()
    fig.savefig(caminho, dpi=DPI)
    plt.close(fig)


def grafico_sensibilidade(linhas, janelas, caminho, plt) -> None:
    """
    Para cada parâmetro do cenário, separa as rodadas em metade inferior e
    superior da faixa e compara as curvas. Se as duas metades mostram a mesma
    tendência, a conclusão principal não depende daquele parâmetro.
    """
    parametros = [
        ("lote", "Tamanho do lote", FAIXA_LOTE),
        ("duracao", "Duração da oferta", FAIXA_DURACAO),
        ("razao", "Procura/oferta", FAIXA_RAZAO),
        ("frac_nao_aparece", "Fração não aparece", FAIXA_NAO_APARECE),
        ("frac_cancela", "Fração cancela", FAIXA_CANCELA),
    ]
    fig, eixos = plt.subplots(2, len(parametros), figsize=(15, 6), sharey="row")
    for col, (param, nome, faixa) in enumerate(parametros):
        corte = (faixa[0] + faixa[1]) / 2
        grupos = [
            (f"≤ {corte:g}", [l for l in linhas if l[param] <= corte], COR_SERIE[0]),
            (f"> {corte:g}", [l for l in linhas if l[param] > corte], COR_SERIE[1]),
        ]
        for lin, (chave, rotulo) in enumerate([("perda_pct", "Perda (% lote)"),
                                               ("bloqueados_pct", "Bloqueados (%)")]):
            ax = eixos[lin][col]
            for legenda, sub, cor in grupos:
                dados = _por_janela(sub, chave, janelas)
                ys = [100 * _media_ic95(dados[j])[0] for j in janelas]
                ax.plot(janelas, ys, color=cor, marker="o", markersize=4,
                        markeredgecolor=FUNDO, label=legenda)
            _eixo_janela(ax, janelas)
            if lin == 0:
                ax.set_title(nome, loc="left")
                ax.legend(loc="best")
                ax.set_xlabel("")
            if col == 0:
                ax.set_ylabel(rotulo)
    fig.suptitle("Sensibilidade: metade inferior × superior da faixa de cada "
                 "parâmetro (médias)", x=0.01, ha="left", color=TINTA)
    fig.tight_layout()
    fig.savefig(caminho, dpi=DPI)
    plt.close(fig)


def grafico_convergencia(linhas, janelas, caminho, plt) -> None:
    """Média acumulada conforme N cresce. Escolher N onde a curva estabiliza."""
    escolhidas = [janelas[0], janelas[len(janelas) // 2], janelas[-1]]
    fig, eixos = plt.subplots(1, 2, figsize=(10, 4))
    for ax, chave, titulo in [
        (eixos[0], "perda_pct", "Perda (% do lote) — média acumulada"),
        (eixos[1], "bloqueados_pct", "Bloqueados (%) — média acumulada"),
    ]:
        dados = _por_janela(linhas, chave, escolhidas)
        for j, cor in zip(escolhidas, COR_SERIE):
            v = dados[j][~np.isnan(dados[j])]
            n = np.arange(1, len(v) + 1)
            media = np.cumsum(v) / n
            dp = np.array([v[:k].std(ddof=1) if k > 1 else 0.0 for k in n])
            ic = 1.96 * dp / np.sqrt(n)
            ax.fill_between(n, 100 * (media - ic), 100 * (media + ic),
                            color=cor, alpha=0.15, linewidth=0)
            ax.plot(n, 100 * media, color=cor, label=f"Janela {j:g} h")
        ax.set_xscale("log")
        ax.set_xlabel("Número de rodadas N (escala log)")
        ax.set_title(titulo, loc="left")
        ax.legend(loc="best")
    fig.suptitle("Convergência (faixa = IC 95% da média acumulada)", x=0.01,
                 ha="left", color=TINTA)
    fig.tight_layout()
    fig.savefig(caminho, dpi=DPI)
    plt.close(fig)


def grafico_sensibilidade_tempo(por_mediana, janelas, caminho, plt) -> None:
    """Janela × perda e janela × bloqueados, uma curva por mediana do tempo de chegada."""
    fig, eixos = plt.subplots(1, 2, figsize=(10, 4))
    for ax, chave, titulo in [
        (eixos[0], "perda_pct", "Perda (% do lote)"),
        (eixos[1], "bloqueados_pct", "Compradores bloqueados (% dos compradores)"),
    ]:
        for (mediana, linhas), cor in zip(por_mediana.items(), COR_SERIE):
            dados = _por_janela(linhas, chave, janelas)
            medias, ics = zip(*(_media_ic95(dados[j]) for j in janelas))
            medias, ics = 100 * np.array(medias), 100 * np.array(ics)
            ax.fill_between(janelas, medias - ics, medias + ics, color=cor,
                            alpha=0.25, linewidth=0)
            ax.plot(janelas, medias, color=cor, marker="o", markersize=5,
                    markeredgecolor=FUNDO, markeredgewidth=1.5,
                    label=f"Mediana {mediana:g} h")
        _eixo_janela(ax, janelas)
        ax.set_title(titulo, loc="left")
        ax.set_ylim(bottom=0)
        ax.legend(loc="best")
    n = len(_por_janela(next(iter(por_mediana.values())), "perda_pct",
                        janelas)[janelas[0]])
    fig.suptitle("Sensibilidade ao tempo que o cliente precisa para chegar "
                 f"(médias, faixa = IC 95%; N = {n} rodadas por janela)",
                 x=0.01, ha="left", color=TINTA)
    fig.tight_layout()
    fig.savefig(caminho, dpi=DPI)
    plt.close(fig)


def gerar_graficos(linhas, janelas, pasta: str, por_mediana=None) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    _estilo(plt)
    grafico_tradeoff(linhas, janelas, os.path.join(pasta, "h1_tradeoff.png"), plt)
    grafico_histogramas(linhas, janelas, os.path.join(pasta, "histogramas.png"), plt)
    grafico_sensibilidade(linhas, janelas, os.path.join(pasta, "sensibilidade.png"), plt)
    grafico_convergencia(linhas, janelas, os.path.join(pasta, "convergencia.png"), plt)
    if por_mediana is not None:
        grafico_sensibilidade_tempo(
            por_mediana, janelas,
            os.path.join(pasta, "sensibilidade_tempo_chegada.png"), plt)


# ====================================================================

def main() -> None:
    p = argparse.ArgumentParser(description="Monte Carlo da reserva (v0).")
    p.add_argument("--n", type=int, default=N_PADRAO, help="rodadas por janela")
    p.add_argument("--semente", type=int, default=SEMENTE)
    p.add_argument("--saida", default="resultados", help="pasta de saída")
    p.add_argument("--sem-graficos", action="store_true")
    args = p.parse_args()

    linhas = rodar_experimento(args.n, args.semente)
    resumir(linhas)
    por_mediana = rodar_sensibilidade_tempo_chegada(args.n, args.semente,
                                                    base=linhas)
    resumir_sensibilidade_tempo(por_mediana)

    os.makedirs(args.saida, exist_ok=True)
    salvar_csv(linhas, os.path.join(args.saida, "rodadas.csv"))
    salvar_csv([l for ls in por_mediana.values() for l in ls],
               os.path.join(args.saida, "rodadas_tempo_chegada.csv"))
    if not args.sem_graficos:
        gerar_graficos(linhas, JANELAS, args.saida, por_mediana)
    print(f"\nArquivos em {os.path.abspath(args.saida)}")
    print("Lembrete: parâmetros em faixa (base em parametros.md) — "
          "resultado é cenário projetado, não previsão.")


if __name__ == "__main__":
    main()
