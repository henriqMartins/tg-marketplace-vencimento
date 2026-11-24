"""
Swagger da API — SÓ em desenvolvimento (DEBUG ligado; decidido 14/11/2026).

    http://localhost:8000/api/docs      a página para testar as rotas
    http://localhost:8000/api/schema    o documento OpenAPI que a página lê

Como testar uma rota protegida: chame POST /api/auth/login (ex.: carlos@example.com,
demo1234), copie o "token", clique em "Authorize" e cole:  Token <chave>

O contrato OFICIAL continua sendo docs/api/contrato.md. Este arquivo só descreve
as rotas para o Swagger; nenhuma regra mora aqui.

Por que as anotações ficam AQUI e não em cima de cada view? As rotas não usam
serializers (leem o JSON à mão e respondem pelo apresentacao.py), então o
drf-spectacular não adivinha os campos. Em vez de encher as views de decoradores,
este arquivo "cola a etiqueta" em cada uma por fora (extend_schema_view), e só é
carregado em desenvolvimento.
"""
import re

from django.conf import settings
from django.urls import path
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (OpenApiExample, OpenApiParameter, OpenApiResponse,
                                   extend_schema, extend_schema_view)
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from contas import views as a
from ofertas import api_config as e
from ofertas import api_consumidor as b
from ofertas import api_gestor as f
from ofertas import api_loja as c
from ofertas import api_lotes as d
from ofertas import api_pedidos as j
from ofertas import indicadores, projecao
from ofertas.fita import CORES
from ofertas.models import Categoria
from parceria import api as i
from parceria.models import EstadoInteresse

# Os grupos do contrato (lista em settings.SPECTACULAR_SETTINGS["TAGS"]): "A" -> "A · Acesso"
GRUPOS = {t["name"][0]: t["name"] for t in settings.SPECTACULAR_SETTINGS["TAGS"]}

ERRO = "Erro no formato {\"erro\": \"<frase>\", \"codigo\": \"<identificador>\"}"
SEM_LOGIN = {401: "Sem token (ou token inválido)."}
SEM_VINCULO = {**SEM_LOGIN, 403: "Sem vínculo com esta loja."}
SO_RESPONSAVEL = {**SEM_LOGIN, 403: "Só o responsável da loja."}
SO_EQUIPE = {**SEM_LOGIN, 403: "Só a equipe da plataforma (is_staff)."}


def _resposta(status, descricao):
    return OpenApiResponse(None if status == 204 else OpenApiTypes.OBJECT, description=descricao)


# 📖 ESTUDAR: a "etiqueta" de uma rota. Cada chamada diz ao Swagger o grupo, um resumo,
# os filtros (?a=&b=), o corpo de exemplo (copiado do contrato) e as respostas possíveis.
# `auth=[]` tira o cadeado: a rota é pública (não precisa de token).
def rota(grupo, resumo, *, respostas, corpo=None, filtros=(), publica=False, descricao=""):
    opcoes = {
        "tags": [GRUPOS[grupo]],
        "summary": resumo,
        "description": (descricao + "\n\n" if descricao else "")
                       + "Formato completo: `docs/api/contrato.md`.",
        "parameters": list(filtros),
        "request": OpenApiTypes.OBJECT if corpo is not None else None,
        "examples": ([OpenApiExample("Exemplo do contrato", value=corpo, request_only=True)]
                     if corpo is not None else []),
        "responses": {s: _resposta(s, texto) for s, texto in respostas.items()},
    }
    if publica:
        opcoes["auth"] = []
    return opcoes


def filtro(nome, descricao, valores=None, tipo=str, obrigatorio=False):
    return OpenApiParameter(nome, tipo, OpenApiParameter.QUERY, required=obrigatorio,
                            enum=list(valores) if valores else None, description=descricao)


def documentar(classe, **metodos):
    """Cola a etiqueta em cada método da view. O nome da operação vem da classe e do
    método (ex.: vitrine_get), único — o automático repetia para /ofertas e /ofertas/{id}."""
    nome = re.sub(r"(?<!^)(?=[A-Z])", "_", classe.__name__).lower()
    extend_schema_view(**{metodo: extend_schema(operation_id=f"{nome}_{metodo}", **opcoes)
                          for metodo, opcoes in metodos.items()})(classe)


PERIODO = (filtro("de", "Início (AAAA-MM-DD). Padrão: 29 dias antes de `ate`."),
           filtro("ate", "Fim, incluído (AAAA-MM-DD). Padrão: hoje. Máximo: 1 ano."))

# ------------------------------------------------------------------ A · Acesso
documentar(a.CriarConta, post=rota(
    "A", "Criar conta", publica=True,
    corpo={"nome": "Ana Souza", "email": "ana@email.com", "senha": "senha-boa-123",
           "aceite_termos": True},
    respostas={201: "{token, usuario}", 400: ERRO + ": sem_nome, email_invalido, senha_curta, "
                                               "termos, email_em_uso"}))
documentar(a.Login, post=rota(
    "A", "Entrar (devolve o token)", publica=True,
    descricao="Copie o `token` da resposta e use em **Authorize** como `Token <chave>`.",
    corpo={"email": "carlos@example.com", "senha": "demo1234"},
    respostas={200: "{token, usuario}", 400: ERRO + ": credenciais_invalidas"}))
documentar(a.Sair, post=rota(
    "A", "Sair (apaga o token)", respostas={204: "Token apagado.", **SEM_LOGIN}))
documentar(a.Eu, get=rota(
    "A", "Quem sou eu (e meus vínculos)", respostas={200: "Eu", **SEM_LOGIN}))

# ------------------------------------------------------------------ B · Consumidor
documentar(b.Vitrine, get=rota(
    "B", "Vitrine", publica=True,
    descricao="Com `lat` e `lng`, ordena pela distância (Haversine em SQL). Nada é gravado.",
    filtros=(filtro("lat", "Latitude do consumidor (ex.: -20.8197).", tipo=float),
             filtro("lng", "Longitude do consumidor (ex.: -49.3794).", tipo=float),
             filtro("categoria", "Categoria do produto.", Categoria.values),
             filtro("faixa_desconto", "Faixa de desconto.", sorted(b.FAIXAS_DE_DESCONTO)),
             filtro("q", "Busca no nome do produto.")),
    respostas={200: "[OfertaVitrine]", 400: ERRO + ": parametro_invalido"}))
documentar(b.DetalheOferta, get=rota(
    "B", "Detalhe da oferta", publica=True,
    respostas={200: "OfertaVitrine + estado", 404: ERRO + ": nao_encontrada"}))
documentar(b.Reservar, post=rota(
    "B", "Reservar", corpo={"pedido": 2},
    descricao="Parcial automática: leva `min(pedido, livre)`. Livre 0 → 409 recusada.",
    respostas={201: "{status: confirmada | parcial, reserva}",
               400: ERRO + ": pedido_invalido", 404: ERRO + ": nao_encontrada",
               409: "{status: recusada, codigo: esgotada} ou oferta_encerrada", **SEM_LOGIN}))
documentar(b.MinhasReservas, get=rota(
    "B", "Minhas reservas",
    filtros=(filtro("estado", "Sem filtro: as duas.", ("ativa", "encerrada")),),
    respostas={200: "[ReservaConsumidor]", 400: ERRO + ": parametro_invalido", **SEM_LOGIN}))
documentar(b.VerReserva, get=rota(
    "B", "Ver uma reserva (só a própria)",
    respostas={200: "ReservaConsumidor", 404: ERRO + ": nao_encontrada (ou é de outra pessoa)",
               **SEM_LOGIN}))
documentar(b.CancelarReserva, post=rota(
    "B", "Cancelar a própria reserva",
    respostas={200: "ReservaConsumidor (cancelada)", 404: ERRO + ": nao_encontrada",
               409: ERRO + ": nao_ativa", **SEM_LOGIN}))

# ------------------------------------------------------------------ C · Operação da loja
documentar(c.ResumoDoDia, get=rota(
    "C", "Resumo do dia (L1)", respostas={200: "ResumoDoDia", **SEM_VINCULO}))
documentar(c.OfertasDaLoja, get=rota(
    "C", "Ofertas da loja (L9)",
    filtros=(filtro("estado", "Sem filtro: as duas.", ("ativa", "encerrada")),),
    respostas={200: "[OfertaLoja]", 400: ERRO + ": parametro_invalido", **SEM_VINCULO}))
documentar(c.DetalheOfertaDaLoja, get=rota(
    "C", "Detalhe da oferta com reservas (L10)",
    respostas={200: "OfertaLoja + reservas (código mascarado)",
               404: ERRO + ": nao_encontrada", **SEM_VINCULO}))
documentar(c.Ajustar, post=rota(
    "C", "Ajustar estoque (L11)", corpo={"quantidade": 1, "motivo": "Danificada"},
    descricao="Só reduz o livre; unidade reservada não é ajustada.",
    respostas={201: "{estoque}", 400: ERRO + ": quantidade_invalida, sem_motivo, motivo_longo",
               404: ERRO + ": nao_encontrada",
               409: ERRO + ": acima_do_livre, oferta_encerrada", **SEM_VINCULO}))
documentar(c.PreviaDaRetirada, get=rota(
    "C", "Prévia da retirada pelo código (L12)",
    descricao="Só lê; não retira. O código é o que o cliente mostra (6 dígitos).",
    filtros=(filtro("codigo", "Código de 6 dígitos.", obrigatorio=True),),
    respostas={200: "RetiradaPrevia", 404: ERRO + ": nao_encontrada",
               409: ERRO + ": venceu", **SEM_VINCULO}))
documentar(c.Retirar, post=rota(
    "C", "Confirmar a retirada (L13)", corpo={"codigo": "482917"},
    descricao="Tudo ou nada; grava quem retirou.",
    respostas={200: "RetiradaFeita", 404: ERRO + ": nao_encontrada", 409: ERRO + ": venceu",
               **SEM_VINCULO}))

# ------------------------------------------------------------------ D · Lote, fita e aviso
documentar(d.Produtos,
           get=rota("D", "Produtos da loja (com preço sugerido)",
                    filtros=(filtro("q", "Busca no nome."),),
                    respostas={200: "[ProdutoLoja]", **SEM_VINCULO}),
           post=rota("D", "Novo produto (L2)",
                     corpo={"nome": "Iogurte natural 170 g", "categoria": "laticinios",
                            "margem_fim_dias": None},
                     respostas={201: "ProdutoLoja", 400: ERRO + ": sem_nome, nome_longo, "
                                "categoria_invalida, margem_invalida", **SEM_VINCULO}))
documentar(d.RegistrarLote, post=rota(
    "D", "Registrar lote (L3)", corpo={"produto": 1, "validade": "2026-12-18", "quantidade": 24},
    descricao="Grupo = produto + cor da fita + ano. `resultado`: novo, agrupado ou colisao.",
    respostas={201: "{lote, grupo, resultado, colisao}",
               400: ERRO + ": validade_invalida, validade_passada, quantidade_invalida",
               404: ERRO + ": nao_encontrado (produto)", **SEM_VINCULO}))
documentar(d.Grupos, get=rota(
    "D", "Grupos de fita (L4, G5)",
    filtros=(filtro("cor", "Cor da fita.", CORES),
             filtro("situacao", "Situação do grupo.", sorted(d.SITUACOES)),
             filtro("com_lotes", "1 = inclui os lotes de cada grupo.", ("1",))),
    respostas={200: "[Grupo]", 400: ERRO + ": parametro_invalido", **SEM_VINCULO}))
documentar(d.Avisos, get=rota(
    "D", "Avisos para conferir (L5)", respostas={200: "{antecedencia_dias, avisos}", **SEM_VINCULO}))
documentar(d.AvisoDetalhe, get=rota(
    "D", "Detalhe do aviso (L6, L7)",
    respostas={200: "{grupo, preco_sugerido, janela_padrao_horas, fim_previsto, adiar_ate_max, "
                    "margem_efetiva_dias}", 404: ERRO + ": nao_encontrado", **SEM_VINCULO}))
documentar(d.Adiar, post=rota(
    "D", "Adiar aviso (L8)", corpo={"ate": "2026-11-20"},
    descricao="No máximo até a véspera do último dia da oferta (`adiar_ate_max`).",
    respostas={200: "Grupo", 400: ERRO + ": data_invalida, apos_limite",
               404: ERRO + ": nao_encontrado", **SEM_VINCULO}))
documentar(d.Descartar, post=rota(
    "D", "Não vai para oferta (descartar)", corpo={"motivo": "sem_unidades"},
    descricao="Encerra o grupo; não conta como perda. Motivo: sem_unidades ou outro_destino.",
    respostas={200: "Grupo", 400: ERRO + ": motivo_invalido", 404: ERRO + ": nao_encontrado",
               **SEM_VINCULO}))
documentar(d.Publicar, post=rota(
    "D", "Publicar oferta (L7)",
    corpo={"separado": 10, "preco_original": "4.49", "desconto": 30, "janela_horas": 4,
           "confirmou_separacao": True},
    descricao="Separado ≤ recebido nos lotes. Fim = 23:59 de (validade − margem), Brasília.",
    respostas={201: "{oferta}", 400: ERRO + ": sem_confirmacao, separado_invalido, "
               "preco_invalido, desconto_invalido, janela_invalida, acima_do_recebido",
               404: ERRO + ": nao_encontrado", 409: ERRO + ": fim_ja_passou", **SEM_VINCULO}))

# ------------------------------------------------------------------ E · Configuração
documentar(e.ConfiguracaoDaLoja,
           get=rota("E", "Configuração da loja", respostas={200: "LojaConfig", **SEM_VINCULO}),
           patch=rota("E", "Alterar a configuração (só responsável)",
                      corpo={"margem_fim_dias": 2, "janela_padrao_horas": 8},
                      descricao="Campo ausente = não muda. Erro em um campo não grava nenhum.",
                      respostas={200: "LojaConfig", 400: ERRO + ": janela_invalida, "
                                 "margem_invalida, antecedencia_invalida, "
                                 "antecedencia_menor_que_margem, coordenadas_…",
                                 **SO_RESPONSAVEL}))
documentar(e.Equipe,
           get=rota("E", "Equipe da loja", respostas={200: "[Vinculo]", **SEM_VINCULO}),
           post=rota("E", "Adicionar à equipe (só responsável)",
                     corpo={"email": "bruno@example.com", "papel": "funcionario"},
                     respostas={201: "Vinculo", 400: ERRO + ": email_invalido, papel_invalido",
                                404: ERRO + ": conta_nao_existe", 409: ERRO + ": ja_vinculado",
                                **SO_RESPONSAVEL}))
documentar(e.MembroDaEquipe,
           patch=rota("E", "Trocar o papel (só responsável)", corpo={"papel": "responsavel"},
                      respostas={200: "Vinculo", 400: ERRO + ": papel_invalido",
                                 404: ERRO + ": nao_encontrado",
                                 409: ERRO + ": proprio_vinculo, ultimo_responsavel",
                                 **SO_RESPONSAVEL}),
           delete=rota("E", "Remover da equipe (só responsável)",
                       respostas={204: "Removido.", 404: ERRO + ": nao_encontrado",
                                  409: ERRO + ": proprio_vinculo, ultimo_responsavel",
                                  **SO_RESPONSAVEL}))

# ------------------------------------------------------------------ F · Gestor
documentar(f.Indicadores, get=rota(
    "F", "Indicadores do painel (G1)", filtros=PERIODO,
    descricao="Varre a loja antes de contar. Cada número pela data do próprio evento.",
    respostas={200: "Indicadores", 400: ERRO + ": periodo_invalido", **SO_RESPONSAVEL}))
documentar(f.Historico, get=rota(
    "F", "Histórico de reservas e recusas (G3)",
    filtros=(*PERIODO,
             filtro("estado", "Filtra por estado.", indicadores.ESTADOS_DO_HISTORICO),
             filtro("q", "Nome do produto ou final do código.")),
    respostas={200: "{totais…, itens}", 400: ERRO + ": periodo_invalido, estado_invalido",
               **SO_RESPONSAVEL}))

# ------------------------------------------------------------------ G · Projeção
documentar(f.Projecao, get=rota(
    "G", "Projeção por janela de reserva (G2)",
    descricao="Sem filtro e chegada 2 h = Tabela 5 do artigo. Não roda simulação.",
    filtros=(filtro("lote", "Faixa do tamanho do lote. Vazio = todas.", projecao.ROTULOS_LOTE),
             filtro("procura", "Faixa de procura ÷ lote. Vazio = todas.",
                    projecao.ROTULOS_PROCURA),
             filtro("chegada", "Mediana do tempo até o cliente chegar (h). Padrão 2.",
                    [str(c) for c in projecao.CHEGADAS])),
    respostas={200: "{rodadas, filtro, janelas}", 400: ERRO + ": parametro_invalido",
               **SO_RESPONSAVEL}))

# ------------------------------------------------------------------ I · Parceria
documentar(i.Interesses, post=rota(
    "I", "Pedir parceria: \"Tenho um mercado\" (A6)",
    corpo={"nome_mercado": "Mercearia São Jorge", "cidade": "São José do Rio Preto",
           "telefone": "17999990000", "mensagem": ""},
    respostas={201: "Interesse", 400: ERRO + ": campo_obrigatorio, campo_longo",
               409: ERRO + ": interesse_em_aberto", **SEM_LOGIN}))
documentar(i.InteressesDaPlataforma, get=rota(
    "I", "Interessados (P1)",
    filtros=(filtro("estado", "Sem filtro: todos.", EstadoInteresse.values),),
    respostas={200: "[Interesse]", 400: ERRO + ": estado_invalido", **SO_EQUIPE}))
documentar(i.InteresseDaPlataforma, patch=rota(
    "I", "Marcar em conversa ou descartar (P1)",
    corpo={"estado": "descartado", "motivo": "Não vende embalados"},
    respostas={200: "Interesse", 400: ERRO + ": estado_invalido, campo_obrigatorio",
               404: ERRO + ": nao_encontrado", **SO_EQUIPE}))
documentar(i.ConsultaCnpj, get=rota(
    "I", "Consultar CNPJ na Receita (P3, passo 1)",
    descricao="Dígitos conferidos antes; a BrasilAPI é chamada pelo backend (limite 5 s).",
    respostas={200: "ConsultaCnpj", 400: ERRO + ": cnpj_invalido",
               404: ERRO + ": cnpj_nao_encontrado", 503: ERRO + ": consulta_indisponivel",
               **SO_EQUIPE}))
documentar(i.LojasDaPlataforma,
           get=rota("I", "Lojas da plataforma (P2)",
                    respostas={200: "[LojaPlataforma]", **SO_EQUIPE}),
           post=rota("I", "Cadastrar loja e gerar convite (P3)",
                     descricao="Loja + convite (+ interesse → virou_loja) numa transação só. "
                               "Receita fora do ar: cria com `cnpj_verificado: false`.",
                     corpo={"cnpj": "11222333000181", "nome": "Mercearia São Jorge",
                            "endereco": "Rua das Palmeiras, 410 · Boa Vista",
                            "latitude": -20.8113, "longitude": -49.3758,
                            "telefone": "17999990000", "email_responsavel": "marcos@example.com",
                            "interesse_id": 1},
                     respostas={201: "{loja: LojaPlataforma, convite: Convite}",
                                400: ERRO + ": cnpj_invalido, cnpj_inativo, cnpj_nao_encontrado, "
                                            "email_invalido, campo_obrigatorio, coordenadas_*, "
                                            "estado_invalido",
                                404: ERRO + ": nao_encontrado (interesse)",
                                409: ERRO + ": cnpj_ja_cadastrado", **SO_EQUIPE}))
documentar(i.ConviteDaLoja, post=rota(
    "I", "Gerar novo convite (P2)",
    descricao="O convite pendente anterior deixa de valer (responde 410 convite_vencido).",
    respostas={201: "Convite", 404: ERRO + ": nao_encontrado",
               409: ERRO + ": loja_ja_ativa, sem_convite", **SO_EQUIPE}))
documentar(i.VerConvite, get=rota(
    "I", "Ver convite (A7)",
    respostas={200: "{loja: {nome, endereco}, email, expira_em}", 404: ERRO + ": nao_encontrado",
               409: ERRO + ": convite_usado", 410: ERRO + ": convite_vencido", **SEM_LOGIN}))
documentar(i.AceitarConvite, post=rota(
    "I", "Aceitar convite e virar responsável (A7)",
    descricao="Exige login com o MESMO e-mail do convite. Trava: dois aceites → um vínculo.",
    respostas={201: "{vinculo: {loja: {id, nome}, papel}}",
               403: ERRO + ": email_diferente (traz email_convite mascarado)",
               404: ERRO + ": nao_encontrado", 409: ERRO + ": convite_usado, ja_vinculado",
               410: ERRO + ": convite_vencido", **SEM_LOGIN}))

# ------------------------------------------------------------------ J · Pedido
documentar(j.Pedidos,
           post=rota("J", "Confirmar pedido nesta loja (C10 → C5)",
                     descricao="Uma transação; cada item pelo mesmo `reservar` do domínio "
                               "(parcial/recusa como sempre). Ofertas travadas em ordem de id.",
                     corpo={"loja_id": 1, "itens": [{"oferta_id": 1, "pedido": 2},
                                                    {"oferta_id": 3, "pedido": 1}]},
                     respostas={201: "Pedido (status por item)",
                                400: ERRO + ": itens_vazios, item_repetido, pedido_invalido, "
                                            "oferta_de_outra_loja",
                                409: ERRO + ": tudo_esgotado (com itens)", **SEM_LOGIN}),
           get=rota("J", "Meus pedidos (C8)",
                    filtros=(filtro("estado", "Sem filtro: os dois.", ("ativo", "encerrado")),),
                    respostas={200: "[Pedido]", 400: ERRO + ": parametro_invalido",
                               **SEM_LOGIN}))
documentar(j.VerPedido, get=rota(
    "J", "Ver um pedido (C6, só o próprio)",
    respostas={200: "Pedido", 404: ERRO + ": nao_encontrado", **SEM_LOGIN}))
documentar(j.CancelarPedido, post=rota(
    "J", "Cancelar o pedido inteiro",
    respostas={200: "Pedido", 404: ERRO + ": nao_encontrado", 409: ERRO + ": nada_ativo",
               **SEM_LOGIN}))
documentar(j.CancelarItem, post=rota(
    "J", "Cancelar um item do pedido",
    descricao="Devolve só aquele item ao livre; o código continua para o resto.",
    respostas={200: "Pedido", 404: ERRO + ": nao_encontrado", 409: ERRO + ": ja_encerrado",
               **SEM_LOGIN}))


def rotas():
    """As duas URLs do Swagger. O config/urls.py só as inclui com DEBUG ligado."""
    return [
        path("api/schema", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger"),
    ]
