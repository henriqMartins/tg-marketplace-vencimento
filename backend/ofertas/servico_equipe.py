"""
Serviço da equipe da loja (etapa 10b, tela L14): pôr e tirar gente da equipe.

Não é regra de reserva (essa é só do domínio). O cuidado aqui é outro: a loja
nunca pode ficar SEM responsável — senão ninguém mais consegue configurá-la nem
mexer na equipe. Por isso remover trava a linha da LOJA, como reservar trava a
linha da oferta.
"""
import re

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from contas.permissoes import papel_na_loja

from .models import Loja, Papel, Vinculo

EMAIL_VALIDO = re.compile(r"[^@\s]+@[^@\s]+")


class ErroEquipe(Exception):
    """Recusa ao mexer na equipe. Mesmo formato do ErroDominio: codigo + frase."""

    def __init__(self, mensagem: str, codigo: str):
        super().__init__(mensagem)
        self.codigo = codigo


def vincular(loja_id: int, email: str, papel: str) -> Vinculo:
    """Põe na equipe a pessoa que JÁ tem conta com este e-mail."""
    usuario = get_user_model().objects.filter(email__iexact=email).first()
    if usuario is None:
        raise ErroEquipe("Não existe conta com esse e-mail. Peça para a pessoa se cadastrar.",
                         "conta_nao_existe")
    try:
        # Bloco próprio: se a trava do banco (um vínculo por loja) recusar, só
        # ESTE pedaço é desfeito, e respondemos 409 em vez de erro 500.
        with transaction.atomic():
            return Vinculo.objects.create(usuario=usuario, loja_id=loja_id, papel=papel)
    except IntegrityError:
        raise ErroEquipe("Essa pessoa já faz parte da equipe.", "ja_vinculado")


# 📖 ESTUDAR: a mesma receita da reserva (trava → confere → grava), aplicada à equipe.
# Sem a trava, dois responsáveis removendo (ou rebaixando) um ao outro AO MESMO
# TEMPO leriam "somos 2" e os dois conseguiriam: a loja ficaria sem responsável.
# Com a trava, o segundo espera o primeiro terminar e, ao conferir de novo,
# descobre que já não é responsável (test_concorrencia prova os dois casos).
def _travar_e_achar(loja_id: int, vinculo_id: int, quem, acao: str) -> Vinculo:
    """Trava a loja, confere quem pede (de novo) e devolve o vínculo-alvo."""
    Loja.objects.select_for_update().get(pk=loja_id)            # uma mudança de equipe por vez

    # O porteiro conferiu ANTES da trava; dentro dela, confere de novo.
    if papel_na_loja(quem, loja_id) != Papel.RESPONSAVEL:
        raise ErroEquipe("Só o responsável da loja pode fazer isso.", "sem_permissao")
    vinculo = Vinculo.objects.filter(pk=vinculo_id, loja_id=loja_id).first()
    if vinculo is None:
        raise ErroEquipe("Essa pessoa não faz parte da equipe desta loja.", "nao_encontrado")
    if vinculo.usuario_id == quem.id:
        raise ErroEquipe(f"Você não pode {acao} o próprio acesso; peça a outro responsável.",
                         "proprio_vinculo")
    return vinculo


def _exigir_outro_responsavel(loja_id: int, vinculo: Vinculo) -> None:
    """Tirar um responsável só se sobrar outro (reforço: nunca zerar)."""
    if vinculo.papel == Papel.RESPONSAVEL:
        responsaveis = Vinculo.objects.filter(loja_id=loja_id, papel=Papel.RESPONSAVEL).count()
        if responsaveis <= 1:
            raise ErroEquipe("A loja precisa de pelo menos um responsável.", "ultimo_responsavel")


def remover(loja_id: int, vinculo_id: int, quem) -> None:
    with transaction.atomic():
        vinculo = _travar_e_achar(loja_id, vinculo_id, quem, "remover")
        _exigir_outro_responsavel(loja_id, vinculo)
        vinculo.delete()


def trocar_papel(loja_id: int, vinculo_id: int, papel: str, quem) -> Vinculo:
    """Promove ou rebaixa alguém da equipe (pedido 4 do front, aceito em 13/11/2026)."""
    with transaction.atomic():
        vinculo = _travar_e_achar(loja_id, vinculo_id, quem, "mudar")
        if papel != vinculo.papel:
            if papel != Papel.RESPONSAVEL:                      # rebaixando um responsável
                _exigir_outro_responsavel(loja_id, vinculo)
            vinculo.papel = papel
            vinculo.save(update_fields=["papel"])
        return vinculo
