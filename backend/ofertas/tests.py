"""
Testes das TRAVAS DO BANCO (restrições) e da margem efetiva.

Cada teste de trava tenta gravar algo proibido direto no banco e espera o
"não" do PostgreSQL (IntegrityError). É a segunda tranca da porta: a primeira
é o domínio; esta segura mesmo se o código tiver um defeito.

Rodar (dentro de backend/):  ..\\.venv\\Scripts\\python manage.py test ofertas
"""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import Ajuste, Loja, Oferta, Pedido, Produto, Recusa, Reserva, Vinculo

AGORA = datetime(2026, 11, 2, 10, 0, tzinfo=timezone.utc)


class Base(TestCase):
    """Monta um cenário válido: 1 loja, 1 produto, 1 oferta de 10, 1 consumidora."""

    def setUp(self):
        Usuario = get_user_model()
        self.ana = Usuario.objects.create_user("ana", password="x")      # consumidora
        self.joao = Usuario.objects.create_user("joao", password="x")    # dono da loja
        self.loja = Loja.objects.create(nome="Mercadinho do Zé", endereco="Rua A, 1")
        self.produto = Produto.objects.create(loja=self.loja, nome="Iogurte 170 g")
        self.oferta = self.nova_oferta()

    def nova_oferta(self, **mudancas):
        dados = dict(produto=self.produto, validade=date(2026, 11, 10),
                     preco_original=Decimal("5.00"), preco=Decimal("2.50"),
                     separado=10, livre=10, inicio=AGORA,
                     fim=AGORA + timedelta(days=7), janela=timedelta(hours=4))
        dados.update(mudancas)
        return Oferta.objects.create(**dados)

    def nova_reserva(self, **mudancas):
        dados = dict(oferta=self.oferta, numero=1, loja=self.loja,
                     consumidor=self.ana, quantidade=3, pedido=3, codigo="123456",
                     criada_em=AGORA, expira_em=AGORA + timedelta(hours=4))
        dados.update(mudancas)
        if "pedido_retirada" not in dados:      # grupo J: toda reserva é item de um pedido
            dados["pedido_retirada"] = Pedido.objects.create(
                cliente=dados["consumidor"], loja=dados["loja"], codigo=dados["codigo"],
                criado_em=AGORA)
        return Reserva.objects.create(**dados)

    def assertBancoRecusa(self, gravar):
        # atomic(): o erro desfaz só esta tentativa, não o teste inteiro.
        with self.assertRaises(IntegrityError), transaction.atomic():
            gravar()


class TestMargem(Base):

    def test_produto_sem_margem_usa_a_da_loja(self):
        self.assertEqual(self.produto.margem_efetiva(), timedelta(days=1))

    def test_produto_com_margem_propria_usa_a_propria(self):
        pao = Produto.objects.create(loja=self.loja, nome="Pão de forma",
                                     margem_fim=timedelta(days=2))
        self.assertEqual(pao.margem_efetiva(), timedelta(days=2))

    def test_margem_zero_no_produto_vale_zero(self):
        # Zero é um valor escolhido, não "vazio": não pode cair na da loja.
        queijo = Produto.objects.create(loja=self.loja, nome="Queijo",
                                        margem_fim=timedelta(0))
        self.assertEqual(queijo.margem_efetiva(), timedelta(0))

    def test_margem_negativa_recusada(self):
        self.assertBancoRecusa(lambda: Produto.objects.create(
            loja=self.loja, nome="X", margem_fim=timedelta(days=-1)))

    def test_margem_acima_de_7_dias_recusada(self):
        # Contrato: margem de 0 a 7 dias (loja e produto).
        self.assertBancoRecusa(lambda: Produto.objects.create(
            loja=self.loja, nome="X", margem_fim=timedelta(days=8)))
        self.assertBancoRecusa(lambda: Loja.objects.create(
            nome="Y", endereco="Rua C", margem_fim=timedelta(days=8)))


class TestColunasDaEtapa7(Base):

    def test_loja_nasce_com_janela_de_4h_e_aviso_de_10_dias(self):
        self.assertEqual(self.loja.janela_padrao, timedelta(hours=4))
        self.assertEqual(self.loja.antecedencia_aviso_dias, 10)

    def test_janela_padrao_so_nas_opcoes(self):
        # Opções do contrato: 1, 2, 4, 8, 12 ou 24 h. 3 h não existe.
        self.assertBancoRecusa(lambda: Loja.objects.create(
            nome="Y", endereco="Rua C", janela_padrao=timedelta(hours=3)))

    def test_categoria_fora_da_lista_recusada(self):
        self.assertBancoRecusa(lambda: Produto.objects.create(
            loja=self.loja, nome="X", categoria="bebidas"))

    def test_categoria_da_lista_aceita(self):
        leite = Produto.objects.create(loja=self.loja, nome="Leite", categoria="leite")
        self.assertEqual(leite.categoria, "leite")


class TestTravasOferta(Base):

    def test_controle_oferta_valida_aceita(self):
        self.assertEqual(Oferta.objects.count(), 1)

    def test_livre_negativo(self):
        self.assertBancoRecusa(lambda: self.nova_oferta(livre=-1))

    def test_fim_antes_do_inicio(self):
        self.assertBancoRecusa(lambda: self.nova_oferta(fim=AGORA - timedelta(hours=1)))

    def test_preco_sem_desconto(self):
        self.assertBancoRecusa(lambda: self.nova_oferta(preco=Decimal("5.00")))

    def test_estado_desconhecido(self):
        self.assertBancoRecusa(lambda: self.nova_oferta(estado="pausada"))


class TestTravasReserva(Base):

    def test_controle_reserva_valida_aceita(self):
        self.nova_reserva()
        self.assertEqual(Reserva.objects.count(), 1)

    def test_quantidade_maior_que_o_pedido(self):
        self.assertBancoRecusa(lambda: self.nova_reserva(quantidade=4, pedido=3))

    def test_numero_repetido_na_mesma_oferta(self):
        self.nova_reserva()
        self.assertBancoRecusa(lambda: self.nova_reserva(codigo="654321"))

    def test_codigo_precisa_ter_6_digitos(self):
        # "R00001" é o código de teste do domínio: no banco real não entra.
        self.assertBancoRecusa(lambda: self.nova_reserva(codigo="R00001"))

    def test_ativa_nao_tem_encerrada_em(self):
        self.assertBancoRecusa(lambda: self.nova_reserva(encerrada_em=AGORA))

    def test_encerrada_precisa_de_encerrada_em(self):
        self.assertBancoRecusa(lambda: self.nova_reserva(estado="cancelada"))

    def test_retirada_por_so_em_reserva_retirada(self):
        self.assertBancoRecusa(lambda: self.nova_reserva(
            estado="cancelada", encerrada_em=AGORA, retirada_por=self.joao))


class TestCodigoDeRetirada(Base):
    """O código é único entre os PEDIDOS ativos da MESMA loja (grupo J, exclusão no banco)."""

    def test_mesmo_codigo_mesma_loja_dois_pedidos_ativos_recusado(self):
        self.nova_reserva()
        outra = self.nova_oferta()
        self.assertBancoRecusa(lambda: self.nova_reserva(oferta=outra))     # outro pedido

    def test_itens_do_mesmo_pedido_dividem_o_codigo(self):
        item = self.nova_reserva()
        outra = self.nova_oferta()
        self.nova_reserva(oferta=outra, pedido_retirada=item.pedido_retirada)
        self.assertEqual(Reserva.objects.filter(codigo="123456", estado="reservada").count(), 2)

    def test_mesmo_codigo_em_lojas_diferentes_aceito(self):
        self.nova_reserva()
        loja2 = Loja.objects.create(nome="Empório da Rosa", endereco="Rua B, 2")
        produto2 = Produto.objects.create(loja=loja2, nome="Leite")
        oferta2 = self.nova_oferta(produto=produto2)
        self.nova_reserva(oferta=oferta2, loja=loja2)
        self.assertEqual(Reserva.objects.filter(codigo="123456").count(), 2)

    def test_mesmo_codigo_se_a_antiga_ja_foi_retirada_aceito(self):
        self.nova_reserva(estado="retirada", encerrada_em=AGORA, retirada_por=self.joao)
        outra = self.nova_oferta()
        self.nova_reserva(oferta=outra)
        self.assertEqual(Reserva.objects.filter(codigo="123456").count(), 2)


class TestVinculo(Base):

    def test_um_vinculo_por_pessoa_por_loja(self):
        Vinculo.objects.create(usuario=self.joao, loja=self.loja, papel="responsavel")
        self.assertBancoRecusa(lambda: Vinculo.objects.create(
            usuario=self.joao, loja=self.loja, papel="funcionario"))

    def test_mesma_pessoa_em_duas_lojas_aceito(self):
        loja2 = Loja.objects.create(nome="Empório da Rosa", endereco="Rua B, 2")
        Vinculo.objects.create(usuario=self.joao, loja=self.loja, papel="responsavel")
        Vinculo.objects.create(usuario=self.joao, loja=loja2, papel="funcionario")
        self.assertEqual(self.joao.vinculos.count(), 2)

    def test_papel_desconhecido(self):
        self.assertBancoRecusa(lambda: Vinculo.objects.create(
            usuario=self.joao, loja=self.loja, papel="gerente"))


class TestAjusteERecusa(Base):

    def test_ajuste_sem_motivo(self):
        for motivo in ("", "   "):
            self.assertBancoRecusa(lambda: Ajuste.objects.create(
                oferta=self.oferta, autor=self.joao, quantidade=1,
                motivo=motivo, criado_em=AGORA))

    def test_ajuste_valido_aceito(self):
        Ajuste.objects.create(oferta=self.oferta, autor=self.joao, quantidade=1,
                              motivo="embalagem amassada", criado_em=AGORA)
        self.assertEqual(self.oferta.ajustes.count(), 1)

    def test_recusa_registra_pedido(self):
        Recusa.objects.create(oferta=self.oferta, consumidor=self.ana,
                              pedido=2, criada_em=AGORA)
        self.assertEqual(self.oferta.recusas.get().pedido, 2)
