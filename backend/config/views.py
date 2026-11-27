from django.db import DatabaseError, connection
from django.http import JsonResponse


def health(request):
    """
    "A API está de pé E fala com o banco?" — GET /health (Render) e GET /api/saude
    (frontend, que mostra "carregando" enquanto a API acorda; o /health é barrado por
    bloqueadores de anúncio). Sem login nas duas. Consulta o banco de verdade:
    um "ok" fixo diria só que o programa ligou, não que o sistema funciona.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return JsonResponse({"status": "erro", "banco": "indisponível"}, status=503)
    return JsonResponse({"status": "ok", "banco": "ok"})
