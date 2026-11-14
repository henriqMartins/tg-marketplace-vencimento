"""
Testes dos pedidos do frontend aceitos em 13/11/2026 (docs/api/pedidos-do-front.md):
  1. `retirar_ate` na oferta (C4: "Retire até 20:00" antes de reservar);
  3. `validade` na prévia da retirada (L13: a fita sempre com a data exata);
  4. PATCH do papel de um vínculo (G6: promover/rebaixar sem remover e readicionar).
(O pedido 2 é só texto no contrato: `aguardando_retirada` conta reservas.)

Rodar (dentro de backend/):  python manage.py test ofertas.test_pedidos_front
"""
from datetime import datetime, timedelta

from django.utils import timezone

from .models import Oferta, Papel, Vinculo
from .test_api_config import Base


class TestRetirarAte(Base):

    def detalhe(self):
        return self.get(f"/api/ofertas/{self.iogurte.id}").json()

    def test_vitrine_e_detalhe_trazem_retirar_ate(self):
        antes = timezone.now()
        item = self.get("/api/ofertas").json()[0]
        ate = datetime.fromisoformat(item["retirar_ate"])
        # janela de 4 h, fim daqui a 7 dias: agora + 4 h (com folga do relógio do teste)
        self.assertLessEqual(abs(ate - (antes + timedelta(hours=4))), timedelta(seconds=5))
        self.assertTrue(item["retirar_ate"].endswith("-03:00"))           # horário de Brasília
        self.assertIn("retirar_ate", self.detalhe())

    def test_nunca_passa_do_fim_da_oferta(self):
        fim = timezone.now() + timedelta(hours=2)                          # janela é de 4 h
        Oferta.objects.filter(pk=self.iogurte.pk).update(fim=fim)
        ate = datetime.fromisoformat(self.detalhe()["retirar_ate"])
        # data() do serviço arredonda ao segundo (o expira_em gravado também)
        self.assertLessEqual(abs(ate - fim), timedelta(seconds=1))

    def test_e_o_mesmo_prazo_que_a_reserva_grava(self):
        mostrado = datetime.fromisoformat(self.detalhe()["retirar_ate"])
        r = self.post(f"/api/ofertas/{self.iogurte.id}/reservas", {"pedido": 1}, self.ana)
        gravado = datetime.fromisoformat(r.json()["reserva"]["expira_em"])
        self.assertLessEqual(abs(gravado - mostrado), timedelta(seconds=5))   # segundos depois

    def test_oferta_encerrada_vem_null(self):
        Oferta.objects.filter(pk=self.iogurte.pk).update(fim=timezone.now() - timedelta(minutes=1))
        self.assertIsNone(self.detalhe()["retirar_ate"])


class TestValidadeNaPrevia(Base):

    def test_previa_traz_a_validade(self):
        reserva = self.reservar(self.iogurte, self.ana, 1)
        r = self.get(f"{self.url}/reservas/ativa", self.joana, codigo=reserva.codigo)
        self.assertEqual(r.json()["validade"], self.iogurte.validade.isoformat())


class TestTrocarPapel(Base):

    def trocar(self, usuario, papel, quem=None):
        return self.patch(f"{self.url}/vinculos/{self.vinculo(usuario).id}", {"papel": papel},
                          quem or self.carlos)

    def test_promove_funcionaria_a_responsavel(self):
        r = self.trocar(self.joana, "responsavel")
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.json()["papel"], r.json()["eu"]), ("responsavel", False))
        self.assertEqual(self.vinculo(self.joana).papel, Papel.RESPONSAVEL)
        self.assertEqual(self.patch(self.url, {"margem_fim_dias": 2}, self.joana).status_code, 200)

    def test_rebaixa_outro_responsavel(self):
        Vinculo.objects.create(usuario=self.bia, loja=self.perto, papel=Papel.RESPONSAVEL)
        self.assertEqual(self.trocar(self.bia, "funcionario").status_code, 200)
        self.assertEqual(self.vinculo(self.bia).papel, Papel.FUNCIONARIO)

    def test_mesmo_papel_e_200_sem_mudar_nada(self):
        self.assertEqual(self.trocar(self.joana, "funcionario").status_code, 200)

    def test_proprio_papel_409(self):
        r = self.trocar(self.carlos, "funcionario")
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "proprio_vinculo"))
        self.assertEqual(self.vinculo(self.carlos).papel, Papel.RESPONSAVEL)

    def test_funcionario_nao_troca_403(self):
        r = self.trocar(self.joana, "responsavel", quem=self.joana)
        self.assertEqual(r.status_code, 403)

    def test_papel_invalido_400(self):
        for papel in ("dono", None, 1):
            with self.subTest(papel=papel):
                r = self.trocar(self.joana, papel)
                self.assertEqual((r.status_code, r.json()["codigo"]), (400, "papel_invalido"))

    def test_vinculo_de_outra_loja_404(self):
        de_la = Vinculo.objects.get(usuario=self.rosa)
        r = self.patch(f"{self.url}/vinculos/{de_la.id}", {"papel": "funcionario"}, self.carlos)
        self.assertEqual(r.status_code, 404)
        self.assertEqual(Vinculo.objects.get(pk=de_la.pk).papel, Papel.RESPONSAVEL)
