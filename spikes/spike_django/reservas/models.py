from django.db import models
from django.db.models import Q


class Oferta(models.Model):
    separado = models.PositiveIntegerField()
    livre = models.IntegerField()
    retirado = models.IntegerField(default=0)
    ajustado = models.IntegerField(default=0)
    perda = models.IntegerField(default=0)
    inicio = models.DateTimeField()
    fim = models.DateTimeField()
    janela = models.DurationField()          # configurável pelo lojista
    estado = models.CharField(max_length=10, default="ativa")
    descricao = models.CharField(max_length=120, default="")

    class Meta:
        constraints = [
            # defesa em profundidade: mesmo com bug no código, o banco recusa
            models.CheckConstraint(condition=Q(livre__gte=0), name="livre_nao_negativo"),
        ]


class Reserva(models.Model):
    oferta = models.ForeignKey(Oferta, on_delete=models.PROTECT, related_name="reservas")
    numero = models.PositiveIntegerField()   # id da reserva DENTRO da oferta (o do domínio)
    quantidade = models.PositiveIntegerField()
    pedido = models.PositiveIntegerField()
    codigo = models.CharField(max_length=12)
    criada_em = models.DateTimeField()
    expira_em = models.DateTimeField(db_index=True)   # autoridade da expiração
    estado = models.CharField(max_length=10, default="reservada")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["oferta", "numero"], name="numero_unico_por_oferta"),
        ]
