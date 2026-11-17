/*
 * Grupo G na API real: GET /api/lojas/{lojaId}/projecao?lote=&procura=&chegada=
 * Filtro não escolhido não vai na URL (parâmetro vazio = sem filtro, no contrato).
 */
import type { ApiProjecao } from '../cliente'
import type { Projecao } from '../tipos'
import type { Requisitar } from './requisitar'

export function criarProjecaoHttp(requisitar: Requisitar): ApiProjecao {
  return {
    projecao: (lojaId, filtros = {}) =>
      requisitar<Projecao>('GET', `/api/lojas/${lojaId}/projecao`, {
        query: { lote: filtros.lote, procura: filtros.procura, chegada: filtros.chegada },
      }),
  }
}
