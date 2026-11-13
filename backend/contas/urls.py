from django.urls import path

from . import views

urlpatterns = [
    path("auth/conta", views.CriarConta.as_view(), name="criar-conta"),
    path("auth/login", views.Login.as_view(), name="login"),
    path("auth/sair", views.Sair.as_view(), name="sair"),
    path("eu", views.Eu.as_view(), name="eu"),
]
