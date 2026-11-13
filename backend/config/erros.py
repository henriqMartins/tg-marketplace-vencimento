"""
Formato único de erro da API (contrato): {"erro": "<frase>", "codigo": "<identificador>"}.
A tela mostra "erro" para a pessoa e decide o que fazer pelo "codigo".
"""
from rest_framework.response import Response
from rest_framework.views import exception_handler

CODIGO_POR_STATUS = {
    401: "nao_autenticado",
    403: "sem_permissao",
    404: "nao_encontrado",
    405: "metodo_nao_permitido",
}


def erro(status: int, mensagem: str, codigo: str, **extras) -> Response:
    """Resposta de erro pronta, no formato do contrato."""
    return Response({"erro": mensagem, "codigo": codigo, **extras}, status=status)


def tratar_erro(exc, context):
    """Converte os erros do DRF (401, 403, 404...) para o formato do contrato."""
    resposta = exception_handler(exc, context)
    if resposta is None:
        return None
    detalhe = resposta.data.get("detail") if isinstance(resposta.data, dict) else None
    resposta.data = {
        "erro": str(detalhe or "Requisição inválida."),
        "codigo": CODIGO_POR_STATUS.get(resposta.status_code, "requisicao_invalida"),
    }
    return resposta
