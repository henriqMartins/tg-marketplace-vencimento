import time
from django.core.management.base import BaseCommand
from reservas import servico


class Command(BaseCommand):
    help = "Devolve ao livre as reservas vencidas. --loop N = repete a cada N segundos."

    def add_arguments(self, p):
        p.add_argument("--loop", type=float, default=0)

    def handle(self, *a, loop, **k):
        while True:
            n = servico.expirar_vencidas()
            self.stdout.write(f"expiradas: {n}")
            if not loop:
                break
            time.sleep(loop)
