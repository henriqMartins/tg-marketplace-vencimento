"""
Grupo E do contrato (Configuração da loja, tela L14): regras das ofertas da loja
e a equipe.

Leitura: qualquer vínculo com a loja (o funcionário precisa da janela padrão para
publicar). Escrita: só o responsável (403 para o funcionário).

Mudanças valem só para lotes e ofertas NOVOS sem código extra: o `fim` da oferta
e o `aviso_em` do grupo são gravados quando nascem, não recalculados.
"""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response
from rest_framework.views import APIView

from config.erros import erro
from contas.permissoes import EhDaLoja, EhResponsavel

from . import apresentacao, servico_equipe
from .api_lotes import _inteiro
from .models import JANELAS_PERMITIDAS, MARGEM_MAXIMA, Loja, Papel, Vinculo

JANELAS_HORAS = {int(j.total_seconds() // 3600) for j in JANELAS_PERMITIDAS}   # 1,2,4,8,12,24
MARGEM_MAXIMA_DIAS = MARGEM_MAXIMA.days                                         # 7
ANTECEDENCIA_DIAS = range(1, 31)          # 1–30 e sempre > margem (decidido 13/11/2026)
NOME_MAXIMO, ENDERECO_MAXIMO = 120, 255   # tamanhos das colunas da Loja

ERROS_DA_EQUIPE = {
    "sem_permissao": 403,
    "nao_encontrado": 404,
    "conta_nao_existe": 404,
    "ja_vinculado": 409,
    "proprio_vinculo": 409,
    "ultimo_responsavel": 409,
}


class RotaDaConfiguracao(APIView):
    """
    📖 ESTUDAR: permissão por MÉTODO. A mesma rota tem dois porteiros: GET (ler)
    passa com qualquer vínculo; PATCH/POST/DELETE (mudar) só com o de responsável.
    O DRF chama get_permissions() antes de cada pedido; SAFE_METHODS = GET, HEAD, OPTIONS.
    """

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [EhDaLoja()]
        return [EhResponsavel()]


class ErroDeCampo(Exception):
    def __init__(self, mensagem, codigo):
        super().__init__(mensagem)
        self.codigo = codigo


def _numero(valor):
    """int ou float de verdade (True/False e texto ficam de fora); senão None."""
    return valor if type(valor) in (int, float) else None


def _texto(corpo, campo, maximo, codigo_vazio, codigo_longo, rotulo):
    valor = corpo[campo]
    texto = valor.strip() if isinstance(valor, str) else ""
    if not texto:
        raise ErroDeCampo(f"Informe {rotulo}.", codigo_vazio)
    if len(texto) > maximo:
        raise ErroDeCampo(f"{rotulo.capitalize()} pode ter até {maximo} caracteres.", codigo_longo)
    return texto


def _coordenadas(corpo):
    """Latitude e longitude andam JUNTAS: as duas preenchidas ou as duas vazias (null)."""
    lat, lng = corpo.get("latitude"), corpo.get("longitude")
    if "latitude" not in corpo or "longitude" not in corpo or (lat is None) != (lng is None):
        raise ErroDeCampo("Envie latitude e longitude juntas.", "coordenadas_incompletas")
    if lat is None:
        return None, None
    lat, lng = _numero(lat), _numero(lng)
    if lat is None or lng is None or not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise ErroDeCampo("Coordenadas fora dos limites.", "coordenadas_invalidas")
    return Decimal(str(round(lat, 6))), Decimal(str(round(lng, 6)))


# 📖 ESTUDAR: validar TUDO antes de gravar QUALQUER coisa. Se a margem está certa
# mas a janela está errada, nada é gravado: a tela mostra o erro e o lojista
# reenvia. Gravar "metade" deixaria a loja numa configuração que ninguém pediu.
def _mudancas(corpo) -> dict:
    """Campos do contrato (LojaConfig) -> colunas da Loja. Campo ausente = não muda."""
    mudancas = {}
    if "nome" in corpo:
        mudancas["nome"] = _texto(corpo, "nome", NOME_MAXIMO, "sem_nome", "nome_longo", "o nome")
    if "endereco" in corpo:
        mudancas["endereco"] = _texto(corpo, "endereco", ENDERECO_MAXIMO, "sem_endereco",
                                      "endereco_longo", "o endereço")
    if "latitude" in corpo or "longitude" in corpo:
        mudancas["latitude"], mudancas["longitude"] = _coordenadas(corpo)
    if "janela_padrao_horas" in corpo:
        janela = _inteiro(corpo["janela_padrao_horas"])
        if janela not in JANELAS_HORAS:
            raise ErroDeCampo("Janela padrão: 1, 2, 4, 8, 12 ou 24 horas.", "janela_invalida")
        mudancas["janela_padrao"] = timedelta(hours=janela)
    if "margem_fim_dias" in corpo:
        margem = _inteiro(corpo["margem_fim_dias"])
        if margem is None or not (0 <= margem <= MARGEM_MAXIMA_DIAS):
            raise ErroDeCampo("A margem vai de 0 a 7 dias.", "margem_invalida")
        mudancas["margem_fim"] = timedelta(days=margem)
    if "antecedencia_aviso_dias" in corpo:
        antecedencia = _inteiro(corpo["antecedencia_aviso_dias"])
        if antecedencia not in ANTECEDENCIA_DIAS:
            raise ErroDeCampo("A antecedência do aviso vai de 1 a 30 dias.",
                              "antecedencia_invalida")
        mudancas["antecedencia_aviso_dias"] = antecedencia
    return mudancas


class ConfiguracaoDaLoja(RotaDaConfiguracao):
    """GET e PATCH /api/lojas/{lojaId}"""

    def get(self, request, loja_id):
        return Response(apresentacao.loja_config(Loja.objects.get(pk=loja_id)))

    def patch(self, request, loja_id):
        if not isinstance(request.data, dict):
            return erro(400, "Envie os campos a alterar.", "corpo_invalido")
        try:
            mudancas = _mudancas(request.data)
        except ErroDeCampo as e:
            return erro(400, str(e), e.codigo)
        with transaction.atomic():
            loja = Loja.objects.select_for_update().get(pk=loja_id)
            for campo, valor in mudancas.items():
                setattr(loja, campo, valor)
            # 📖 ESTUDAR: esta regra junta DOIS campos, então é conferida no par FINAL
            # (o que veio no pedido + o que já estava gravado), e DENTRO da trava:
            # dois PATCHes ao mesmo tempo (um sobe a margem, outro baixa a antecedência)
            # passariam cada um sozinho, mas juntos quebrariam a regra.
            if loja.antecedencia_aviso_dias <= loja.margem_fim.days:
                return erro(400, "A antecedência do aviso precisa ser maior que a margem: "
                                 "senão o aviso chega depois do último dia da oferta.",
                            "antecedencia_menor_que_margem")
            loja.save()
        loja.refresh_from_db()                 # devolve o que ficou gravado (Decimal do banco)
        return Response(apresentacao.loja_config(loja))


class Equipe(RotaDaConfiguracao):
    """GET e POST /api/lojas/{lojaId}/vinculos"""

    def get(self, request, loja_id):
        vinculos = Vinculo.objects.filter(loja_id=loja_id).select_related("usuario")
        ordem = sorted(vinculos, key=lambda v: (v.papel != Papel.RESPONSAVEL,
                                                (v.usuario.nome or v.usuario.email).lower(), v.id))
        return Response([apresentacao.vinculo(v, request.user) for v in ordem])

    def post(self, request, loja_id):
        email = request.data.get("email") if isinstance(request.data, dict) else None
        email = email.strip() if isinstance(email, str) else ""
        if not servico_equipe.EMAIL_VALIDO.fullmatch(email):
            return erro(400, "Informe um e-mail válido.", "email_invalido")
        papel = request.data.get("papel")
        if papel not in Papel.values:
            return erro(400, "Papel: responsavel ou funcionario.", "papel_invalido")
        try:
            novo = servico_equipe.vincular(loja_id, email, papel)
        except servico_equipe.ErroEquipe as e:
            return erro(ERROS_DA_EQUIPE[e.codigo], str(e), e.codigo)
        novo = Vinculo.objects.select_related("usuario").get(pk=novo.pk)
        return Response(apresentacao.vinculo(novo, request.user), status=201)


class MembroDaEquipe(RotaDaConfiguracao):
    """DELETE /api/lojas/{lojaId}/vinculos/{id}"""

    def delete(self, request, loja_id, vinculo_id):
        try:
            servico_equipe.remover(loja_id, vinculo_id, request.user)
        except servico_equipe.ErroEquipe as e:
            return erro(ERROS_DA_EQUIPE[e.codigo], str(e), e.codigo)
        return Response(status=204)
