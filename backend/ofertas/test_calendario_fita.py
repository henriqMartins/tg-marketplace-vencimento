"""
Testes PUROS (sem banco) da etapa 10a:
  - calendario: fim da oferta (23:59 de validade − margem, Brasília), dia do aviso,
    limite do "adiar";
  - fita: a decisão novo / agrupado / colisão quando chega um lote.

SimpleTestCase = teste do Django que NÃO abre banco: roda em milissegundos.

Rodar (dentro de backend/):  python manage.py test ofertas.test_calendario_fita
"""
from datetime import date, timedelta
from types import SimpleNamespace

from django.test import SimpleTestCase

from .calendario import adiar_ate_max, dia_do_aviso, fim_da_oferta
from .fita import classificar_lote

UM_DIA = timedelta(days=1)


class TestFimDaOferta(SimpleTestCase):

    def test_exemplo_do_claude_md(self):
        # "validade 28/10, margem 1 dia → fim em 27/10, 23:59" (horário de Brasília)
        fim = fim_da_oferta(date(2026, 10, 28), UM_DIA)
        self.assertEqual(fim.isoformat(), "2026-10-27T23:59:00-03:00")

    def test_margem_zero_termina_no_proprio_dia_da_validade(self):
        fim = fim_da_oferta(date(2026, 10, 28), timedelta(0))
        self.assertEqual(fim.isoformat(), "2026-10-28T23:59:00-03:00")

    def test_margem_atravessa_o_mes(self):
        fim = fim_da_oferta(date(2026, 11, 2), timedelta(days=3))
        self.assertEqual(fim.date(), date(2026, 10, 30))


class TestAvisoEAdiar(SimpleTestCase):

    def test_dia_do_aviso(self):
        self.assertEqual(dia_do_aviso(date(2026, 12, 9), 10), date(2026, 11, 29))

    def test_adiar_ate_a_vespera_do_ultimo_dia(self):
        # "validade 05/11, margem 1 dia → a oferta iria até 04/11, 23:59 → adiar até 03/11"
        self.assertEqual(adiar_ate_max(date(2026, 11, 5), UM_DIA), date(2026, 11, 3))

    def test_adiar_com_margem_zero(self):
        # Último dia da oferta = a própria validade (05/11) → véspera = 04/11.
        self.assertEqual(adiar_ate_max(date(2026, 11, 5), timedelta(0)), date(2026, 11, 4))


def grupo(cor, ano, referencia, aberto=True):
    """Um grupo "de mentira" com só o que a regra olha."""
    return SimpleNamespace(cor=cor, ano=ano, referencia=referencia, aberto=aberto)


class TestClassificarLote(SimpleTestCase):
    """
    Grupo = produto + cor + ano do bimestre. A função recebe os grupos ATIVOS do
    produto (não encerrados) e diz o que fazer com o lote que chegou.
    """

    def test_sem_grupo_nenhum_e_novo(self):
        self.assertEqual(classificar_lote(date(2026, 12, 18), []), ("novo", None, None))

    def test_mesma_cor_e_ano_agrupa(self):
        g = grupo("preto", 2026, date(2026, 12, 9))
        self.assertEqual(classificar_lote(date(2026, 11, 20), [g]), ("agrupado", g, None))

    def test_outra_cor_e_novo(self):
        g = grupo("branco", 2026, date(2026, 10, 1))
        self.assertEqual(classificar_lote(date(2026, 12, 18), [g]), ("novo", None, None))

    def test_mesma_cor_outro_ano_e_colisao(self):
        # Achocolatado: um lote de dez/2025 ainda ativo (fita preta) e chega um de
        # dez/2026 (fita preta também). Cria grupo novo, avisa, não bloqueia.
        antigo = grupo("preto", 2025, date(2025, 12, 22))
        resultado, alvo, colisao = classificar_lote(date(2026, 12, 18), [antigo])
        self.assertEqual((resultado, alvo, colisao), ("colisao", None, date(2025, 12, 22)))

    def test_grupo_ja_publicado_nao_recebe_lote(self):
        # Decidido 12/11/2026: grupo que já virou oferta não recebe lote (o separado
        # da oferta é fixo). O lote abre um grupo novo da mesma cor e ano.
        publicado = grupo("preto", 2026, date(2026, 12, 9), aberto=False)
        self.assertEqual(classificar_lote(date(2026, 12, 18), [publicado]), ("novo", None, None))

    def test_publicado_de_outro_ano_ainda_colide(self):
        # Na gôndola, a oferta publicada ainda está lá com a mesma cor de fita.
        publicado = grupo("preto", 2025, date(2025, 12, 22), aberto=False)
        resultado, _, colisao = classificar_lote(date(2026, 12, 18), [publicado])
        self.assertEqual((resultado, colisao), ("colisao", date(2025, 12, 22)))

    def test_agrupar_tem_preferencia_sobre_colisao(self):
        # A colisão com 2025 já foi avisada quando o grupo de 2026 nasceu.
        antigo = grupo("preto", 2025, date(2025, 12, 22))
        atual = grupo("preto", 2026, date(2026, 12, 9))
        self.assertEqual(classificar_lote(date(2026, 11, 20), [antigo, atual]),
                         ("agrupado", atual, None))
