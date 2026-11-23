from django.urls import path

from . import api

# Prefixo /api/ vem do config/urls.py. Grupo I do contrato (parceria).
urlpatterns = [
    path("interesses", api.Interesses.as_view(), name="interesses"),
    path("plataforma/interesses", api.InteressesDaPlataforma.as_view(),
         name="plataforma-interesses"),
    path("plataforma/interesses/<int:interesse_id>", api.InteresseDaPlataforma.as_view(),
         name="plataforma-interesse"),
    path("plataforma/cnpj/<str:cnpj>", api.ConsultaCnpj.as_view(), name="plataforma-cnpj"),
    path("plataforma/lojas", api.LojasDaPlataforma.as_view(), name="plataforma-lojas"),
    path("plataforma/lojas/<int:loja_id>/convite", api.ConviteDaLoja.as_view(),
         name="plataforma-convite"),
    path("convites/<str:codigo>", api.VerConvite.as_view(), name="convite"),
    path("convites/<str:codigo>/aceitar", api.AceitarConvite.as_view(), name="aceitar-convite"),
]
