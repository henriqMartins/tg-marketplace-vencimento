from django.urls import path

from . import api_consumidor as c

# Grupo B do contrato (consumidor). Prefixo /api/ vem do config/urls.py.
urlpatterns = [
    path("ofertas", c.Vitrine.as_view(), name="vitrine"),
    path("ofertas/<int:oferta_id>", c.DetalheOferta.as_view(), name="oferta"),
    path("ofertas/<int:oferta_id>/reservas", c.Reservar.as_view(), name="reservar"),
    path("minhas-reservas", c.MinhasReservas.as_view(), name="minhas-reservas"),
    path("reservas/<int:reserva_id>", c.VerReserva.as_view(), name="reserva"),
    path("reservas/<int:reserva_id>/cancelar", c.CancelarReserva.as_view(), name="cancelar"),
]
