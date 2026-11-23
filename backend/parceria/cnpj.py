"""
CNPJ: conferir os dígitos verificadores e consultar a Receita (BrasilAPI).

A consulta é feita PELO BACKEND (docs/parceria.md, seção 4): se fosse no navegador,
quem usa o app poderia mandar "verificado: true" sem a consulta ter acontecido.

Sem dependência nova: o cliente HTTP é o urllib da biblioteca padrão. Nos testes,
a função urlopen deste módulo é trocada por uma simulada (nenhum teste usa rede).
"""
import json
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

URL_BRASILAPI = "https://brasilapi.com.br/api/cnpj/v1/{cnpj}"
TIMEOUT_S = 5                      # "lenta" (> 5 s) conta como fora do ar
GRUPOS_ALIMENTOS = ("471", "472")  # CNAE 47.1 (supermercados/minimercados) e 47.2 (alimentos)

PESOS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
PESOS_2 = [6] + PESOS_1


class CnpjNaoEncontrado(Exception):
    """A Receita respondeu: esse CNPJ não existe."""


class ReceitaIndisponivel(Exception):
    """A consulta não deu certo (fora do ar, lenta, resposta estranha)."""


def so_digitos(texto) -> str:
    """'11.222.333/0001-81' -> '11222333000181' (a máscara é da tela)."""
    return re.sub(r"\D", "", str(texto or ""))


def _digito(numeros: str, pesos: list) -> str:
    resto = sum(int(n) * p for n, p in zip(numeros, pesos)) % 11
    return "0" if resto < 2 else str(11 - resto)


# 📖 ESTUDAR: o dígito verificador. Os 12 primeiros dígitos são multiplicados por
# pesos fixos e somados; o resto da divisão por 11 dá o 13º dígito. Repete com o
# 13º incluído para achar o 14º. Um dígito digitado errado (ou dois trocados de
# lugar) quase sempre muda o resultado: o erro é pego sem chamar a Receita.
def cnpj_valido(cnpj: str) -> bool:
    if not re.fullmatch(r"[0-9]{14}", cnpj or ""):
        return False
    if cnpj == cnpj[0] * 14:     # 00000000000000, 11111111111111...: passam na conta, mas não existem
        return False
    primeiro = _digito(cnpj[:12], PESOS_1)
    segundo = _digito(cnpj[:12] + primeiro, PESOS_2)
    return cnpj[12:] == primeiro + segundo


def _buscar_json(cnpj: str) -> dict:
    """Chamada de rede. Traduz as falhas nas duas exceções deste módulo."""
    pedido = Request(URL_BRASILAPI.format(cnpj=cnpj),
                     headers={"Accept": "application/json", "User-Agent": "tg-marketplace"})
    try:
        with urlopen(pedido, timeout=TIMEOUT_S) as resposta:
            return json.loads(resposta.read().decode("utf-8"))
    except HTTPError as e:
        if e.code == 404:
            raise CnpjNaoEncontrado(cnpj) from e
        raise ReceitaIndisponivel(f"BrasilAPI respondeu {e.code}") from e
    except (URLError, TimeoutError, OSError, ValueError) as e:   # rede, tempo, JSON quebrado
        raise ReceitaIndisponivel(str(e)) from e


def consultar(cnpj: str) -> dict:
    """ConsultaCnpj do contrato (grupo I), a partir da resposta da BrasilAPI."""
    d = _buscar_json(cnpj)
    if not isinstance(d, dict):
        raise ReceitaIndisponivel("resposta inesperada")
    situacao = str(d.get("descricao_situacao_cadastral") or "").upper()
    codigo_cnae = str(d["cnae_fiscal"]).zfill(7) if d.get("cnae_fiscal") else ""
    logradouro = " ".join(x for x in (d.get("descricao_tipo_de_logradouro"),
                                      d.get("logradouro")) if x)
    return {
        "cnpj": cnpj,
        "razao_social": d.get("razao_social") or "",
        "nome_fantasia": d.get("nome_fantasia") or "",
        "situacao": situacao,
        "ativa": situacao == "ATIVA",
        "cnae_principal": {"codigo": codigo_cnae,
                           "descricao": d.get("cnae_fiscal_descricao") or ""},
        "alimentar": codigo_cnae[:3] in GRUPOS_ALIMENTOS,
        "endereco": {"logradouro": logradouro, "numero": d.get("numero") or "",
                     "bairro": d.get("bairro") or "", "municipio": d.get("municipio") or "",
                     "uf": d.get("uf") or "", "cep": so_digitos(d.get("cep"))},
    }
