"""Critério 1: N pessoas disputando a ÚLTIMA unidade ao mesmo tempo."""
import os, sys, threading, httpx, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings"); django.setup()
from datetime import timedelta
from django.utils import timezone
from reservas.models import Oferta, Reserva

N = int(sys.argv[1]) if len(sys.argv) > 1 else 20
agora = timezone.now()
of = Oferta.objects.create(separado=1, livre=1, inicio=agora, fim=agora + timedelta(hours=8),
                           janela=timedelta(hours=2))
barreira, status = threading.Barrier(N), []
def cliente():
    barreira.wait()                       # todos disparam no mesmo instante
    status.append(httpx.post(f"http://127.0.0.1:8000/ofertas/{of.id}/reservar",
                             json={"pedido": 1}, timeout=30).status_code)
ts = [threading.Thread(target=cliente) for _ in range(N)]
[t.start() for t in ts]; [t.join() for t in ts]
of.refresh_from_db()
ativas = Reserva.objects.filter(oferta=of, estado="reservada").count()
print(f"201={status.count(201)}  409={status.count(409)}  outros={[s for s in status if s not in (201,409)]}")
print(f"livre no banco={of.livre}  reservas criadas={ativas}  conservação ok={of.livre + ativas == of.separado}")
