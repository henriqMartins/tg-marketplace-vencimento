/* Grupo J na API real (backend/ofertas/api_pedidos.py e api_loja.py). */
import type { ApiPedidos } from '../cliente'
import { ehErroApi } from '../erros'
import type { ItemPedido, Pedido, PedidoNoBalcao } from '../tipos'
import type { Requisitar } from './requisitar'

export function criarPedidosHttp(requisitar: Requisitar): ApiPedidos {
  const pedido = (id: number) => `/api/pedidos/${id}`
  return {
    async confirmar(entrada) {
      try {
        return { status: 'criado', pedido: await requisitar<Pedido>('POST', '/api/pedidos', { corpo: entrada }) }
      } catch (erro) {
        // Nada sobrou: 409 tudo_esgotado com os itens recusados. Para a tela é um resultado (C5), não erro.
        if (ehErroApi(erro) && erro.status === 409 && erro.codigo === 'tudo_esgotado') {
          const corpo = erro.corpo as { itens?: ItemPedido[] } | null
          return { status: 'tudo_esgotado', erro: erro.message, itens: corpo?.itens ?? [] }
        }
        throw erro
      }
    },
    listar: (estado) => requisitar<Pedido[]>('GET', '/api/pedidos', { query: { estado } }),
    obter: (id) => requisitar<Pedido>('GET', pedido(id)),
    cancelar: (id) => requisitar<Pedido>('POST', `${pedido(id)}/cancelar`),
    cancelarItem: (id, reservaId) => requisitar<Pedido>('POST', `${pedido(id)}/itens/${reservaId}/cancelar`),
    previaNoBalcao: (lojaId, codigo) =>
      requisitar<PedidoNoBalcao>('GET', `/api/lojas/${lojaId}/pedidos/ativo`, { query: { codigo } }),
  }
}
