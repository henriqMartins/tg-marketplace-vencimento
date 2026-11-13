"""
Testes da API de lote, fita e aviso (etapa 10a, grupo D do contrato): produtos,
registro de lote (novo / agrupado / colisão), grupos de fita, avisos (adiar,
descartar) e PUBLICAÇÃO da oferta.

As rotas usam o relógio REAL: as datas aqui são montadas em volta de hoje().
Para a cor da fita, usamos datas de dezembro de anos futuros (fita preta).
Atenção: os testes que juntam "hoje + 4" e "hoje + 9" no mesmo grupo supõem que as
duas datas caem no mesmo bimestre; nos últimos dias de um bimestre, podem falhar.

Rodar (dentro de backend/):  python manage.py test ofertas.test_api_lotes
"""
from datetime import date, timedelta
from decimal import Decimal

from django.utils import timezone

from .models import Grupo, Lote, Oferta, Produto, Situacao
from .test_api_loja import Base as BaseLoja


def hoje():
    return timezone.localdate()


class Base(BaseLoja):

    def setUp(self):
        super().setUp()
        self.achocolatado = Produto.objects.create(loja=self.perto, nome="Achocolatado em pó 400 g",
                                                   categoria="mercearia")
        self.ano = hoje().year + 1                # dezembro do ano que vem: fita preta

    def lote(self, validade, quantidade=12, produto=None, quem=None):
        produto = produto or self.achocolatado
        return self.post(f"{self.url}/lotes", {"produto": produto.id, "validade": validade.isoformat(),
                                                "quantidade": quantidade}, quem or self.joana)

    def grupo_em_aviso(self, dias=5, quantidade=12):
        """Grupo cuja referência é daqui a `dias` dias: com antecedência 10, já é aviso."""
        corpo = self.lote(hoje() + timedelta(days=dias), quantidade).json()
        return corpo["grupo"]["id"]

    def publicar(self, grupo_id, **mudancas):
        corpo = {"separado": 10, "preco_original": "4.49", "desconto": 30,
                 "janela_horas": 4, "confirmou_separacao": True}
        corpo.update(mudancas)
        return self.post(f"{self.url}/avisos/{grupo_id}/publicar", corpo, self.joana)


class TestProdutos(Base):

    def test_cadastrar(self):
        r = self.post(f"{self.url}/produtos", {"nome": "Leite condensado 395 g", "categoria": "mercearia",
                                               "margem_fim_dias": None}, self.joana)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json(), {"id": r.json()["id"], "nome": "Leite condensado 395 g",
                                    "categoria": "mercearia", "margem_fim_dias": None,
                                    "margem_efetiva_dias": 1, "ultimo_preco_original": None})

    def test_margem_propria(self):
        r = self.post(f"{self.url}/produtos", {"nome": "Queijo", "categoria": "frios",
                                               "margem_fim_dias": 2}, self.joana)
        self.assertEqual((r.json()["margem_fim_dias"], r.json()["margem_efetiva_dias"]), (2, 2))

    def test_entradas_invalidas(self):
        casos = [({"nome": " ", "categoria": "frios"}, "sem_nome"),
                 ({"nome": "X", "categoria": "bebidas"}, "categoria_invalida"),
                 ({"nome": "X", "categoria": "frios", "margem_fim_dias": 8}, "margem_invalida"),
                 ({"nome": "X", "categoria": "frios", "margem_fim_dias": "1"}, "margem_invalida")]
        for corpo, codigo in casos:
            r = self.post(f"{self.url}/produtos", corpo, self.joana)
            self.assertEqual((r.status_code, r.json()["codigo"]), (400, codigo), corpo)

    def test_lista_so_da_loja_com_busca_e_ultimo_preco(self):
        Produto.objects.create(loja=self.longe, nome="Achocolatado de outra loja")
        nomes = [p["nome"] for p in self.get(f"{self.url}/produtos", self.joana, q="achoco").json()]
        self.assertEqual(nomes, ["Achocolatado em pó 400 g"])
        iogurte = [p for p in self.get(f"{self.url}/produtos", self.joana).json()
                   if p["nome"].startswith("Iogurte")][0]
        self.assertEqual(iogurte["ultimo_preco_original"], "4.49")   # da oferta que já teve


class TestRegistrarLote(Base):

    def test_primeiro_lote_abre_grupo_novo(self):
        r = self.lote(date(self.ano, 12, 18), 24)
        self.assertEqual(r.status_code, 201)
        corpo = r.json()
        self.assertEqual(corpo["resultado"], "novo")
        self.assertIsNone(corpo["colisao"])
        self.assertEqual(corpo["lote"]["quantidade"], 24)
        self.assertEqual(corpo["lote"]["recebido_em"], hoje().isoformat())
        g = corpo["grupo"]
        self.assertEqual(g["fita"], {"cor": "preto", "bimestre": "nov–dez", "ano": self.ano})
        self.assertEqual((g["referencia"], g["situacao"]), (f"{self.ano}-12-18", "aguardando"))
        self.assertEqual(g["aviso_em"], f"{self.ano}-12-08")          # 10 dias antes
        self.assertEqual((g["qtd_lotes"], g["recebido"], g["oferta_id"]), (1, 24, None))

    def test_mesma_cor_e_ano_agrupa_e_referencia_vira_a_mais_proxima(self):
        primeiro = self.lote(date(self.ano, 12, 18), 24).json()
        segundo = self.lote(date(self.ano, 11, 20), 12).json()
        self.assertEqual(segundo["resultado"], "agrupado")
        self.assertEqual(segundo["grupo"]["id"], primeiro["grupo"]["id"])
        self.assertEqual(segundo["grupo"]["referencia"], f"{self.ano}-11-20")
        self.assertEqual(segundo["grupo"]["aviso_em"], f"{self.ano}-11-10")
        self.assertEqual((segundo["grupo"]["qtd_lotes"], segundo["grupo"]["recebido"]), (2, 36))
        # Lote MAIS distante não muda a referência.
        terceiro = self.lote(date(self.ano, 12, 30), 6).json()
        self.assertEqual(terceiro["grupo"]["referencia"], f"{self.ano}-11-20")

    def test_colisao_de_ciclo_cria_grupo_novo_e_avisa(self):
        antigo = self.lote(date(self.ano, 12, 22)).json()
        r = self.lote(date(self.ano + 1, 12, 18)).json()
        self.assertEqual(r["resultado"], "colisao")
        self.assertEqual(r["colisao"], {"validade": f"{self.ano}-12-22"})
        self.assertNotEqual(r["grupo"]["id"], antigo["grupo"]["id"])
        self.assertEqual(r["grupo"]["colisao"], {"validade": f"{self.ano}-12-22"})

    def test_grupo_ja_publicado_nao_recebe_lote(self):
        grupo_id = self.grupo_em_aviso()
        self.assertEqual(self.publicar(grupo_id).status_code, 201)
        r = self.lote(hoje() + timedelta(days=6)).json()
        self.assertEqual(r["resultado"], "novo")
        self.assertNotEqual(r["grupo"]["id"], grupo_id)

    def test_lote_mais_proximo_desfaz_adiamento_que_passou_do_novo_limite(self):
        # Adiou com base na referência antiga; chegou lote que vence antes: o limite
        # do "adiar" encolheu, então o aviso volta a aparecer (não pode chegar tarde).
        grupo_id = self.grupo_em_aviso(dias=9)
        self.post(f"{self.url}/avisos/{grupo_id}/adiar",
                  {"ate": (hoje() + timedelta(days=7)).isoformat()}, self.joana)
        self.lote(hoje() + timedelta(days=4))
        g = Grupo.objects.get(pk=grupo_id)
        self.assertEqual((g.situacao, g.adiado_ate), (Situacao.AGUARDANDO, None))

    def test_entradas_invalidas(self):
        validade = date(self.ano, 12, 18).isoformat()
        casos = [({"produto": self.achocolatado.id, "validade": "18/12", "quantidade": 1}, 400, "validade_invalida"),
                 ({"produto": self.achocolatado.id, "validade": (hoje() - timedelta(days=1)).isoformat(),
                   "quantidade": 1}, 400, "validade_passada"),
                 ({"produto": self.achocolatado.id, "validade": validade, "quantidade": 0}, 400, "quantidade_invalida"),
                 ({"produto": self.achocolatado.id, "validade": validade, "quantidade": "3"}, 400, "quantidade_invalida"),
                 ({"produto": 999999, "validade": validade, "quantidade": 1}, 404, "nao_encontrado")]
        for corpo, status, codigo in casos:
            r = self.post(f"{self.url}/lotes", corpo, self.joana)
            self.assertEqual((r.status_code, r.json()["codigo"]), (status, codigo), corpo)
        self.assertEqual(Lote.objects.count(), 0)

    def test_produto_de_outra_loja_404(self):
        alheio = Produto.objects.create(loja=self.longe, nome="Leite")
        r = self.lote(date(self.ano, 12, 18), produto=alheio)
        self.assertEqual(r.status_code, 404)

    def test_sem_vinculo_403(self):
        self.assertEqual(self.lote(date(self.ano, 12, 18), quem=self.ana).status_code, 403)

    def test_grava_quem_registrou(self):
        self.lote(date(self.ano, 12, 18))
        self.assertEqual(Lote.objects.get().autor, self.joana)


class TestGrupos(Base):

    def test_lista_com_filtros(self):
        self.lote(date(self.ano, 12, 18))                         # preto, aguardando
        self.grupo_em_aviso()                                      # cor de agora, conferir
        todos = self.get(f"{self.url}/grupos", self.joana).json()
        self.assertEqual(len(todos), 2)
        self.assertNotIn("lotes", todos[0])                        # lista: só a contagem
        pretos = self.get(f"{self.url}/grupos", self.joana, cor="preto").json()
        self.assertTrue(all(g["fita"]["cor"] == "preto" for g in pretos))
        conferir = self.get(f"{self.url}/grupos", self.joana, situacao="conferir").json()
        self.assertEqual([g["situacao"] for g in conferir], ["conferir"])

    def test_com_lotes(self):
        self.lote(date(self.ano, 12, 18), 24)
        [g] = self.get(f"{self.url}/grupos", self.joana, com_lotes="1").json()
        self.assertEqual([l["quantidade"] for l in g["lotes"]], [24])

    def test_filtro_invalido_400(self):
        for params in ({"cor": "roxo"}, {"situacao": "xyz"}):
            r = self.get(f"{self.url}/grupos", self.joana, **params)
            self.assertEqual((r.status_code, r.json()["codigo"]), (400, "parametro_invalido"))

    def test_grupo_da_oferta_encerrada_aparece_encerrado(self):
        grupo_id = self.grupo_em_aviso()
        oferta_id = self.publicar(grupo_id).json()["oferta"]["id"]
        Oferta.objects.filter(pk=oferta_id).update(estado="encerrada", perda=10, livre=0)
        [g] = self.get(f"{self.url}/grupos", self.joana).json()
        self.assertEqual((g["situacao"], g["oferta_id"]), ("encerrado", oferta_id))


class TestAvisos(Base):

    def test_lista_por_referencia_e_urgencia(self):
        self.lote(date(self.ano, 12, 18))                          # ainda não é aviso
        longe = self.grupo_em_aviso(dias=9)
        corpo = self.get(f"{self.url}/avisos", self.joana).json()
        self.assertEqual(corpo["antecedencia_dias"], 10)
        self.assertEqual([a["id"] for a in corpo["avisos"]], [longe])
        aviso = corpo["avisos"][0]
        self.assertEqual((aviso["vence_em_dias"], aviso["urgente"]), (9, False))

    def test_urgente_ate_7_dias_e_ordem(self):
        # Outro produto para não agrupar com o primeiro.
        leite = Produto.objects.create(loja=self.perto, nome="Leite 1 L", categoria="leite")
        g9 = self.grupo_em_aviso(dias=9)
        g3 = self.lote(hoje() + timedelta(days=3), produto=leite).json()["grupo"]["id"]
        avisos = self.get(f"{self.url}/avisos", self.joana).json()["avisos"]
        self.assertEqual([(a["id"], a["urgente"]) for a in avisos], [(g3, True), (g9, False)])

    def test_detalhe(self):
        grupo_id = self.grupo_em_aviso(dias=5)
        corpo = self.get(f"{self.url}/avisos/{grupo_id}", self.joana).json()
        referencia = hoje() + timedelta(days=5)
        self.assertEqual(corpo["grupo"]["id"], grupo_id)
        self.assertEqual(len(corpo["grupo"]["lotes"]), 1)
        self.assertIsNone(corpo["preco_sugerido"])                 # nunca teve oferta
        self.assertEqual(corpo["janela_padrao_horas"], 4)
        self.assertEqual(corpo["margem_efetiva_dias"], 1)
        self.assertEqual(corpo["fim_previsto"],
                         f"{(referencia - timedelta(days=1)).isoformat()}T23:59:00-03:00")
        self.assertEqual(corpo["adiar_ate_max"], (referencia - timedelta(days=2)).isoformat())

    def test_grupo_que_ainda_nao_e_aviso_404(self):
        grupo_id = self.lote(date(self.ano, 12, 18)).json()["grupo"]["id"]
        r = self.get(f"{self.url}/avisos/{grupo_id}", self.joana)
        self.assertEqual((r.status_code, r.json()["codigo"]), (404, "nao_encontrado"))

    def test_adiar(self):
        grupo_id = self.grupo_em_aviso(dias=9)
        ate = hoje() + timedelta(days=3)
        r = self.post(f"{self.url}/avisos/{grupo_id}/adiar", {"ate": ate.isoformat()}, self.joana)
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.json()["situacao"], r.json()["adiado_ate"]), ("adiado", ate.isoformat()))
        # Adiado continua na lista de avisos (com a situação "adiado").
        avisos = self.get(f"{self.url}/avisos", self.joana).json()["avisos"]
        self.assertEqual(avisos[0]["grupo"]["situacao"], "adiado")

    def test_adiar_alem_do_limite_400(self):
        grupo_id = self.grupo_em_aviso(dias=5)                      # limite: hoje + 3
        r = self.post(f"{self.url}/avisos/{grupo_id}/adiar",
                      {"ate": (hoje() + timedelta(days=4)).isoformat()}, self.joana)
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "apos_limite"))
        self.assertEqual(r.json()["adiar_ate_max"], (hoje() + timedelta(days=3)).isoformat())

    def test_adiar_para_hoje_ou_antes_400(self):
        grupo_id = self.grupo_em_aviso(dias=9)
        for ate in (hoje().isoformat(), "amanhã"):
            r = self.post(f"{self.url}/avisos/{grupo_id}/adiar", {"ate": ate}, self.joana)
            self.assertEqual((r.status_code, r.json()["codigo"]), (400, "data_invalida"), ate)

    def test_adiado_volta_a_conferir_no_dia(self):
        grupo_id = self.grupo_em_aviso(dias=9)
        Grupo.objects.filter(pk=grupo_id).update(situacao=Situacao.ADIADO, adiado_ate=hoje())
        corpo = self.get(f"{self.url}/avisos/{grupo_id}", self.joana).json()
        self.assertEqual(corpo["grupo"]["situacao"], "conferir")

    def test_descartar(self):
        grupo_id = self.grupo_em_aviso()
        r = self.post(f"{self.url}/avisos/{grupo_id}/descartar", {"motivo": "sem_unidades"}, self.joana)
        self.assertEqual((r.status_code, r.json()["situacao"]), (200, "encerrado"))
        self.assertEqual(self.get(f"{self.url}/avisos", self.joana).json()["avisos"], [])
        r = self.post(f"{self.url}/avisos/{grupo_id}/descartar", {"motivo": "sem_unidades"}, self.joana)
        self.assertEqual(r.status_code, 404)                        # já não é aviso

    def test_descartar_motivo_invalido_400(self):
        grupo_id = self.grupo_em_aviso()
        r = self.post(f"{self.url}/avisos/{grupo_id}/descartar", {"motivo": "venceu"}, self.joana)
        self.assertEqual((r.status_code, r.json()["codigo"]), (400, "motivo_invalido"))

    def test_resumo_do_dia_conta_os_avisos_para_conferir(self):
        self.lote(date(self.ano, 12, 18))                           # aguardando: não conta
        self.grupo_em_aviso()                                       # conferir: conta
        corpo = self.get(f"{self.url}/resumo-do-dia", self.joana).json()
        self.assertEqual(corpo["avisos_para_conferir"], 1)


class TestPublicar(Base):

    def test_publica_e_aparece_na_vitrine(self):
        grupo_id = self.grupo_em_aviso(dias=5, quantidade=12)
        r = self.publicar(grupo_id, separado=10, preco_original="4.49", desconto=30)
        self.assertEqual(r.status_code, 201)
        oferta = r.json()["oferta"]
        referencia = hoje() + timedelta(days=5)
        self.assertEqual((oferta["preco"], oferta["preco_original"], oferta["desconto"]),
                         ("3.14", "4.49", 30))                       # 4.49 × 0.70 = 3.143 → 3.14
        self.assertEqual(oferta["estoque"], {"separado": 10, "livre": 10, "reservado": 0,
                                             "retirado": 0, "ajustado": 0, "perda": 0})
        self.assertEqual(oferta["validade"], referencia.isoformat())
        self.assertEqual(oferta["fim"],
                         f"{(referencia - timedelta(days=1)).isoformat()}T23:59:00-03:00")
        self.assertEqual(oferta["janela_horas"], 4)
        # O grupo virou "em_oferta" e aponta para a oferta.
        g = Grupo.objects.get(pk=grupo_id)
        self.assertEqual((g.situacao, g.oferta.id), (Situacao.EM_OFERTA, oferta["id"]))
        # Está na vitrine do consumidor.
        vitrine = [o["id"] for o in self.get("/api/ofertas").json()]
        self.assertIn(oferta["id"], vitrine)
        # E o "último preço" do produto passa a ser este.
        r = self.get(f"{self.url}/produtos", self.joana, q="Achocolatado").json()
        self.assertEqual(r[0]["ultimo_preco_original"], "4.49")

    def test_preco_arredonda_meio_para_cima(self):
        grupo_id = self.grupo_em_aviso()
        r = self.publicar(grupo_id, preco_original="0.05", desconto=50)    # 0.025 → 0.03
        self.assertEqual(r.json()["oferta"]["preco"], "0.03")

    def test_sem_confirmacao_400(self):
        grupo_id = self.grupo_em_aviso()
        for valor in (False, None, "sim"):
            r = self.publicar(grupo_id, confirmou_separacao=valor)
            self.assertEqual((r.status_code, r.json()["codigo"]), (400, "sem_confirmacao"))

    def test_acima_do_recebido_400(self):
        grupo_id = self.grupo_em_aviso(quantidade=12)
        r = self.publicar(grupo_id, separado=13)
        self.assertEqual((r.status_code, r.json()["codigo"], r.json()["recebido"]),
                         (400, "acima_do_recebido", 12))
        self.assertEqual(Oferta.objects.filter(grupo_id=grupo_id).count(), 0)

    def test_entradas_invalidas(self):
        grupo_id = self.grupo_em_aviso()
        casos = [({"separado": 0}, "separado_invalido"),
                 ({"separado": "5"}, "separado_invalido"),
                 ({"preco_original": "abc"}, "preco_invalido"),
                 ({"preco_original": "0"}, "preco_invalido"),
                 ({"preco_original": "4.499"}, "preco_invalido"),
                 ({"preco_original": "0.01"}, "preco_invalido"),     # 20% de 0.01 não baixa o preço
                 ({"desconto": 35}, "desconto_invalido"),
                 ({"janela_horas": 3}, "janela_invalida")]
        for mudanca, codigo in casos:
            if mudanca.get("preco_original") == "0.01":
                mudanca = {**mudanca, "desconto": 20}
            r = self.publicar(grupo_id, **mudanca)
            self.assertEqual((r.status_code, r.json()["codigo"]), (400, codigo), mudanca)
        self.assertEqual(Oferta.objects.filter(grupo_id=grupo_id).count(), 0)

    def test_fim_ja_passou_409(self):
        # Validade hoje, margem 1 dia: o último dia da oferta foi ontem.
        grupo_id = self.grupo_em_aviso(dias=0)
        r = self.publicar(grupo_id)
        self.assertEqual((r.status_code, r.json()["codigo"]), (409, "fim_ja_passou"))

    def test_publicar_duas_vezes(self):
        grupo_id = self.grupo_em_aviso()
        self.assertEqual(self.publicar(grupo_id).status_code, 201)
        r = self.publicar(grupo_id)
        self.assertEqual(r.status_code, 404)                       # já não é aviso
        self.assertEqual(Oferta.objects.filter(grupo_id=grupo_id).count(), 1)

    def test_margem_do_produto_vale_sobre_a_da_loja(self):
        Produto.objects.filter(pk=self.achocolatado.pk).update(margem_fim=timedelta(days=2))
        grupo_id = self.grupo_em_aviso(dias=5)
        fim = self.publicar(grupo_id).json()["oferta"]["fim"]
        self.assertTrue(fim.startswith((hoje() + timedelta(days=3)).isoformat()))

    def test_preco_original_guardado_com_2_casas(self):
        grupo_id = self.grupo_em_aviso()
        oferta_id = self.publicar(grupo_id, preco_original="6.9").json()["oferta"]["id"]
        self.assertEqual(Oferta.objects.get(pk=oferta_id).preco_original, Decimal("6.90"))
