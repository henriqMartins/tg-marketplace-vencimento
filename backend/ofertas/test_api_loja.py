"""
Testes da API da loja (etapa 9, grupo C do contrato): resumo do dia, ofertas da
loja, detalhe com reservas (código mascarado), ajuste e retirada no balcão.

Todas as rotas exigem vínculo com a loja do endereço (funcionário ou responsável).
As rotas usam o relógio REAL, então as ofertas são criadas em volta de agora().

Rodar (dentro de backend/):  python manage.py test ofertas.test_api_loja
"""
from datetime import timedelta

from django.contrib.auth import get_user_model

from . import servico
from .models import Ajuste, Loja, Oferta, Papel, Reserva, Vinculo
from .test_api_consumidor import Base as BaseConsumidor


class Base(BaseConsumidor):
    """
    Herda da etapa 8: lojas (perto/longe), Ana e Bia (consumidoras), a oferta de
    iogurte na loja "perto" e os ajudantes get/post com token.
    Acrescenta a equipe: Carlos (responsável) e Joana (funcionária) da loja "perto";
    Rosa é responsável da OUTRA loja (tem vínculo, mas não com esta).
    """

    def setUp(self):
        super().setUp()
        Usuario = get_user_model()
        self.carlos = Usuario.objects.create_user("carlos@vilanova.com", email="carlos@vilanova.com",
                                                  password="x", nome="Carlos Lima")
        self.joana = Usuario.objects.create_user("joana@vilanova.com", email="joana@vilanova.com",
                                                 password="x", nome="Joana Prado")
        self.rosa = Usuario.objects.create_user("rosa@emporio.com", email="rosa@emporio.com",
                                                password="x", nome="Rosa")
        Vinculo.objects.create(usuario=self.carlos, loja=self.perto, papel=Papel.RESPONSAVEL)
        Vinculo.objects.create(usuario=self.joana, loja=self.perto, papel=Papel.FUNCIONARIO)
        Vinculo.objects.create(usuario=self.rosa, loja=self.longe, papel=Papel.RESPONSAVEL)
        # Começou ontem, para dar para criar reservas "no passado" (já vencidas).
        Oferta.objects.filter(pk=self.iogurte.pk).update(inicio=self.agora - timedelta(days=1))
        self.iogurte.refresh_from_db()
        self.url = f"/api/lojas/{self.perto.id}"

    def reservar(self, oferta, quem, pedido, horas_atras=0):
        """Reserva de verdade (pelo serviço), feita `horas_atras` horas atrás."""
        return servico.reservar(oferta.id, quem, pedido,
                                agora=self.agora - timedelta(hours=horas_atras))

    def conferir_conservacao(self, estoque):
        self.assertEqual(estoque["separado"],
                         estoque["livre"] + estoque["reservado"] + estoque["retirado"]
                         + estoque["ajustado"] + estoque["perda"])


class TestPorteiro(Base):
    """Quem pode entrar nas rotas da loja."""

    def rotas_get(self):
        return [f"{self.url}/resumo-do-dia", f"{self.url}/ofertas",
                f"{self.url}/ofertas/{self.iogurte.id}",
                f"{self.url}/reservas/ativa?codigo=123456"]

    def test_sem_login_401(self):
        r = self.get(f"{self.url}/resumo-do-dia")
        self.assertEqual((r.status_code, r.json()["codigo"]), (401, "nao_autenticado"))

    def test_consumidor_sem_vinculo_403_em_todas(self):
        for url in self.rotas_get():
            r = self.get(url, self.ana)
            self.assertEqual((r.status_code, r.json()["codigo"]), (403, "sem_permissao"), url)
        for url, corpo in [(f"{self.url}/ofertas/{self.iogurte.id}/ajustes",
                            {"quantidade": 1, "motivo": "Danificada"}),
                           (f"{self.url}/retiradas", {"codigo": "123456"})]:
            self.assertEqual(self.post(url, corpo, self.ana).status_code, 403, url)

    def test_responsavel_de_outra_loja_403(self):
        # Ter vínculo com ALGUMA loja não basta: tem de ser com ESTA.
        self.assertEqual(self.get(f"{self.url}/resumo-do-dia", self.rosa).status_code, 403)

    def test_funcionario_e_responsavel_entram(self):
        for quem in (self.joana, self.carlos):
            self.assertEqual(self.get(f"{self.url}/resumo-do-dia", quem).status_code, 200)

    def test_oferta_de_outra_loja_404(self):
        alheia = self.nova_oferta(self.longe, "Leite 1 L", "leite")
        r = self.get(f"{self.url}/ofertas/{alheia.id}", self.joana)
        self.assertEqual((r.status_code, r.json()["codigo"]), (404, "nao_encontrada"))
        r = self.post(f"{self.url}/ofertas/{alheia.id}/ajustes",
                      {"quantidade": 1, "motivo": "Danificada"}, self.joana)
        self.assertEqual(r.status_code, 404)
        alheia.refresh_from_db()
        self.assertEqual(alheia.ajustado, 0)


class TestResumoDoDia(Base):

    def test_formato_e_contagens(self):
        self.reservar(self.iogurte, self.ana, 2)                   # vence daqui a 4 h
        self.reservar(self.iogurte, self.bia, 1, horas_atras=3.5)  # vence daqui a 30 min
        corpo = self.get(f"{self.url}/resumo-do-dia", self.joana).json()
        self.assertEqual(corpo["loja"]["nome"], "Mercadinho Vila Nova")
        self.assertEqual(corpo["papel"], "funcionario")
        self.assertEqual(corpo["aguardando_retirada"], 2)          # reservas, não unidades
        self.assertEqual(corpo["expiram_em_1h"], 1)
        self.assertEqual(corpo["ofertas_ativas"], 1)
        self.assertEqual(corpo["avisos_para_conferir"], 0)         # avisos chegam na etapa 10

    def test_papel_do_responsavel(self):
        self.assertEqual(self.get(f"{self.url}/resumo-do-dia", self.carlos).json()["papel"],
                         "responsavel")

    def test_reserva_vencida_nao_conta_e_e_gravada_como_expirada(self):
        r = self.reservar(self.iogurte, self.ana, 3, horas_atras=5)   # venceu há 1 h
        corpo = self.get(f"{self.url}/resumo-do-dia", self.joana).json()
        self.assertEqual(corpo["aguardando_retirada"], 0)
        r.refresh_from_db()
        self.assertEqual(r.estado, "expirada")                     # a ronda da loja rodou
        self.iogurte.refresh_from_db()
        self.assertEqual(self.iogurte.livre, 10)

    def test_oferta_que_passou_do_fim_nao_conta_como_ativa(self):
        self.nova_oferta(self.perto, "Pão de forma", "mercearia",
                         inicio=self.agora - timedelta(days=3),
                         fim=self.agora - timedelta(minutes=1))
        corpo = self.get(f"{self.url}/resumo-do-dia", self.joana).json()
        self.assertEqual(corpo["ofertas_ativas"], 1)


class TestOfertasDaLoja(Base):

    def test_formato_do_contrato(self):
        self.reservar(self.iogurte, self.ana, 4)
        item = self.get(f"{self.url}/ofertas", self.joana).json()[0]
        self.assertEqual(item["produto"], {"nome": "Iogurte natural 170 g", "categoria": "laticinios"})
        self.assertEqual(item["fita"], {"cor": "branco", "bimestre": "set–out", "ano": 2026})
        self.assertEqual((item["preco"], item["preco_original"], item["desconto"]),
                         ("3.14", "4.49", 30))
        self.assertEqual((item["validade"], item["janela_horas"], item["estado"]),
                         ("2026-10-28", 4, "ativa"))
        self.assertEqual(item["estoque"], {"separado": 10, "livre": 6, "reservado": 4,
                                           "retirado": 0, "ajustado": 0, "perda": 0})
        self.conferir_conservacao(item["estoque"])
        self.assertTrue(item["fim"].endswith("-03:00"))

    def test_so_as_ofertas_desta_loja(self):
        self.nova_oferta(self.longe, "Leite 1 L", "leite")
        nomes = [o["produto"]["nome"] for o in self.get(f"{self.url}/ofertas", self.joana).json()]
        self.assertEqual(nomes, ["Iogurte natural 170 g"])

    def test_filtro_por_estado(self):
        self.nova_oferta(self.perto, "Pão de forma", "mercearia",
                         inicio=self.agora - timedelta(days=3),
                         fim=self.agora - timedelta(minutes=1))   # a ronda da loja encerra
        ativas = self.get(f"{self.url}/ofertas", self.joana, estado="ativa").json()
        encerradas = self.get(f"{self.url}/ofertas", self.joana, estado="encerrada").json()
        todas = self.get(f"{self.url}/ofertas", self.joana).json()
        self.assertEqual([o["produto"]["nome"] for o in ativas], ["Iogurte natural 170 g"])
        self.assertEqual([o["produto"]["nome"] for o in encerradas], ["Pão de forma"])
        self.assertEqual(encerradas[0]["estoque"]["perda"], 10)       # sobra virou perda
        self.assertEqual(len(todas), 2)

    def test_estado_invalido_400(self):
        r = self.get(f"{self.url}/ofertas", self.joana, estado="xyz")
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "parametro_invalido"))


class TestDetalheDaOferta(Base):

    def test_reservas_ativas_com_codigo_mascarado(self):
        reserva = self.reservar(self.iogurte, self.ana, 2)
        corpo = self.get(f"{self.url}/ofertas/{self.iogurte.id}", self.joana).json()
        self.assertEqual(corpo["estoque"]["reservado"], 2)
        [item] = corpo["reservas"]
        self.assertEqual(item["codigo_final"], reserva.codigo[-3:])
        self.assertNotIn("codigo", item)                  # o código inteiro NÃO vai para a loja
        self.assertEqual(item["cliente"], "Ana S.")
        self.assertEqual((item["quantidade"], item["pedido"], item["estado"]), (2, 2, "reservada"))
        self.assertIsNone(item["encerrada_em"])

    def test_oferta_ativa_so_mostra_as_reservas_ativas(self):
        cancelada = self.reservar(self.iogurte, self.ana, 1)
        servico.cancelar(cancelada.id)
        self.reservar(self.iogurte, self.bia, 2)
        reservas = self.get(f"{self.url}/ofertas/{self.iogurte.id}", self.joana).json()["reservas"]
        self.assertEqual([r["cliente"] for r in reservas], ["Bia L."])

    def test_oferta_encerrada_mostra_todas(self):
        cancelada = self.reservar(self.iogurte, self.ana, 1)
        servico.cancelar(cancelada.id)
        Oferta.objects.filter(pk=self.iogurte.pk).update(fim=self.agora + timedelta(seconds=1))
        servico.encerrar(self.iogurte.id, agora=self.agora + timedelta(seconds=2))
        corpo = self.get(f"{self.url}/ofertas/{self.iogurte.id}", self.joana).json()
        self.assertEqual(corpo["estado"], "encerrada")
        self.assertEqual([r["estado"] for r in corpo["reservas"]], ["cancelada"])


class TestAjuste(Base):

    def ajustar(self, corpo, quem=None):
        return self.post(f"{self.url}/ofertas/{self.iogurte.id}/ajustes", corpo, quem or self.joana)

    def test_ajuste_baixa_do_livre_e_grava_autor(self):
        r = self.ajustar({"quantidade": 2, "motivo": "Danificada"})
        self.assertEqual(r.status_code, 201)
        estoque = r.json()["estoque"]
        self.assertEqual((estoque["livre"], estoque["ajustado"]), (8, 2))
        self.conferir_conservacao(estoque)
        ajuste = Ajuste.objects.get()
        self.assertEqual((ajuste.autor, ajuste.motivo), (self.joana, "Danificada"))

    def test_acima_do_livre_409_com_o_livre(self):
        self.reservar(self.iogurte, self.ana, 4)                     # livre 6
        r = self.ajustar({"quantidade": 7, "motivo": "Danificada"})
        self.assertEqual((r.status_code, r.json()["codigo"], r.json()["livre"]),
                         (409, "acima_do_livre", 6))
        self.assertEqual(Ajuste.objects.count(), 0)

    def test_sem_motivo_400(self):
        for motivo in ("", "   ", None, 5):
            r = self.ajustar({"quantidade": 1, "motivo": motivo})
            self.assertEqual((r.status_code, r.json()["codigo"]), (400, "sem_motivo"), motivo)

    def test_quantidade_invalida_400(self):
        for qtd in (0, -1, "2", 1.5, True, None):
            r = self.ajustar({"quantidade": qtd, "motivo": "Danificada"})
            self.assertEqual((r.status_code, r.json()["codigo"]), (400, "quantidade_invalida"), qtd)

    def test_oferta_encerrada_409(self):
        Oferta.objects.filter(pk=self.iogurte.pk).update(fim=self.agora + timedelta(seconds=1))
        servico.encerrar(self.iogurte.id, agora=self.agora + timedelta(seconds=2))
        r = self.ajustar({"quantidade": 1, "motivo": "Danificada"})
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "oferta_encerrada"))


class TestRetirada(Base):

    def setUp(self):
        super().setUp()
        self.reserva = self.reservar(self.iogurte, self.ana, 2)

    def previa(self, codigo, quem=None):
        return self.get(f"{self.url}/reservas/ativa", quem or self.joana, codigo=codigo)

    def retirar(self, codigo, quem=None):
        return self.post(f"{self.url}/retiradas", {"codigo": codigo}, quem or self.carlos)

    def outro_codigo(self):
        return "000000" if self.reserva.codigo != "000000" else "111111"

    def test_previa_formato(self):
        r = self.previa(self.reserva.codigo)
        self.assertEqual(r.status_code, 200)
        corpo = r.json()
        self.assertEqual(corpo["codigo"], self.reserva.codigo)   # quem digitou já sabe o código
        self.assertEqual(corpo["total"], "6.28")                  # 2 × 3.14
        self.assertEqual(corpo["produto"], "Iogurte natural 170 g")
        self.assertEqual(corpo["fita"]["cor"], "branco")
        self.assertEqual(corpo["reserva"]["cliente"], "Ana S.")

    def test_previa_nao_muda_nada(self):
        self.previa(self.reserva.codigo)
        self.reserva.refresh_from_db()
        self.assertEqual(self.reserva.estado, "reservada")

    def test_previa_codigo_errado_404(self):
        r = self.previa(self.outro_codigo())
        self.assertEqual((r.status_code, r.json()["codigo"]), (404, "nao_encontrada"))

    def test_codigo_de_outra_loja_404(self):
        # Rosa (responsável do Empório) digita um código que só existe no Vila Nova.
        r = self.get(f"/api/lojas/{self.longe.id}/reservas/ativa", self.rosa,
                     codigo=self.reserva.codigo)
        self.assertEqual(r.status_code, 404)
        r = self.post(f"/api/lojas/{self.longe.id}/retiradas",
                      {"codigo": self.reserva.codigo}, self.rosa)
        self.assertEqual(r.status_code, 404)

    def test_retirar(self):
        r = self.retirar(self.reserva.codigo)
        self.assertEqual(r.status_code, 200)
        corpo = r.json()
        self.assertEqual(corpo["reserva"]["estado"], "retirada")
        self.assertEqual(corpo["total"], "6.28")
        self.assertEqual(corpo["retirada_por"], "Carlos Lima")
        self.assertEqual(corpo["oferta"]["id"], self.iogurte.id)
        self.assertEqual(corpo["oferta"]["estoque"]["retirado"], 2)
        self.conferir_conservacao(corpo["oferta"]["estoque"])
        self.reserva.refresh_from_db()
        self.assertEqual(self.reserva.retirada_por, self.carlos)

    def test_retirar_duas_vezes_404_na_segunda(self):
        self.assertEqual(self.retirar(self.reserva.codigo).status_code, 200)
        r = self.retirar(self.reserva.codigo)
        self.assertEqual((r.status_code, r.json()["codigo"]), (404, "nao_encontrada"))
        self.iogurte.refresh_from_db()
        self.assertEqual(self.iogurte.retirado, 2)               # não retirou em dobro

    def test_codigo_mal_formado_404(self):
        for codigo in ("12", "abcdef", 123456, None):
            self.assertEqual(self.retirar(codigo).status_code, 404, codigo)

    def test_vencida_409_venceu_e_grava_expirada(self):
        vencida = self.reservar(self.iogurte, self.bia, 3, horas_atras=5)
        r = self.retirar(vencida.codigo)
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "venceu"))
        vencida.refresh_from_db()
        self.assertEqual(vencida.estado, "expirada")

    def test_previa_de_vencida_409_venceu(self):
        vencida = self.reservar(self.iogurte, self.bia, 3, horas_atras=5)
        r = self.previa(vencida.codigo)
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "venceu"))

    def test_vencida_ja_processada_pela_ronda_ainda_diz_venceu(self):
        # Alguém abriu o resumo do dia (a ronda expirou a reserva) e DEPOIS o cliente
        # chegou: o balcão deve ver "venceu", e não "código não encontrado".
        vencida = self.reservar(self.iogurte, self.bia, 3, horas_atras=5)
        self.get(f"{self.url}/resumo-do-dia", self.joana)
        vencida.refresh_from_db()
        self.assertEqual(vencida.estado, "expirada")
        self.assertEqual(self.previa(vencida.codigo).json()["codigo"], "venceu")
        self.assertEqual(self.retirar(vencida.codigo).json()["codigo"], "venceu")
