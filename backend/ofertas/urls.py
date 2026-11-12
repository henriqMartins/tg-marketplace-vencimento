from django.urls import path

from . import api_consumidor as c
from . import api_loja as l

# Prefixo /api/ vem do config/urls.py.
urlpatterns = [
    # Grupo B do contrato (consumidor)
    path("ofertas", c.Vitrine.as_view(), name="vitrine"),
    path("ofertas/<int:oferta_id>", c.DetalheOferta.as_view(), name="oferta"),
    path("ofertas/<int:oferta_id>/reservas", c.Reservar.as_view(), name="reservar"),
    path("minhas-reservas", c.MinhasReservas.as_view(), name="minhas-reservas"),
    path("reservas/<int:reserva_id>", c.VerReserva.as_view(), name="reserva"),
    path("reservas/<int:reserva_id>/cancelar", c.CancelarReserva.as_view(), name="cancelar"),

    # Grupo C do contrato (operação da loja): exigem vínculo com <loja_id>
    path("lojas/<int:loja_id>/resumo-do-dia", l.ResumoDoDia.as_view(), name="resumo-do-dia"),
    path("lojas/<int:loja_id>/ofertas", l.OfertasDaLoja.as_view(), name="ofertas-da-loja"),
    path("lojas/<int:loja_id>/ofertas/<int:oferta_id>", l.DetalheOfertaDaLoja.as_view(),
         name="oferta-da-loja"),
    path("lojas/<int:loja_id>/ofertas/<int:oferta_id>/ajustes", l.Ajustar.as_view(),
         name="ajustar"),
    path("lojas/<int:loja_id>/reservas/ativa", l.PreviaDaRetirada.as_view(),
         name="previa-da-retirada"),
    path("lojas/<int:loja_id>/retiradas", l.Retirar.as_view(), name="retirar"),
]
