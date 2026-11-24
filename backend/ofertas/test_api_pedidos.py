"""
Testes do pedido (grupo J, etapa 15) — visão do consumidor: confirmar várias reservas
de uma loja com um código só, listar, ver e cancelar (seção 6 de docs/pedido.md).

Rodar (dentro de backend/):  python manage.py test ofertas.test_api_pedidos
"""
from datetime import timedelta

from django.db.models import F

from .models import Oferta, Pedido, Recusa, Reserva
from .test_api_consumidor import Base


def conservacao_fecha(teste, oferta):
    oferta.refresh_from_db()
    reservado = sum(r.quantidade for r in oferta.reservas.filter(estado="reservada"))
    teste.assertGreaterEqual(oferta.livre, 0)
    teste.assertEqual(oferta.separado, oferta.livre + reservado + oferta.retirado
                      + oferta.ajustado + oferta.perda)


class BasePedido(Base):
    def setUp(self):
        super().setUp()
        self.leite = self.nova_oferta(self.perto, "Leite integral 1 L", "leite", separado=5,
                                      preco="4.00", preco_original="5.00")
        self.pao = self.nova_oferta(self.perto, "Pão de forma 500 g", "mercearia", separado=2,
                                    preco="6.00", preco_original="8.00")
        self.de_longe = self.nova_oferta(self.longe, "Queijo", "frios")

    def confirmar(self, itens, loja=None, usuario=None):
        return self.post("/api/pedidos", {"loja_id": (loja or self.perto).id, "itens": itens},
                         usuario or self.ana)

    def item(self, oferta, pedido=1):
        return {"oferta_id": oferta.id, "pedido": pedido}


class TestConfirmar(BasePedido):
    def test_tres_itens_todos_confirmados_um_codigo(self):
        r = self.confirmar([self.item(self.iogurte, 2), self.item(self.leite, 1),
                            self.item(self.pao, 1)])
        self.assertEqual(r.status_code, 201)
        p = r.json()
        self.assertEqual(p["estado"], "ativo")
        self.assertRegex(p["codigo"], r"^[0-9]{6}$")
        self.assertEqual([i["status"] for i in p["itens"]], ["confirmada"] * 3)
        self.assertEqual(p["total"], "16.28")                 # 2×3.14 + 4.00 + 6.00
        self.assertEqual(p["loja"]["id"], self.perto.id)
        # Um pedido, três reservas, TODAS com o código do pedido.
        pedido = Pedido.objects.get()
        self.assertEqual(set(pedido.itens.values_list("codigo", flat=True)), {pedido.codigo})
        self.assertEqual(pedido.itens.count(), 3)
        for oferta in (self.iogurte, self.leite, self.pao):
            conservacao_fecha(self, oferta)

    def test_misto_parcial_e_recusado_responde_201_com_status_por_item(self):
        Oferta.objects.filter(pk=self.leite.pk).update(livre=0, ajustado=5)   # esgotado
        r = self.confirmar([self.item(self.pao, 3), self.item(self.leite, 1),
                            self.item(self.iogurte, 1)])
        self.assertEqual(r.status_code, 201)
        itens = r.json()["itens"]
        self.assertEqual([(i["status"], i["quantidade"]) for i in itens],
                         [("parcial", 2), ("recusada", 0), ("confirmada", 1)])
        self.assertEqual(itens[1]["motivo"], "esgotada")
        self.assertIsNone(itens[1]["reserva_id"])
        self.assertEqual(Recusa.objects.filter(oferta=self.leite).count(), 1)  # recusa gravada
        self.assertEqual(r.json()["total"], "15.14")                           # 2×6 + 3.14

    def test_tudo_esgotado_409_sem_codigo_mas_com_recusas(self):
        Oferta.objects.filter(pk__in=[self.leite.pk, self.pao.pk]).update(livre=0, ajustado=F("separado"))
        r = self.confirmar([self.item(self.leite), self.item(self.pao)])
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "tudo_esgotado"))
        self.assertEqual([i["status"] for i in r.json()["itens"]], ["recusada"] * 2)
        self.assertEqual(Pedido.objects.count(), 0)                 # nenhum código gerado
        self.assertEqual(Recusa.objects.count(), 2)

    def test_oferta_encerrada_vira_item_recusado(self):
        Oferta.objects.filter(pk=self.pao.pk).update(fim=self.agora - timedelta(minutes=1))
        r = self.confirmar([self.item(self.iogurte), self.item(self.pao)])
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()["itens"][1]["motivo"], "oferta_encerrada")
        self.assertEqual(Recusa.objects.count(), 0)                 # encerrada não é recusa

    def test_erros_de_entrada(self):
        casos = [([], "itens_vazios"),
                 ([self.item(self.iogurte), self.item(self.iogurte)], "item_repetido"),
                 ([self.item(self.iogurte, 0)], "pedido_invalido"),
                 ([{"oferta_id": self.iogurte.id, "pedido": True}], "pedido_invalido"),
                 ([self.item(self.de_longe)], "oferta_de_outra_loja"),
                 ([{"oferta_id": 999999, "pedido": 1}], "oferta_de_outra_loja")]
        for itens, codigo in casos:
            with self.subTest(codigo=codigo):
                r = self.confirmar(itens)
                self.assertEqual((r.status_code, r.json()["codigo"]), (400, codigo))
        self.assertEqual(Reserva.objects.count(), 0)

    def test_sem_login_401(self):
        r = self.client.post("/api/pedidos", {}, content_type="application/json")
        self.assertEqual(r.status_code, 401)

    def test_codigo_unico_entre_pedidos_ativos_da_loja(self):
        codigos = {self.confirmar([self.item(self.iogurte)]).json()["codigo"] for _ in range(5)}
        self.assertEqual(len(codigos), 5)

    def test_reservar_so_este_vira_pedido_de_1_item(self):
        r = self.post(f"/api/ofertas/{self.iogurte.id}/reservas", {"pedido": 2}, self.ana)
        reserva = r.json()["reserva"]
        pedido = Pedido.objects.get(pk=reserva["pedido_id"])
        self.assertEqual(pedido.codigo, reserva["codigo"])
        self.assertEqual(pedido.itens.count(), 1)


class TestVerListarCancelar(BasePedido):
    def setUp(self):
        super().setUp()
        p = self.confirmar([self.item(self.iogurte, 2), self.item(self.leite, 1)]).json()
        self.pedido_id, self.itens = p["id"], p["itens"]

    def ver(self, usuario=None):
        return self.get(f"/api/pedidos/{self.pedido_id}", usuario or self.ana)

    def test_so_o_dono_ve(self):
        self.assertEqual(self.ver().status_code, 200)
        self.assertEqual(self.ver(self.bia).status_code, 404)
        r = self.post(f"/api/pedidos/{self.pedido_id}/cancelar", usuario=self.bia)
        self.assertEqual(r.status_code, 404)

    def test_cancelar_um_item_devolve_so_ele(self):
        iogurte = self.itens[0]["reserva_id"]
        r = self.post(f"/api/pedidos/{self.pedido_id}/itens/{iogurte}/cancelar", usuario=self.ana)
        self.assertEqual(r.status_code, 200)
        p = r.json()
        self.assertEqual([i["estado"] for i in p["itens"]], ["cancelada", "reservada"])
        self.assertEqual((p["estado"], p["total"]), ("ativo", "4.00"))
        self.iogurte.refresh_from_db()
        self.assertEqual(self.iogurte.livre, 10)                   # voltou ao livre
        conservacao_fecha(self, self.leite)
        r = self.post(f"/api/pedidos/{self.pedido_id}/itens/{iogurte}/cancelar", usuario=self.ana)
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "ja_encerrado"))

    def test_item_de_outro_pedido_404(self):
        outro = self.confirmar([self.item(self.pao)]).json()["itens"][0]["reserva_id"]
        r = self.post(f"/api/pedidos/{self.pedido_id}/itens/{outro}/cancelar", usuario=self.ana)
        self.assertEqual(r.status_code, 404)

    def test_cancelar_o_pedido(self):
        r = self.post(f"/api/pedidos/{self.pedido_id}/cancelar", usuario=self.ana)
        self.assertEqual((r.json()["estado"], r.json()["total"]), ("encerrado", "0.00"))
        for oferta in (self.iogurte, self.leite):
            conservacao_fecha(self, oferta)
        r = self.post(f"/api/pedidos/{self.pedido_id}/cancelar", usuario=self.ana)
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "nada_ativo"))

    def test_item_vencido_sai_e_o_codigo_vale_para_o_resto(self):
        Reserva.objects.filter(pk=self.itens[0]["reserva_id"]).update(
            expira_em=self.agora - timedelta(minutes=1))
        p = self.ver().json()
        self.assertEqual([i["estado"] for i in p["itens"]], ["expirada", "reservada"])
        self.assertEqual((p["estado"], p["total"]), ("ativo", "4.00"))
        self.assertEqual(p["expira_em_proximo"], p["itens"][1]["expira_em"])

    def test_listar_ativos_e_encerrados(self):
        outro = self.confirmar([self.item(self.pao)]).json()["id"]
        self.post(f"/api/pedidos/{outro}/cancelar", usuario=self.ana)
        todos = self.get("/api/pedidos", self.ana).json()
        self.assertEqual([p["id"] for p in todos], [self.pedido_id, outro])   # ativos primeiro
        ativos = self.get("/api/pedidos", self.ana, estado="ativo").json()
        self.assertEqual([p["id"] for p in ativos], [self.pedido_id])
        encerrados = self.get("/api/pedidos", self.ana, estado="encerrado").json()
        self.assertEqual([p["id"] for p in encerrados], [outro])
        self.assertEqual(self.get("/api/pedidos", self.ana, estado="x").status_code, 400)
        self.assertEqual(self.get("/api/pedidos", self.bia).json(), [])


class TestBalcao(BasePedido):
    """L12 → L13: a loja digita UM código e retira todos os itens ativos do pedido."""

    def setUp(self):
        super().setUp()
        from django.contrib.auth import get_user_model

        from .models import Vinculo
        self.carlos = get_user_model().objects.create_user(
            "carlos@email.com", email="carlos@email.com", password="x", nome="Carlos Lima")
        Vinculo.objects.create(usuario=self.carlos, loja=self.perto, papel="funcionario")
        p = self.confirmar([self.item(self.iogurte, 2), self.item(self.leite, 1),
                            self.item(self.pao, 1)]).json()
        self.codigo, self.itens = p["codigo"], p["itens"]
        self.url = f"/api/lojas/{self.perto.id}"

    def previa(self, codigo=None, usuario=None):
        return self.get(f"{self.url}/pedidos/ativo", usuario or self.carlos,
                        codigo=codigo or self.codigo)

    def retirar(self, codigo=None):
        return self.post(f"{self.url}/retiradas", {"codigo": codigo or self.codigo}, self.carlos)

    def test_previa_lista_os_itens_ativos(self):
        r = self.previa()
        self.assertEqual(r.status_code, 200)
        b = r.json()
        self.assertEqual((b["codigo"], b["cliente"], b["total"]), (self.codigo, "Ana S.", "16.28"))
        self.assertEqual([i["produto"] for i in b["itens"]],
                         ["Iogurte natural 170 g", "Leite integral 1 L", "Pão de forma 500 g"])
        self.assertEqual(b["itens"][0]["reserva"]["codigo_final"], self.codigo[-3:])
        self.assertEqual(Reserva.objects.filter(estado="retirada").count(), 0)   # só leu

    def test_retirada_retira_o_pedido_inteiro(self):
        r = self.retirar()
        self.assertEqual(r.status_code, 200)
        b = r.json()
        self.assertEqual((b["total"], b["retirada_por"], len(b["itens"])), ("16.28", "Carlos Lima", 3))
        self.assertEqual(b["itens"][1]["oferta"]["estoque"]["retirado"], 1)
        self.assertEqual(Reserva.objects.filter(estado="retirada", retirada_por=self.carlos).count(), 3)
        for oferta in (self.iogurte, self.leite, self.pao):
            conservacao_fecha(self, oferta)
        self.assertEqual(self.retirar().status_code, 404)                 # código já usado
        pedido = self.get(f"/api/pedidos/{Pedido.objects.get().id}", self.ana).json()
        self.assertEqual((pedido["estado"], pedido["total"]), ("retirado", "16.28"))

    def test_item_vencido_fica_fora_da_retirada(self):
        Reserva.objects.filter(pk=self.itens[1]["reserva_id"]).update(
            expira_em=self.agora - timedelta(minutes=1))
        self.assertEqual(len(self.previa().json()["itens"]), 2)
        r = self.retirar()
        self.assertEqual(r.status_code, 200)
        self.assertEqual([i["produto"] for i in r.json()["itens"]],
                         ["Iogurte natural 170 g", "Pão de forma 500 g"])
        self.assertEqual(Reserva.objects.get(pk=self.itens[1]["reserva_id"]).estado, "expirada")
        conservacao_fecha(self, self.leite)

    def test_tudo_vencido_responde_venceu(self):
        Reserva.objects.update(expira_em=self.agora - timedelta(minutes=1))
        r = self.retirar()
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "venceu"))
        self.assertEqual(Reserva.objects.filter(estado="expirada").count(), 3)  # gravado
        self.assertEqual(self.previa().json()["codigo"], "venceu")

    def test_item_cancelado_nao_aparece(self):
        pedido_id = Pedido.objects.get().id
        self.post(f"/api/pedidos/{pedido_id}/itens/{self.itens[0]['reserva_id']}/cancelar",
                  usuario=self.ana)
        self.assertEqual(self.previa().json()["total"], "10.00")
        self.assertEqual(len(self.retirar().json()["itens"]), 2)

    def test_codigo_de_outra_loja_ou_sem_vinculo(self):
        self.assertEqual(self.get(f"/api/lojas/{self.longe.id}/pedidos/ativo", self.carlos,
                                  codigo=self.codigo).status_code, 403)
        self.assertEqual(self.previa("000000").json()["codigo"], "nao_encontrado")
        self.assertEqual(self.previa(usuario=self.bia).status_code, 403)
