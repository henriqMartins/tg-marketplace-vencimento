from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower


class Usuario(AbstractUser):
    """
    Todo mundo que usa o sistema, com um login só (decidido 23/10/2026).
    Login por e-mail e senha (decidido 05/11/2026); o "username" do Django
    recebe o próprio e-mail na criação da conta.

    O PAPEL de cada pessoa numa loja não fica aqui: fica em ofertas.Vinculo.
    Sem vínculo nenhum = consumidor.
    """
    nome = models.CharField(max_length=150, blank=True)   # "Ana Souza" (o contrato usa um campo só)

    class Meta:
        constraints = [
            # E-mail identifica a conta: único sem diferenciar maiúsculas
            # (Ana@x.com = ana@x.com). Vazio fica de fora (contas internas/admin).
            models.UniqueConstraint(Lower("email"), condition=~Q(email=""),
                                    name="usuario_email_unico"),
        ]
