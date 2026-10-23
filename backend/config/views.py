from django.db import DatabaseError, connection
from django.http import JsonResponse


def health(request):
    """
    "A API está de pé E fala com o banco?" — usado pelo Render e pelo frontend
    (que mostra "carregando" enquanto a API acorda). Consulta o banco de verdade:
    um "ok" fixo diria só que o programa ligou, não que o sistema funciona.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return JsonResponse({"status": "erro", "banco": "indisponível"}, status=503)
    return JsonResponse({"status": "ok", "banco": "ok"})
