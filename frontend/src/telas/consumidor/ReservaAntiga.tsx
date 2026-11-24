import { useQuery } from '@tanstack/react-query'
import { Navigate, useParams } from 'react-router'
import { useApi } from '../../app/contextos'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { MensagemErro } from '../../componentes/Mensagem'

/**
 * Endereços de antes do grupo J (/reservas/:id e /reserva/:id/resultado), que podem estar
 * em histórico ou favoritos: toda reserva agora é item de um pedido, então vai para ele.
 */
export function ReservaAntiga({ resultado = false }: { resultado?: boolean }) {
  const id = Number(useParams().id)
  const api = useApi()
  const reserva = useQuery({ queryKey: ['reserva', id], queryFn: () => api.consumidor.obterReserva(id) })

  if (reserva.isPending) return <EsqueletoLista quantidade={1} rotulo="Carregando reserva…" />
  if (reserva.isError) return <MensagemErro erro={reserva.error} />
  return <Navigate to={`/pedidos/${reserva.data.pedido_id}${resultado ? '/resultado' : ''}`} replace />
}
