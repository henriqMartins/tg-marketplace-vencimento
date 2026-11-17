/* Grupo C na API real (backend/ofertas/urls.py). */
import type { ApiOperacao } from '../cliente'
import type { OfertaLoja, OfertaLojaDetalhe, ResultadoAjuste, ResumoDoDia, RetiradaFeita, RetiradaPrevia } from '../tipos'
import type { Requisitar } from './requisitar'

export function criarOperacaoHttp(requisitar: Requisitar): ApiOperacao {
  const loja = (id: number) => `/api/lojas/${id}`
  return {
    resumoDoDia: (lojaId) => requisitar<ResumoDoDia>('GET', `${loja(lojaId)}/resumo-do-dia`),
    listarOfertas: (lojaId, estado) => requisitar<OfertaLoja[]>('GET', `${loja(lojaId)}/ofertas`, { query: { estado } }),
    obterOferta: (lojaId, ofertaId) => requisitar<OfertaLojaDetalhe>('GET', `${loja(lojaId)}/ofertas/${ofertaId}`),
    ajustar: (lojaId, ofertaId, entrada) =>
      requisitar<ResultadoAjuste>('POST', `${loja(lojaId)}/ofertas/${ofertaId}/ajustes`, { corpo: entrada }),
    previaRetirada: (lojaId, codigo) =>
      requisitar<RetiradaPrevia>('GET', `${loja(lojaId)}/reservas/ativa`, { query: { codigo } }),
    retirar: (lojaId, codigo) => requisitar<RetiradaFeita>('POST', `${loja(lojaId)}/retiradas`, { corpo: { codigo } }),
  }
}
