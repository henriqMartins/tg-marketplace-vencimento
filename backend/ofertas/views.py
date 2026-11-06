import secrets

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from . import servico


@csrf_exempt          # chamado por outro servidor (Vercel), não por um formulário do navegador
@require_POST         # só POST: GET -> 405 (a varredura MUDA dados)
def varrer(request):
    """
    Endpoint da varredura diária (regra 6), chamado pelo agendamento da Vercel.
    Exige o cabeçalho  Authorization: Bearer <CRON_TOKEN>.
    Sem CRON_TOKEN configurado, recusa SEMPRE: esquecer de configurar nunca
    deixa a porta aberta.
    """
    esperado = settings.CRON_TOKEN
    if not esperado:
        return JsonResponse({"erro": "varredura desativada: CRON_TOKEN não configurado"},
                            status=503)
    cabecalho = request.headers.get("Authorization", "")
    if not cabecalho.startswith("Bearer "):
        return JsonResponse({"erro": "token ausente"}, status=401)
    recebido = cabecalho.removeprefix("Bearer ")
    # compare_digest: o tempo da comparação não revela quantos caracteres acertou.
    if not secrets.compare_digest(recebido.encode(), esperado.encode()):
        return JsonResponse({"erro": "token inválido"}, status=403)
    return JsonResponse(servico.varrer())
