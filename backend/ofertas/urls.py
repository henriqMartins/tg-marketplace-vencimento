from django.urls import path

from . import api_config as e
from . import api_consumidor as c
from . import api_gestor as f
from . import api_loja as l
from . import api_lotes as d

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

    # Grupo D do contrato (lote, fita e aviso): exigem vínculo com <loja_id>
    path("lojas/<int:loja_id>/produtos", d.Produtos.as_view(), name="produtos"),
    path("lojas/<int:loja_id>/lotes", d.RegistrarLote.as_view(), name="lotes"),
    path("lojas/<int:loja_id>/grupos", d.Grupos.as_view(), name="grupos"),
    path("lojas/<int:loja_id>/avisos", d.Avisos.as_view(), name="avisos"),
    path("lojas/<int:loja_id>/avisos/<int:grupo_id>", d.AvisoDetalhe.as_view(), name="aviso"),
    path("lojas/<int:loja_id>/avisos/<int:grupo_id>/adiar", d.Adiar.as_view(), name="adiar"),
    path("lojas/<int:loja_id>/avisos/<int:grupo_id>/descartar", d.Descartar.as_view(),
         name="descartar"),
    path("lojas/<int:loja_id>/avisos/<int:grupo_id>/publicar", d.Publicar.as_view(),
         name="publicar"),

    # Grupo E do contrato (configuração da loja): ler = vínculo; mudar = responsável
    path("lojas/<int:loja_id>", e.ConfiguracaoDaLoja.as_view(), name="loja"),
    path("lojas/<int:loja_id>/vinculos", e.Equipe.as_view(), name="vinculos"),
    path("lojas/<int:loja_id>/vinculos/<int:vinculo_id>", e.MembroDaEquipe.as_view(),
         name="vinculo"),

    # Grupo F do contrato (gestor): só o responsável
    path("lojas/<int:loja_id>/indicadores", f.Indicadores.as_view(), name="indicadores"),
    path("lojas/<int:loja_id>/historico", f.Historico.as_view(), name="historico"),
]
