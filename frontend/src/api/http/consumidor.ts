/* Grupo B na API real (backend/ofertas/urls.py). */
import type { ApiConsumidor } from '../cliente'
import { ehErroApi } from '../erros'
import type { OfertaPublica, OfertaVitrine, Reserva, ResultadoReserva } from '../tipos'
import type { Requisitar } from './requisitar'

export function criarConsumidorHttp(requisitar: Requisitar): ApiConsumidor {
  return {
    listarOfertas: (filtros = {}) => requisitar<OfertaVitrine[]>('GET', '/api/ofertas', { query: { ...filtros } }),
    obterOferta: (id) => requisitar<OfertaPublica>('GET', `/api/ofertas/${id}`),
    async reservar(ofertaId, pedido) {
      try {
        return await requisitar<ResultadoReserva>('POST', `/api/ofertas/${ofertaId}/reservas`, { corpo: { pedido } })
      } catch (erro) {
        // Recusa (livre 0) NÃO é erro para a tela: o contrato manda 409 com {status: "recusada", …}.
        if (ehErroApi(erro) && erro.status === 409) {
          const corpo = erro.corpo as { status?: string } | null
          if (corpo?.status === 'recusada') return corpo as ResultadoReserva
        }
        throw erro
      }
    },
    minhasReservas: (estado) => requisitar<Reserva[]>('GET', '/api/minhas-reservas', { query: { estado } }),
    obterReserva: (id) => requisitar<Reserva>('GET', `/api/reservas/${id}`),
    cancelarReserva: (id) => requisitar<Reserva>('POST', `/api/reservas/${id}/cancelar`),
  }
}
