# Painel administrativo (/admin): ver e cadastrar dados de teste sem o frontend.
# Não é a tela do lojista.
from django.contrib import admin

from .models import Ajuste, Loja, Oferta, Produto, Recusa, Reserva, Vinculo

for modelo in (Loja, Vinculo, Produto, Oferta, Reserva, Ajuste, Recusa):
    admin.site.register(modelo)
