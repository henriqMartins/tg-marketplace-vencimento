"""
Consultas de LEITURA da vitrine, feitas no PostgreSQL.

Só lê: não muda nada no banco e não decide regra de reserva (regra 1).
"""
from django.db.models import F, FloatField, IntegerField, Q, Sum, Value
from django.db.models.functions import ASin, Cast, Coalesce, Cos, Power, Radians, Round, Sin, Sqrt

import dominio

from .models import Oferta

RAIO_DA_TERRA_KM = 6371.0
ATIVA = dominio.EstadoReserva.RESERVADA.value


def distancia_km(lat: float, lng: float):
    """
    Expressão SQL da distância (km) entre o consumidor (lat, lng) e a loja da oferta,
    pela fórmula de Haversine. Roda DENTRO do PostgreSQL, linha a linha.

    📖 ESTUDAR: Haversine é a distância entre dois pontos sobre uma ESFERA (a Terra),
    não sobre um papel plano. Com φ = latitude e λ = longitude, em radianos:
        a = sen²(Δφ/2) + cos φ1 · cos φ2 · sen²(Δλ/2)
        d = 2 · R · arcsen(√a)            (R = 6371 km)
    Cada função abaixo (Sin, Cos, ASin, Sqrt, Power, Radians) vira a função de
    mesmo nome no SQL. A coordenada do consumidor só entra aqui como número da
    consulta: não é gravada em lugar nenhum (decisão de privacidade do projeto).
    """
    lat_loja = Radians(Cast(F("produto__loja__latitude"), FloatField()))
    lng_loja = Radians(Cast(F("produto__loja__longitude"), FloatField()))
    lat_cons = Radians(Value(lat, output_field=FloatField()))
    lng_cons = Radians(Value(lng, output_field=FloatField()))
    a = (Power(Sin((lat_loja - lat_cons) / 2), 2)
         + Cos(lat_cons) * Cos(lat_loja) * Power(Sin((lng_loja - lng_cons) / 2), 2))
    return 2 * RAIO_DA_TERRA_KM * ASin(Sqrt(a))


def com_numeros_da_vitrine(qs, agora):
    """
    Acrescenta a cada oferta:
      - livre_vitrine: o livre + as unidades de reservas que JÁ VENCERAM e ninguém
        processou ainda (regra 6). Só para mostrar; o banco continua como está.
      - desconto: em %, arredondado (o mesmo número que a tela mostra e que o filtro usa).
    """
    vencidas = Coalesce(
        Sum("reservas__quantidade",
            filter=Q(reservas__estado=ATIVA, reservas__expira_em__lte=agora)),
        0)
    return qs.select_related("produto__loja").annotate(
        livre_vitrine=F("livre") + vencidas,
        desconto=Cast(Round((1 - F("preco") / F("preco_original")) * 100), IntegerField()),
    )


def vitrine(agora, lat=None, lng=None, categoria=None, faixa_desconto=None, q=None):
    """
    Ofertas que dá para reservar agora: ativas, antes do fim e com algo livre.
    Com lat/lng: ordenadas pela distância (lojas sem coordenada vão para o fim).
    Sem lat/lng: pelo fim mais próximo.
    """
    qs = com_numeros_da_vitrine(
        Oferta.objects.filter(estado=dominio.EstadoOferta.ATIVA.value, fim__gt=agora), agora)
    qs = qs.filter(livre_vitrine__gt=0)               # esgotada não aparece (decidido 11/11/2026)

    if categoria:
        qs = qs.filter(produto__categoria=categoria)
    if q:
        qs = qs.filter(produto__nome__icontains=q)
    if faixa_desconto == "ate30":
        qs = qs.filter(desconto__lte=30)
    elif faixa_desconto == "30a50":
        qs = qs.filter(desconto__gt=30, desconto__lt=50)
    elif faixa_desconto == "50mais":
        qs = qs.filter(desconto__gte=50)

    if lat is not None and lng is not None:
        qs = qs.annotate(distancia=distancia_km(lat, lng))
        return qs.order_by(F("distancia").asc(nulls_last=True), "fim", "id")
    return qs.order_by("fim", "id")
