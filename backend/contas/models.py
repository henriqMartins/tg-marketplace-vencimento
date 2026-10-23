from django.contrib.auth.models import AbstractUser


class Usuario(AbstractUser):
    """
    Todo mundo que usa o sistema, com um login só (decidido 23/10/2026).

    Por enquanto é igual ao usuário padrão do Django. Existe desde já para que
    a etapa 6 (login e papéis) possa acrescentar campos sem reforma no banco.
    O PAPEL de cada pessoa numa loja não fica aqui: fica em ofertas.Vinculo.
    Sem vínculo nenhum = consumidor.
    """
