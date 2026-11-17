/* Grupo D na API real (backend/ofertas/urls.py). */
import type { ApiLotes } from '../cliente'
import type { AvisoDetalhe, Grupo, ListaAvisos, Produto, ResultadoLote, ResultadoPublicar } from '../tipos'
import type { Requisitar } from './requisitar'

export function criarLotesHttp(requisitar: Requisitar): ApiLotes {
  const loja = (id: number) => `/api/lojas/${id}`
  const aviso = (lojaId: number, id: number) => `${loja(lojaId)}/avisos/${id}`
  return {
    listarProdutos: (lojaId, q) => requisitar<Produto[]>('GET', `${loja(lojaId)}/produtos`, { query: { q } }),
    criarProduto: (lojaId, entrada) => requisitar<Produto>('POST', `${loja(lojaId)}/produtos`, { corpo: entrada }),
    cadastrarLote: (lojaId, entrada) => requisitar<ResultadoLote>('POST', `${loja(lojaId)}/lotes`, { corpo: entrada }),
    listarGrupos: (lojaId, { cor, situacao, com_lotes } = {}) =>
      requisitar<Grupo[]>('GET', `${loja(lojaId)}/grupos`, {
        // O backend só traz os lotes com ?com_lotes=1.
        query: { cor, situacao, com_lotes: com_lotes ? '1' : undefined },
      }),
    listarAvisos: (lojaId) => requisitar<ListaAvisos>('GET', `${loja(lojaId)}/avisos`),
    obterAviso: (lojaId, id) => requisitar<AvisoDetalhe>('GET', aviso(lojaId, id)),
    adiarAviso: (lojaId, id, ate) => requisitar<Grupo>('POST', `${aviso(lojaId, id)}/adiar`, { corpo: { ate } }),
    descartarAviso: (lojaId, id, motivo) => requisitar<Grupo>('POST', `${aviso(lojaId, id)}/descartar`, { corpo: { motivo } }),
    publicarAviso: (lojaId, id, entrada) =>
      requisitar<ResultadoPublicar>('POST', `${aviso(lojaId, id)}/publicar`, { corpo: entrada }),
  }
}
