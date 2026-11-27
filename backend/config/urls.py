"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from ofertas import views as ofertas_views

from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health', views.health, name='health'),            # Health Check do Render
    # Mesma checagem para o frontend: bloqueadores de anúncio (uBlock Origin) barram
    # qualquer endereço terminado em /health, e o app ficava "esperando o servidor".
    path('api/saude', views.health, name='saude'),
    path('tarefas/varrer', ofertas_views.varrer, name='varrer'),
    path('api/', include('contas.urls')),          # grupo A do contrato (acesso)
    path('api/', include('ofertas.urls')),         # grupos B a G do contrato
    path('api/', include('parceria.urls')),        # grupo I do contrato (parceria)
]

# Swagger (/api/docs e /api/schema): SÓ em desenvolvimento (decidido 14/11/2026).
# Em produção (DEBUG desligado) as duas URLs nem existem: 404.
if settings.DEBUG:
    from . import documentacao
    urlpatterns += documentacao.rotas()
