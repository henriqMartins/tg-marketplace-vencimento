"""
Concorrência do aceite (etapa 14): o dono toca "Aceitar" várias vezes ao mesmo tempo
(dois aparelhos, ou o dedo nervoso). Exige-se: um vínculo só, o convite marcado como
aceito uma vez, e os outros toques recusados com 409 convite_usado (nunca erro 500).

Mesmo molde de ofertas/test_concorrencia.py: uma thread por toque, cada uma com a
própria conexão; uma barreira solta todas juntas. TransactionTestCase para as
threads enxergarem os dados de verdade.

Rodar (dentro de backend/):  python manage.py test parceria.test_concorrencia
"""
import threading
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TransactionTestCase
from django.utils import timezone

from ofertas.models import Loja, Papel, Vinculo

from . import servico
from .models import Convite, EstadoConvite

TOQUES = 5
RODADAS = 5


class Aceites(TransactionTestCase):
    def setUp(self):
        self.marcos = get_user_model().objects.create_user(
            "marcos@example.com", email="marcos@example.com", password="x")

    def disputar(self):
        """Cria loja + convite e dispara TOQUES aceites juntos. Devolve (sucessos, recusas)."""
        loja = Loja.objects.create(nome="Mercearia", endereco="Rua A")
        convite = Convite.objects.create(loja=loja, email="marcos@example.com",
                                         codigo=f"c{loja.id}",
                                         expira_em=timezone.now() + timedelta(days=7))
        barreira = threading.Barrier(TOQUES)
        sucessos, recusas, erros = [], [], []

        def tocar():
            try:
                barreira.wait()
                sucessos.append(servico.aceitar_convite(self.marcos, convite.codigo).id)
            except servico.ErroParceria as e:
                recusas.append(e.codigo)
            except Exception as e:                    # erro inesperado = teste falha
                erros.append(e)
            finally:
                connection.close()

        threads = [threading.Thread(target=tocar) for _ in range(TOQUES)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(erros, [])
        return loja, sucessos, recusas

    def test_varios_aceites_ao_mesmo_tempo_um_vinculo_so(self):
        for rodada in range(RODADAS):
            with self.subTest(rodada=rodada):
                loja, sucessos, recusas = self.disputar()
                self.assertEqual(len(sucessos), 1)
                self.assertEqual(recusas, ["convite_usado"] * (TOQUES - 1))
                self.assertEqual(Vinculo.objects.filter(loja=loja, papel=Papel.RESPONSAVEL)
                                 .count(), 1)
                self.assertEqual(Convite.objects.get(loja=loja).estado, EstadoConvite.ACEITO)

    def test_controle_negativo_sem_a_trava(self):
        """
        Troca a leitura TRAVADA por uma comum. Os toques leem "pendente" juntos e passam
        da conferência; quem segura é a SEGUNDA tranca (um vínculo por loja, no banco):
        continua um vínculo só, mas a recusa vira "ja_vinculado" em vez de "convite_usado".
        Mostra que cada tranca faz a sua parte.
        """
        sem_trava = lambda convite: Convite.objects.get(pk=convite.pk)
        passaram = []
        with mock.patch.object(servico, "_travar", sem_trava):
            for _ in range(RODADAS):
                loja, sucessos, recusas = self.disputar()
                self.assertEqual(len(sucessos), 1)
                self.assertEqual(Vinculo.objects.filter(loja=loja).count(), 1)
                passaram.append(recusas.count("ja_vinculado"))
        print(f"\n[controle negativo] SEM trava, toques que passaram da conferência do "
              f"convite (barrados só pelo banco), por rodada: {passaram}")
        self.assertTrue(any(n > 0 for n in passaram),
                        "sem a trava nenhum toque colidiu: rode de novo")
