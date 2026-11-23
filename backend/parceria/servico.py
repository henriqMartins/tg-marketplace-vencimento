"""
Serviço da parceria (etapa 14, grupo I; regra em docs/parceria.md, seção 4).

Não é regra de reserva (essa é só do domínio). Os cuidados aqui são:
  - um interesse em aberto por pessoa;
  - loja + convite + interesse gravados juntos (tudo ou nada);
  - convite de uso único, aceito com trava (dois aceites ao mesmo tempo → um vínculo).
As rotas (api.py) só traduzem ErroParceria para o formato de erro do contrato.
"""
import secrets
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone

from ofertas.api_config import ErroDeCampo, _coordenadas
from ofertas.models import Loja, Papel, Vinculo

from . import cnpj as receita
from .models import EM_ABERTO, Convite, EstadoConvite, EstadoInteresse, Interesse

TELEFONE_MAXIMO = 20
VALIDADE_CONVITE = timedelta(days=7)


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


# ---------------------------------------------------------------- CNPJ (P3, passo 1)

def cnpj_conferido(valor) -> str:
    """Só dígitos e dígitos verificadores certos; senão 400 (antes de chamar a Receita)."""
    numero = receita.so_digitos(valor)
    if not receita.cnpj_valido(numero):
        raise ErroParceria(400, "CNPJ inválido. Confira os números.", "cnpj_invalido")
    return numero


def consultar_cnpj(valor) -> dict:
    """GET /api/plataforma/cnpj/{cnpj} -> ConsultaCnpj."""
    numero = cnpj_conferido(valor)
    try:
        return receita.consultar(numero)
    except receita.CnpjNaoEncontrado:
        raise ErroParceria(404, "A Receita não encontrou esse CNPJ.", "cnpj_nao_encontrado")
    except receita.ReceitaIndisponivel:
        raise ErroParceria(503, "Não deu para consultar a Receita agora; preencha à mão.",
                           "consulta_indisponivel")


# ---------------------------------------------------------------- Loja + convite (P2, P3)

def _gerar_convite(loja: Loja, email: str) -> Convite:
    """Convite novo; o pendente anterior (se houver) deixa de valer. Chamar com a loja travada."""
    Convite.objects.filter(loja=loja, estado=EstadoConvite.PENDENTE).update(
        estado=EstadoConvite.SUBSTITUIDO)
    # 24 bytes aleatórios -> 32 caracteres: impossível de adivinhar (o código É a chave).
    return Convite.objects.create(loja=loja, email=email, codigo=secrets.token_urlsafe(24),
                                  expira_em=timezone.now() + VALIDADE_CONVITE)


def _interesse_em_aberto(interesse_id, travar=False) -> Interesse:
    consulta = Interesse.objects.select_for_update() if travar else Interesse.objects
    interesse = consulta.filter(pk=interesse_id).first() if type(interesse_id) is int else None
    if interesse is None:
        raise ErroParceria(404, "Pedido de parceria não encontrado.", "nao_encontrado")
    if interesse.estado not in EM_ABERTO:
        raise ErroParceria(400, "Esse pedido de parceria não está mais em aberto.",
                           "estado_invalido")
    return interesse


def _dados_da_loja(corpo: dict) -> dict:
    """Valida TUDO antes de consultar a Receita ou gravar qualquer coisa."""
    dados = {
        "cnpj": cnpj_conferido(corpo.get("cnpj")),
        "nome": texto(corpo, "nome", "o nome da loja", 120),
        "endereco": texto(corpo, "endereco", "o endereço", 255),
        "telefone": telefone(corpo),
    }
    email = str(corpo.get("email_responsavel") or "").strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        raise ErroParceria(400, "Confira o e-mail do responsável.", "email_invalido")
    dados["email"] = email
    # Coordenadas opcionais na criação (decidido 17/11/2026); se vierem, regra da L14.
    if "latitude" in corpo or "longitude" in corpo:
        try:
            dados["latitude"], dados["longitude"] = _coordenadas(corpo)
        except ErroDeCampo as e:
            raise ErroParceria(400, str(e), e.codigo)
    return dados


# 📖 ESTUDAR: a ordem do cadastro. (1) valida os campos; (2) consulta a Receita FORA da
# transação: ela pode levar até 5 s, e não se segura trava de banco esperando a rede;
# (3) dentro de UMA transação grava loja + convite + interesse "virou_loja". Se qualquer
# um falhar (ex.: outro cadastro com o mesmo CNPJ venceu a corrida), nada fica gravado:
# não sobra loja sem convite, nem interesse marcado sem loja.
def cadastrar_loja(corpo: dict):
    """POST /api/plataforma/lojas -> (Loja, Convite)."""
    dados = _dados_da_loja(corpo)
    interesse_id = corpo.get("interesse_id")
    if interesse_id is not None:
        _interesse_em_aberto(interesse_id)                    # erro cedo, antes da rede
    if Loja.objects.filter(cnpj=dados["cnpj"]).exists():
        raise ErroParceria(409, "Já existe uma loja com esse CNPJ.", "cnpj_ja_cadastrado")

    try:
        consulta = receita.consultar(dados["cnpj"])
        verificado = True
    except receita.CnpjNaoEncontrado:          # bloqueia (decidido 17/11/2026)
        raise ErroParceria(400, "A Receita não encontrou esse CNPJ.", "cnpj_nao_encontrado")
    except receita.ReceitaIndisponivel:        # fora do ar ou lenta: segue sem verificar
        consulta, verificado = None, False
    if consulta is not None and not consulta["ativa"]:
        raise ErroParceria(400, f"A Receita mostra este CNPJ como {consulta['situacao']}.",
                           "cnpj_inativo")

    email = dados.pop("email")
    try:
        with transaction.atomic():
            interesse = (_interesse_em_aberto(interesse_id, travar=True)
                         if interesse_id is not None else None)
            # Padrões do modelo: janela 4 h, margem 1 dia, antecedência 10 dias.
            loja = Loja.objects.create(cnpj_verificado=verificado, **dados)
            convite = _gerar_convite(loja, email)
            if interesse:
                interesse.estado, interesse.loja = EstadoInteresse.VIROU_LOJA, loja
                interesse.save(update_fields=["estado", "loja"])
    except IntegrityError:                     # mesmo CNPJ gravado no mesmo instante
        raise ErroParceria(409, "Já existe uma loja com esse CNPJ.", "cnpj_ja_cadastrado")
    return loja, convite


def renovar_convite(loja_id: int) -> Convite:
    """POST /api/plataforma/lojas/{id}/convite: novo link; o anterior deixa de valer."""
    with transaction.atomic():
        # Trava a loja: renovar e aceitar não se cruzam (o aceite trava a mesma linha).
        loja = Loja.objects.select_for_update().filter(pk=loja_id).first()
        if loja is None:
            raise ErroParceria(404, "Loja não encontrada.", "nao_encontrado")
        if loja.vinculos.filter(papel=Papel.RESPONSAVEL).exists():
            raise ErroParceria(409, "Essa loja já tem responsável.", "loja_ja_ativa")
        anterior = loja.convites.order_by("-criado_em", "-id").first()
        if anterior is None:
            raise ErroParceria(409, "Essa loja não foi cadastrada por convite.", "sem_convite")
        return _gerar_convite(loja, anterior.email)


# ---------------------------------------------------------------- Aceite do convite (A7)

def mascarar(email: str) -> str:
    """marcos@example.com -> m…@example.com (a A7 mostra para quem é o convite)."""
    nome, _, dominio = email.partition("@")
    return f"{nome[:1]}…@{dominio}"


def _achar_convite(codigo: str) -> Convite:
    convite = Convite.objects.filter(codigo=codigo).first()
    if convite is None:
        raise ErroParceria(404, "Convite não encontrado.", "nao_encontrado")
    return convite


def _conferir_validade(convite: Convite):
    if convite.estado == EstadoConvite.ACEITO:
        raise ErroParceria(409, "Este convite já foi usado.", "convite_usado")
    if convite.vencido():                        # inclui o substituído (decidido 17/11/2026)
        raise ErroParceria(410, "Este convite venceu. Peça um novo à equipe da plataforma.",
                           "convite_vencido")


def ver_convite(codigo: str) -> Convite:
    """GET /api/convites/{codigo}: o que a A7 mostra antes de aceitar."""
    convite = _achar_convite(codigo)
    _conferir_validade(convite)
    return convite


def _travar(convite: Convite) -> Convite:
    """Trava a loja e relê o convite travado (o controle negativo troca esta função)."""
    Loja.objects.select_for_update().get(pk=convite.loja_id)   # mesma trava da renovação
    return Convite.objects.select_for_update().get(pk=convite.pk)


# 📖 ESTUDAR: a mesma receita da reserva (trava → confere de novo → grava). Dois toques
# em "Aceitar" ao mesmo tempo: o segundo ESPERA o primeiro terminar e, ao reler o
# convite travado, já o encontra "aceito" → 409 convite_usado. O vínculo e o "convite
# usado" são gravados juntos: não existe vínculo sem convite usado, nem o contrário.
def aceitar_convite(pessoa, codigo: str) -> Vinculo:
    """POST /api/convites/{codigo}/aceitar: a pessoa vira responsável da loja."""
    convite = _achar_convite(codigo)
    with transaction.atomic():
        convite = _travar(convite)
        _conferir_validade(convite)
        if pessoa.email.lower() != convite.email.lower():
            raise ErroParceria(403, f"Este convite é para outro e-mail. Entre com a conta de "
                                    f"{mascarar(convite.email)}.", "email_diferente",
                               email_convite=mascarar(convite.email))
        if Vinculo.objects.filter(usuario=pessoa, loja_id=convite.loja_id).exists():
            raise ErroParceria(409, "Você já faz parte da equipe desta loja.", "ja_vinculado")
        try:
            with transaction.atomic():           # segunda tranca: um vínculo por loja (banco)
                vinculo = Vinculo.objects.create(usuario=pessoa, loja_id=convite.loja_id,
                                                 papel=Papel.RESPONSAVEL)
        except IntegrityError:
            raise ErroParceria(409, "Você já faz parte da equipe desta loja.", "ja_vinculado")
        convite.estado = EstadoConvite.ACEITO
        convite.aceito_por, convite.aceito_em = pessoa, timezone.now()
        convite.save(update_fields=["estado", "aceito_por", "aceito_em"])
    return vinculo
