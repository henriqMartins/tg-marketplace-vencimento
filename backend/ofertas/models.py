"""
As tabelas do marketplace. Cada classe = uma tabela; cada atributo = uma coluna.

Regra de negócio NÃO mora aqui (ela é do pacote dominio). Aqui ficam só:
  - onde cada informação é guardada;
  - as TRAVAS DO BANCO (constraints): o que é local a uma linha e o banco
    consegue conferir sozinho (sinais, unicidade, formato). É a segunda tranca;
    a primeira é o domínio. A conservação NÃO vira trava aqui: o "reservado" é
    soma de outra tabela — ela é conferida pelo domínio (reconstituir).
"""
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models import F, Q

import dominio

# Os estados vêm do domínio (regra 1): o banco aceita exatamente os mesmos.
ESTADOS_OFERTA = [(e.value, e.value) for e in dominio.EstadoOferta]
ESTADOS_RESERVA = [(e.value, e.value) for e in dominio.EstadoReserva]

# Contrato: margem de 0 a 7 dias; janela padrão só nestas opções.
MARGEM_MAXIMA = timedelta(days=7)
JANELAS_PERMITIDAS = [timedelta(hours=h) for h in (1, 2, 4, 8, 12, 24)]


class Categoria(models.TextChoices):
    """Lista ÚNICA do contrato, a mesma na vitrine (C2) e no cadastro (L2)."""
    MERCEARIA = "mercearia", "Mercearia"
    ENLATADOS = "enlatados", "Enlatados"
    LATICINIOS = "laticinios", "Laticínios"
    LEITE = "leite", "Leite"
    FRIOS = "frios", "Frios"
    DOCES = "doces", "Doces"


class Loja(models.Model):
    nome = models.CharField(max_length=120)
    endereco = models.CharField(max_length=255)
    # Coordenadas do endereço (proximidade, etapa 9); vazias até lá.
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    # Margem padrão da loja; o produto pode ter a própria (decidido 23/10/2026).
    margem_fim = models.DurationField(default=timedelta(days=1))
    # Janela que já vem preenchida ao publicar (L7); o lojista pode trocar na oferta.
    janela_padrao = models.DurationField(default=timedelta(hours=4))
    # Quantos dias antes da validade o aviso aparece para o lojista (L5).
    antecedencia_aviso_dias = models.PositiveSmallIntegerField(default=10)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(margem_fim__gte=timedelta(0)) & Q(margem_fim__lte=MARGEM_MAXIMA),
                name="loja_margem_de_0_a_7_dias"),
            models.CheckConstraint(condition=Q(janela_padrao__in=JANELAS_PERMITIDAS),
                                   name="loja_janela_padrao_permitida"),
        ]

    def __str__(self):
        return self.nome


class Papel(models.TextChoices):
    # Fora da classe Vinculo: o "class Meta" de lá não enxerga classes vizinhas.
    RESPONSAVEL = "responsavel", "Responsável"   # lojista e gestor numa pessoa só
    FUNCIONARIO = "funcionario", "Funcionário"


class Vinculo(models.Model):
    """Pessoa + loja + papel. Sem vínculo nenhum = consumidor (decidido 23/10/2026)."""

    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name="vinculos")
    loja = models.ForeignKey(Loja, on_delete=models.CASCADE, related_name="vinculos")
    papel = models.CharField(max_length=12, choices=Papel.choices)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["usuario", "loja"], name="um_vinculo_por_loja"),
            models.CheckConstraint(condition=Q(papel__in=Papel.values),
                                   name="vinculo_papel_valido"),
        ]

    def __str__(self):
        return f"{self.usuario} — {self.loja} ({self.papel})"


class Produto(models.Model):
    loja = models.ForeignKey(Loja, on_delete=models.PROTECT, related_name="produtos")
    nome = models.CharField(max_length=120)
    # A API exige a categoria ao cadastrar; o padrão só cobre linhas antigas e testes.
    categoria = models.CharField(max_length=12, choices=Categoria.choices,
                                 default=Categoria.MERCEARIA)
    # Opcional: vazio (None) = usa a margem da loja.
    margem_fim = models.DurationField(null=True, blank=True)

    class Meta:
        constraints = [
            # Vazio (NULL) passa: "usa a da loja". Preenchida: de 0 a 7 dias.
            models.CheckConstraint(
                condition=Q(margem_fim__gte=timedelta(0)) & Q(margem_fim__lte=MARGEM_MAXIMA),
                name="produto_margem_de_0_a_7_dias"),
            models.CheckConstraint(condition=Q(categoria__in=Categoria.values),
                                   name="produto_categoria_valida"),
        ]

    def margem_efetiva(self) -> timedelta:
        # "is not None", e não "or": margem 0 é um valor escolhido, não vazio.
        if self.margem_fim is not None:
            return self.margem_fim
        return self.loja.margem_fim

    def __str__(self):
        return self.nome


class Oferta(models.Model):
    """O lote publicado. Os números são os mesmos do dominio.Oferta."""

    produto = models.ForeignKey(Produto, on_delete=models.PROTECT, related_name="ofertas")
    validade = models.DateField()                 # data do lote (base da fita colorida)
    preco_original = models.DecimalField(max_digits=10, decimal_places=2)
    preco = models.DecimalField(max_digits=10, decimal_places=2)

    separado = models.PositiveIntegerField()
    livre = models.IntegerField()
    retirado = models.IntegerField(default=0)
    ajustado = models.IntegerField(default=0)
    perda = models.IntegerField(default=0)
    inicio = models.DateTimeField()
    fim = models.DateTimeField()                  # validade − margem, gravado na publicação
    janela = models.DurationField()               # configurável pelo lojista
    estado = models.CharField(max_length=10, choices=ESTADOS_OFERTA,
                              default=dominio.EstadoOferta.ATIVA.value)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(separado__gt=0), name="oferta_separado_positivo"),
            models.CheckConstraint(condition=Q(livre__gte=0), name="oferta_livre_nao_negativo"),
            models.CheckConstraint(condition=Q(retirado__gte=0), name="oferta_retirado_nao_negativo"),
            models.CheckConstraint(condition=Q(ajustado__gte=0), name="oferta_ajustado_nao_negativo"),
            models.CheckConstraint(condition=Q(perda__gte=0), name="oferta_perda_nao_negativa"),
            models.CheckConstraint(condition=Q(fim__gt=F("inicio")), name="oferta_fim_depois_do_inicio"),
            models.CheckConstraint(condition=Q(janela__gt=timedelta(0)), name="oferta_janela_positiva"),
            models.CheckConstraint(condition=Q(preco__gt=0) & Q(preco__lt=F("preco_original")),
                                   name="oferta_preco_com_desconto"),
            models.CheckConstraint(condition=Q(estado__in=[v for v, _ in ESTADOS_OFERTA]),
                                   name="oferta_estado_valido"),
        ]

    def __str__(self):
        return f"{self.produto} (val. {self.validade:%d/%m/%Y})"


class Reserva(models.Model):
    oferta = models.ForeignKey(Oferta, on_delete=models.PROTECT, related_name="reservas")
    numero = models.PositiveIntegerField()        # id DENTRO da oferta (o do domínio)
    # Repetida de propósito (dá para chegar nela pela oferta): uma trava do banco
    # só enxerga colunas da própria tabela, e o código é único POR LOJA.
    loja = models.ForeignKey(Loja, on_delete=models.PROTECT, related_name="reservas")
    consumidor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name="reservas")
    quantidade = models.PositiveIntegerField()    # quanto foi reservado
    pedido = models.PositiveIntegerField()        # quanto foi pedido (parcial: maior)
    codigo = models.CharField(max_length=6)       # 6 dígitos, o lojista digita
    criada_em = models.DateTimeField()
    expira_em = models.DateTimeField(db_index=True)   # fonte oficial da expiração
    estado = models.CharField(max_length=10, choices=ESTADOS_RESERVA,
                              default=dominio.EstadoReserva.RESERVADA.value)
    # Quando saiu de "reservada". Expirada: a hora em que VENCEU (expira_em), não a
    # hora em que o sistema percebeu (decidido 11/11/2026) — o painel conta no dia certo.
    encerrada_em = models.DateTimeField(null=True, blank=True)
    # Quem digitou o código no balcão (L13: "Retirada por Carlos Lima").
    retirada_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                     null=True, blank=True, related_name="retiradas_feitas")

    class Meta:
        constraints = [
            # Ativa NÃO tem encerrada_em; encerrada TEM.
            models.CheckConstraint(
                condition=(Q(estado=dominio.EstadoReserva.RESERVADA.value, encerrada_em__isnull=True)
                           | (~Q(estado=dominio.EstadoReserva.RESERVADA.value)
                              & Q(encerrada_em__isnull=False))),
                name="reserva_encerrada_em_coerente"),
            # Só reserva retirada tem quem retirou.
            models.CheckConstraint(
                condition=Q(retirada_por__isnull=True)
                          | Q(estado=dominio.EstadoReserva.RETIRADA.value),
                name="reserva_retirada_por_so_se_retirada"),
            models.UniqueConstraint(fields=["oferta", "numero"],
                                    name="reserva_numero_unico_por_oferta"),
            models.CheckConstraint(condition=Q(quantidade__gte=1),
                                   name="reserva_quantidade_positiva"),
            models.CheckConstraint(condition=Q(quantidade__lte=F("pedido")),
                                   name="reserva_quantidade_ate_o_pedido"),
            models.CheckConstraint(condition=Q(codigo__regex=r"^[0-9]{6}$"),
                                   name="reserva_codigo_6_digitos"),
            models.CheckConstraint(condition=Q(estado__in=[v for v, _ in ESTADOS_RESERVA]),
                                   name="reserva_estado_valido"),
            # O lojista digita o código e o backend acha a reserva ATIVA daquela
            # loja: não pode haver duas ativas com o mesmo código na mesma loja.
            # Só entre as ativas: códigos de reservas encerradas podem voltar a sair.
            models.UniqueConstraint(
                fields=["loja", "codigo"],
                condition=Q(estado=dominio.EstadoReserva.RESERVADA.value),
                name="reserva_codigo_unico_por_loja_entre_ativas",
            ),
        ]

    def __str__(self):
        return f"Reserva {self.numero} da oferta {self.oferta_id} ({self.estado})"


class Ajuste(models.Model):
    """Baixa feita pelo lojista: só do livre e sempre com motivo."""

    oferta = models.ForeignKey(Oferta, on_delete=models.PROTECT, related_name="ajustes")
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                              related_name="ajustes")
    quantidade = models.PositiveIntegerField()
    motivo = models.CharField(max_length=200)
    criado_em = models.DateTimeField()

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(quantidade__gte=1), name="ajuste_quantidade_positiva"),
            # \S = "pelo menos um caractere que não é espaço": "   " não vale como motivo.
            models.CheckConstraint(condition=Q(motivo__regex=r"\S"), name="ajuste_com_motivo"),
        ]


class Recusa(models.Model):
    """
    Tentativa de reserva que não levou nada (livre = 0). Não gera Reserva,
    então sem esta tabela ela se perderia; o painel conta "compradores bloqueados".
    A recusa PARCIAL fica na própria Reserva (pedido > quantidade).
    """

    oferta = models.ForeignKey(Oferta, on_delete=models.PROTECT, related_name="recusas")
    consumidor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name="recusas")
    pedido = models.PositiveIntegerField()
    criada_em = models.DateTimeField()

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(pedido__gte=1), name="recusa_pedido_positivo"),
        ]
