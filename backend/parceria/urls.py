from django.urls import path

from . import api

# Prefixo /api/ vem do config/urls.py. Grupo I do contrato (parceria).
urlpatterns = [
    path("interesses", api.Interesses.as_view(), name="interesses"),
    path("plataforma/interesses", api.InteressesDaPlataforma.as_view(),
         name="plataforma-interesses"),
    path("plataforma/interesses/<int:interesse_id>", api.InteresseDaPlataforma.as_view(),
         name="plataforma-interesse"),
]
