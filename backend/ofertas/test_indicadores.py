"""
Testes do painel do gestor (etapa 11, grupo F do contrato, telas G1 e G3).

Um cenário com números CONHECIDOS, montado pelos serviços reais no passado
(T = 20 dias atrás). A rota usa o relógio real: ao abrir o painel, a varredura
expira as reservas vencidas e encerra as ofertas que passaram do fim.

  Oferta A (iogurte, 20 un.): 5 retiradas, 2 expiradas, 1 cancelada -> sobra 15 = perda
  Oferta B (requeijão, 2 un.): parcial (pediu 3, levou 2) retirada; depois 1 recusa

  reservas criadas = 9 · encerradas = 9 (6 retiradas, 2 expiradas, 1 cancelada)
  taxa de retirada = 6/9 · bloqueados = 1 recusa + 1 parcial · perda = 15

Decisões de 13/11/2026: cada número usa a data do PRÓPRIO evento (criada em,
encerrada em, fim da oferta); taxa sem reservas encerradas = null.

Rodar (dentro de backend/):  python manage.py test ofertas.test_indicadores
"""
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from . import servico
from .calendario import BRASILIA
from .models import Loja, Oferta, Papel, Produto, Reserva, Vinculo
from .test_api_consumidor import Base as BaseConsumidor


class Base(TestCase):

    como = BaseConsumidor.como
    get = BaseConsumidor.get

    def setUp(self):
        Usuario = get_user_model()
        criar = lambda email, nome: Usuario.objects.create_user(email, email=email,
                                                                password="x", nome=nome)
        self.carlos = criar("carlos@vilanova.com", "Carlos Lima")
        self.joana = criar("joana@vilanova.com", "Joana Prado")
        self.ana = criar("ana@email.com", "Ana Souza")
        self.bia = criar("bia@email.com", "Bia Lima")
        self.loja = Loja.objects.create(nome="Mercadinho Vila Nova", endereco="Rua A, 1")
        Vinculo.objects.create(usuario=self.carlos, loja=self.loja, papel=Papel.RESPONSAVEL)
        Vinculo.objects.create(usuario=self.joana, loja=self.loja, papel=Papel.FUNCIONARIO)
        self.url = f"/api/lojas/{self.loja.id}"
        # T = 20 dias atrás, às 10:00 de Brasília
        dia_t = timezone.localdate() - timedelta(days=20)
        self.T = datetime.combine(dia_t, time(10, 0), tzinfo=BRASILIA)

    def oferta(self, nome, separado, inicio, fim):
        produto = Produto.objects.create(loja=self.loja, nome=nome, categoria="laticinios")
        return Oferta.objects.create(
            produto=produto, validade=fim.date() + timedelta(days=1),
            preco_original=Decimal("4.49"), preco=Decimal("3.14"),
            separado=separado, livre=separado, inicio=inicio, fim=fim, janela=timedelta(hours=4))

    def h(self, horas):
        return self.T + timedelta(hours=horas)

    def montar_cenario(self):
        """O cenário da docstring. Os eventos de cada oferta vão na ordem do tempo."""
        a = self.oferta("Iogurte natural 170 g", 20, self.h(-24), self.h(24 * 5))
        retiradas = [servico.reservar(a.id, self.ana, 1, agora=self.h(1)) for _ in range(5)]
        for r in retiradas:
            servico.retirar(self.loja.id, r.codigo, self.joana, agora=self.h(2))
        servico.reservar(a.id, self.bia, 1, agora=self.h(3))       # vencem em h(7)
        servico.reservar(a.id, self.bia, 1, agora=self.h(3))
        c = servico.reservar(a.id, self.ana, 1, agora=self.h(3))
        servico.cancelar(c.id, agora=self.h(4))

        b = self.oferta("Requeijão cremoso 200 g", 2, self.h(-24), self.h(24 * 5))
        p = servico.reservar(b.id, self.ana, 3, agora=self.h(1))   # parcial: leva 2
        servico.retirar(self.loja.id, p.codigo, self.joana, agora=self.h(2))
        servico.reservar(b.id, self.bia, 1, agora=self.h(3))       # livre 0 -> recusa
        self.a, self.b = a, b

    def periodo(self, de_dias=-1, ate_dias=6):
        """Datas relativas a T (o dia do cenário), no formato da rota."""
        d = self.T.date()
        return {"de": (d + timedelta(days=de_dias)).isoformat(),
                "ate": (d + timedelta(days=ate_dias)).isoformat()}


class TestPorteiroDoPainel(Base):

    def test_so_o_responsavel(self):
        for rota in ("indicadores", "historico"):
            with self.subTest(rota=rota):
                self.assertEqual(self.get(f"{self.url}/{rota}").status_code, 401)
                self.assertEqual(self.get(f"{self.url}/{rota}", self.joana).status_code, 403)
                self.assertEqual(self.get(f"{self.url}/{rota}", self.ana).status_code, 403)
                self.assertEqual(self.get(f"{self.url}/{rota}", self.carlos).status_code, 200)


class TestPeriodo(Base):

    def test_sem_periodo_usa_os_ultimos_30_dias(self):
        corpo = self.get(f"{self.url}/indicadores", self.carlos).json()
        hoje = timezone.localdate()
        self.assertEqual((corpo["de"], corpo["ate"]),
                         ((hoje - timedelta(days=29)).isoformat(), hoje.isoformat()))

    def test_periodo_invalido_400(self):
        hoje = timezone.localdate()
        casos = [{"de": "ontem"},
                 {"de": hoje.isoformat(), "ate": (hoje - timedelta(days=1)).isoformat()},
                 {"de": (hoje - timedelta(days=366)).isoformat(), "ate": hoje.isoformat()}]
        for params in casos:
            for rota in ("indicadores", "historico"):
                with self.subTest(params=params, rota=rota):
                    r = self.get(f"{self.url}/{rota}", self.carlos, **params)
                    self.assertEqual((r.status_code, r.json()["codigo"]),
                                     (400, "periodo_invalido"))

    def test_um_ano_inteiro_passa(self):
        hoje = timezone.localdate()
        r = self.get(f"{self.url}/indicadores", self.carlos,
                     de=(hoje - timedelta(days=365)).isoformat(), ate=hoje.isoformat())
        self.assertEqual(r.status_code, 200)


class TestIndicadores(Base):

    def setUp(self):
        super().setUp()
        self.montar_cenario()

    def indicadores(self, **periodo):
        r = self.get(f"{self.url}/indicadores", self.carlos, **(periodo or self.periodo()))
        self.assertEqual(r.status_code, 200)
        return r.json()

    def test_os_numeros_do_cenario(self):
        corpo = self.indicadores()
        self.assertEqual(corpo["reservas_criadas"], 9)
        self.assertEqual(corpo["encerradas"],
                         {"total": 9, "retiradas": 6, "expiradas": 2, "canceladas": 1})
        self.assertEqual(corpo["taxa_retirada"], 0.667)                 # 6 ÷ 9
        self.assertEqual(corpo["taxa_expiracao"], 0.222)                # 2 ÷ 9
        self.assertEqual(corpo["bloqueados"], {"total": 2, "recusas": 1, "parciais": 1})
        self.assertEqual(corpo["perda_unidades"], 15)

    def test_abrir_o_painel_varre_antes_de_contar(self):
        """As 2 reservas venceram há 20 dias, mas ninguém as processou ainda."""
        self.assertEqual(Reserva.objects.filter(estado="expirada").count(), 0)
        self.indicadores()
        self.assertEqual(Reserva.objects.filter(estado="expirada").count(), 2)
        self.a.refresh_from_db()
        self.assertEqual((self.a.estado, self.a.perda), ("encerrada", 15))

    def test_abrir_duas_vezes_da_o_mesmo_numero(self):
        """A varredura é idempotente: a segunda abertura não devolve nem perde em dobro."""
        self.assertEqual(self.indicadores(), self.indicadores())

    def test_periodo_sem_nada_taxas_null(self):
        corpo = self.indicadores(**self.periodo(10, 12))
        self.assertEqual(corpo["reservas_criadas"], 0)
        self.assertEqual(corpo["encerradas"]["total"], 0)
        self.assertIsNone(corpo["taxa_retirada"])          # não há o que medir (não é 0%)
        self.assertIsNone(corpo["taxa_expiracao"])
        self.assertEqual(corpo["perda_unidades"], 0)

    def test_perda_conta_no_dia_do_fim_da_oferta(self):
        """As ofertas terminam em T+5 dias: o período só de T não tem perda."""
        self.assertEqual(self.indicadores(**self.periodo(0, 0))["perda_unidades"], 0)
        self.assertEqual(self.indicadores(**self.periodo(5, 5))["perda_unidades"], 15)

    def test_nao_conta_outra_loja(self):
        outra = Loja.objects.create(nome="Empório", endereco="Rua B, 2")
        produto = Produto.objects.create(loja=outra, nome="Leite", categoria="leite")
        oferta = Oferta.objects.create(
            produto=produto, validade=self.T.date() + timedelta(days=6),
            preco_original=Decimal("5"), preco=Decimal("3"), separado=5, livre=5,
            inicio=self.h(-24), fim=self.h(24 * 5), janela=timedelta(hours=4))
        servico.reservar(oferta.id, self.ana, 9, agora=self.h(1))
        self.assertEqual(self.indicadores()["reservas_criadas"], 9)

    def test_semanas_comecam_na_segunda_e_somam_o_periodo(self):
        corpo = self.indicadores(**self.periodo(-14, 14))
        semanas = corpo["semanas"]
        inicios = [datetime.fromisoformat(s["inicio"]).date() for s in semanas]
        self.assertTrue(all(d.weekday() == 0 for d in inicios))         # segunda-feira
        self.assertEqual([b - a for a, b in zip(inicios, inicios[1:])],
                         [timedelta(days=7)] * (len(inicios) - 1))      # sem buraco
        self.assertEqual(sum(s["retiradas"] for s in semanas), 6)
        self.assertEqual(sum(s["expiradas"] for s in semanas), 2)
        self.assertEqual(sum(s["canceladas"] for s in semanas), 1)


class TestDataDoProprioEvento(Base):
    """
    Decisão 1a: criada às 22:00 do dia D, janela de 4 h -> vence às 02:00 de D+1.
    Ela é "criada" em D e "expirada" em D+1.
    """

    def test_criada_num_dia_expirada_no_outro(self):
        dia = self.T.date()
        noite = datetime.combine(dia, time(22, 0), tzinfo=BRASILIA)
        oferta = self.oferta("Iogurte", 5, noite - timedelta(days=1), noite + timedelta(days=5))
        servico.reservar(oferta.id, self.ana, 1, agora=noite)

        no_dia = self.get(f"{self.url}/indicadores", self.carlos,
                          de=dia.isoformat(), ate=dia.isoformat()).json()
        self.assertEqual((no_dia["reservas_criadas"], no_dia["encerradas"]["expiradas"]), (1, 0))

        seguinte = (dia + timedelta(days=1)).isoformat()
        depois = self.get(f"{self.url}/indicadores", self.carlos, de=seguinte, ate=seguinte).json()
        self.assertEqual((depois["reservas_criadas"], depois["encerradas"]["expiradas"]), (0, 1))


class TestHistorico(Base):

    def setUp(self):
        super().setUp()
        self.montar_cenario()

    def historico(self, **filtros):
        r = self.get(f"{self.url}/historico", self.carlos, **self.periodo(), **filtros)
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def test_totais_e_ordem(self):
        corpo = self.historico()
        self.assertEqual((corpo["total_reservas"], corpo["total_recusas"]), (9, 1))
        self.assertEqual(len(corpo["itens"]), 10)
        datas = [i["criada_em"] for i in corpo["itens"]]
        self.assertEqual(datas, sorted(datas, reverse=True))           # mais recente primeiro

    def test_formato_da_recusa_e_da_parcial(self):
        itens = self.historico()["itens"]
        recusa = next(i for i in itens if i["tipo"] == "recusa")
        self.assertEqual({k: recusa[k] for k in ("codigo_final", "produto", "quantidade",
                                                 "pedido", "cliente", "estado", "encerrada_em")},
                         {"codigo_final": None, "produto": "Requeijão cremoso 200 g",
                          "quantidade": 0, "pedido": 1, "cliente": "Bia L.",
                          "estado": "recusa", "encerrada_em": None})
        parcial = next(i for i in itens if i["tipo"] == "reserva" and i["pedido"] == 3)
        self.assertEqual((parcial["quantidade"], parcial["estado"]), (2, "retirada"))
        self.assertEqual(len(parcial["codigo_final"]), 3)               # mascarado

    def test_codigo_inteiro_nunca_vai_para_a_tela(self):
        texto = str(self.historico())
        for codigo in Reserva.objects.values_list("codigo", flat=True):
            self.assertNotIn(f"'{codigo}'", texto)

    def test_filtro_por_estado(self):
        self.assertEqual({i["estado"] for i in self.historico(estado="recusa")["itens"]},
                         {"recusa"})
        self.assertEqual(len(self.historico(estado="retirada")["itens"]), 6)
        self.assertEqual(len(self.historico(estado="expirada")["itens"]), 2)   # varreu antes
        # Os totais do cabeçalho são do PERÍODO, não mudam com o filtro.
        self.assertEqual(self.historico(estado="recusa")["total_reservas"], 9)

    def test_estado_invalido_400(self):
        r = self.get(f"{self.url}/historico", self.carlos, estado="perdida")
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "estado_invalido"))

    def test_busca_por_produto_e_por_final_do_codigo(self):
        itens = self.historico(q="requeij")["itens"]
        self.assertEqual({i["produto"] for i in itens}, {"Requeijão cremoso 200 g"})
        self.assertEqual(len(itens), 2)                                  # parcial + recusa

        uma = Reserva.objects.filter(oferta=self.a, estado="cancelada").get()
        itens = self.historico(q=uma.codigo[-3:])["itens"]
        self.assertIn(uma.codigo[-3:], [i["codigo_final"] for i in itens])
        # (não dá para exigir "só reservas": um final "200" também casa com "200 g" no nome)
