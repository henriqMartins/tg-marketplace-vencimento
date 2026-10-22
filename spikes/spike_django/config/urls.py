from django.contrib import admin
from django.urls import path
from reservas import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", views.health),
    path("ofertas/<int:oferta_id>/reservar", views.reservar),
]
