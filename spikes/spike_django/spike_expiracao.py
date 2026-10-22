"""Critério 2: reserva com TTL curto volta ao livre sozinha, pelo worker."""
import os, time, subprocess, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings"); django.setup()
from datetime import timedelta
from django.utils import timezone
from reservas.models import Oferta, Reserva
from reservas import servico

agora = timezone.now()
of = Oferta.objects.create(separado=3, livre=3, inicio=agora, fim=agora + timedelta(hours=1),
                           janela=timedelta(seconds=3))           # TTL curto
r = servico.reservar(of.id, 3); of.refresh_from_db()
print(f"t=0s   reservou {r.quantidade}  livre={of.livre}")
worker = subprocess.Popen(["python3", "manage.py", "expirar", "--loop", "1"],
                          stdout=subprocess.DEVNULL)               # o 'worker' do Railway
time.sleep(5)                                                      # ninguém chama a API
worker.terminate(); of.refresh_from_db()
estados = list(Reserva.objects.filter(oferta=of).values_list("estado", flat=True))
print(f"t=5s   livre={of.livre}  estados={estados}   (sem nenhuma requisição)")

# idempotência: rodar o job de novo não devolve duas vezes
servico.expirar_vencidas(); of.refresh_from_db()
print(f"job 2x livre={of.livre}  (tem de continuar 3, não 6)")

# verificação preguiçosa: sem worker, a própria reserva seguinte expira a vencida
of2 = Oferta.objects.create(separado=1, livre=1, inicio=agora, fim=agora + timedelta(hours=1),
                            janela=timedelta(seconds=2))
servico.reservar(of2.id, 1); time.sleep(3)
r2 = servico.reservar(of2.id, 1)
print(f"preguiçosa: 2ª reserva após vencer -> {'sucesso' if r2 else 'recusa'}; "
      f"estados={list(Reserva.objects.filter(oferta=of2).order_by('numero').values_list('estado', flat=True))}")
