"""
Serviço da parceria (etapa 14, grupo I; regra em docs/parceria.md, seção 4).

Não é regra de reserva (essa é só do domínio). Os cuidados aqui são:
  - um interesse em aberto por pessoa;
  - loja + convite + interesse gravados juntos (tudo ou nada);
  - convite de uso único, aceito com trava (dois aceites ao mesmo tempo → um vínculo).
As rotas (api.py) só traduzem ErroParceria para o formato de erro do contrato.
"""
from django.db import IntegrityError, transaction

from . import cnpj as receita
from .models import EM_ABERTO, EstadoInteresse, Interesse

TELEFONE_MAXIMO = 20


class ErroParceria(Exception):
    """Recusa da parceria: status HTTP + codigo do contrato + frase (+ extras opcionais)."""

    def __init__(self, status: int, mensagem: str, codigo: str, **extras):
        super().__init__(mensagem)
        self.status, self.codigo, self.extras = status, codigo, extras


def texto(corpo: dict, campo: str, rotulo: str, maximo: int, obrigatorio=True) -> str:
    """Campo de texto do corpo, sem espaços nas pontas. Vazio/longo → 400."""
    valor = corpo.get(campo)
    valor = valor.strip() if isinstance(valor, str) else ""
    if obrigatorio and not valor:
        raise ErroParceria(400, f"Informe {rotulo}.", "campo_obrigatorio", campo=campo)
    if len(valor) > maximo:
        raise ErroParceria(400, f"{rotulo.capitalize()} pode ter até {maximo} caracteres.",
                           "campo_longo", campo=campo)
    return valor


def telefone(corpo: dict, campo="telefone") -> str:
    """Telefone guardado só com dígitos (a máscara é da tela)."""
    numero = receita.so_digitos(corpo.get(campo))
    if not numero:
        raise ErroParceria(400, "Informe o telefone.", "campo_obrigatorio", campo=campo)
    if len(numero) > TELEFONE_MAXIMO:
        raise ErroParceria(400, "Confira o telefone.", "campo_longo", campo=campo)
    return numero


# ---------------------------------------------------------------- Interesse (A6, P1)

def interesse_em_aberto(pessoa):
    """O pedido em aberto da pessoa (novo ou em conversa), ou None. Vai no "Eu"."""
    return pessoa.interesses.filter(estado__in=EM_ABERTO).first()


def pedir_parceria(pessoa, corpo: dict) -> Interesse:
    """POST /api/interesses: o dono diz "Tenho um mercado"."""
    dados = {
        "nome_mercado": texto(corpo, "nome_mercado", "o nome do mercado", 120),
        "cidade": texto(corpo, "cidade", "a cidade", 120),
        "telefone": telefone(corpo),
        "mensagem": texto(corpo, "mensagem", "a mensagem", 1000, obrigatorio=False),
    }
    if interesse_em_aberto(pessoa):
        raise ErroParceria(409, "Você já tem um pedido de parceria em andamento.",
                           "interesse_em_aberto")
    try:
        # Bloco próprio: se a trava do banco (um em aberto por pessoa) recusar um
        # segundo pedido feito no mesmo instante, respondemos 409 em vez de erro 500.
        with transaction.atomic():
            return Interesse.objects.create(pessoa=pessoa, **dados)
    except IntegrityError:
        raise ErroParceria(409, "Você já tem um pedido de parceria em andamento.",
                           "interesse_em_aberto")


# Mudanças que a equipe pode fazer pelo PATCH (decidido 17/11/2026). "virou_loja"
# só acontece pela criação da loja, nunca à mão.
MUDANCAS_PERMITIDAS = {
    EstadoInteresse.NOVO: {EstadoInteresse.EM_CONVERSA, EstadoInteresse.DESCARTADO},
    EstadoInteresse.EM_CONVERSA: {EstadoInteresse.DESCARTADO},
}


def mudar_estado(interesse_id: int, corpo: dict) -> Interesse:
    """PATCH /api/plataforma/interesses/{id}: "Marcar em conversa" ou "Descartar"."""
    novo = corpo.get("estado")
    with transaction.atomic():
        # Trava a linha: a equipe não descarta um interesse no mesmo instante em que
        # outra pessoa da equipe o transforma em loja.
        interesse = Interesse.objects.select_for_update().filter(pk=interesse_id).first()
        if interesse is None:
            raise ErroParceria(404, "Pedido de parceria não encontrado.", "nao_encontrado")
        if novo not in MUDANCAS_PERMITIDAS.get(interesse.estado, set()):
            raise ErroParceria(400, f"Não dá para passar de {interesse.estado} para {novo}.",
                               "estado_invalido")
        if novo == EstadoInteresse.DESCARTADO:
            interesse.motivo_descarte = texto(corpo, "motivo", "o motivo", 255)
        interesse.estado = novo
        interesse.save(update_fields=["estado", "motivo_descarte"])
    return interesse
