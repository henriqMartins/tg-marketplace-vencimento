/* Grupo F na API real (backend/ofertas/urls.py). */
import type { ApiGestor } from '../cliente'
import type { Historico, Indicadores } from '../tipos'
import type { Requisitar } from './requisitar'

export function criarGestorHttp(requisitar: Requisitar): ApiGestor {
  return {
    indicadores: (lojaId, de, ate) =>
      requisitar<Indicadores>('GET', `/api/lojas/${lojaId}/indicadores`, { query: { de, ate } }),
    historico: (lojaId, filtros = {}) =>
      requisitar<Historico>('GET', `/api/lojas/${lojaId}/historico`, { query: { ...filtros } }),
  }
}
