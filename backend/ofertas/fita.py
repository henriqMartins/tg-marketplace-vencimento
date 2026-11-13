"""
Cor da fita (método de conferência na gôndola).

6 cores fixas, uma por BIMESTRE de vencimento (data absoluta, não tempo restante),
ciclo anual, iguais para qualquer produto. A fita acelera a conferência, mas não
substitui a data: a tela mostra sempre a cor junto com a validade exata.

A cor NÃO é guardada no banco: sai da validade, que já está lá.
"""
from datetime import date

# 📖 ESTUDAR: a regra inteira é uma conta. (mês - 1) // 2 transforma o mês (1..12)
# no número do bimestre (0..5): jan,fev -> 0; mar,abr -> 1; ... nov,dez -> 5.
# "//" é a divisão que descarta o resto (7 // 2 = 3). O índice escolhe a cor na lista.
CORES = ["vermelho", "amarelo", "verde", "azul", "branco", "preto"]
BIMESTRES = ["jan–fev", "mar–abr", "mai–jun", "jul–ago", "set–out", "nov–dez"]


def fita(validade: date) -> dict:
    """{"cor", "bimestre", "ano"} no formato do contrato. O ano separa grupos de fita
    da mesma cor em anos diferentes (é o que gera o aviso de colisão de ciclo)."""
    bimestre = (validade.month - 1) // 2
    return {"cor": CORES[bimestre], "bimestre": BIMESTRES[bimestre], "ano": validade.year}


# 📖 ESTUDAR: a regra do agrupamento (decidida 05/11 e 12/11/2026), sem banco.
# `ativos` = grupos do produto que NÃO estão encerrados; cada um tem cor, ano,
# referencia e `aberto` (True = ainda não virou oferta, pode receber lote).
#   1. existe grupo ABERTO da mesma cor e do mesmo ano  -> "agrupado" nele;
#   2. senão, existe grupo ativo da mesma cor e de OUTRO ano -> "colisao":
#      cria grupo novo e avisa (na gôndola, duas fitas iguais de anos diferentes);
#   3. senão -> "novo".
def classificar_lote(validade: date, ativos) -> tuple:
    """Devolve (resultado, grupo_onde_entra | None, validade_da_colisao | None)."""
    minha = fita(validade)
    for g in ativos:
        if g.aberto and g.cor == minha["cor"] and g.ano == minha["ano"]:
            return "agrupado", g, None
    for g in ativos:
        if g.cor == minha["cor"] and g.ano != minha["ano"]:
            return "colisao", None, g.referencia
    return "novo", None, None
