import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Pedido } from '../../api'
import { useApi } from '../../app/contextos'
import { Botao } from '../../componentes/Botao'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { MensagemErro } from '../../componentes/Mensagem'
import styles from './Consumidor.module.css'

export type AlvoCancelar = 'pedido' | 'item'

/**
 * C7, estado 1 (grupo J): confirmar o cancelamento sobre a C5 ou a C6.
 * "pedido": todos os itens ativos voltam para a vitrine. "item": a pessoa escolhe qual;
 * só ele volta e o código continua valendo para o resto.
 */
export function FolhaCancelarPedido({
  pedido,
  alvo,
  aoFechar,
  aoCancelar,
}: {
  pedido: Pedido
  /** null = fechada. */
  alvo: AlvoCancelar | null
  aoFechar: () => void
  aoCancelar: (depois: Pedido, alvo: AlvoCancelar) => void
}) {
  const api = useApi()
  const consultas = useQueryClient()
  const cancelar = useMutation({
    mutationFn: (reservaId: number | null) =>
      reservaId === null ? api.pedidos.cancelar(pedido.id) : api.pedidos.cancelarItem(pedido.id, reservaId),
    onSuccess: (depois, reservaId) => {
      consultas.setQueryData(['pedido', depois.id], depois)
      void consultas.invalidateQueries({ queryKey: ['pedidos'] })
      void consultas.invalidateQueries({ queryKey: ['vitrine'] })
      void consultas.invalidateQueries({ queryKey: ['oferta'] })
      cancelar.reset()
      aoCancelar(depois, reservaId === null ? 'pedido' : 'item')
    },
  })
  const ativos = pedido.itens.filter((i) => i.estado === 'reservada')
  const fechar = () => {
    cancelar.reset()
    aoFechar()
  }

  if (alvo === 'item') {
    return (
      <FolhaInferior aberta titulo="Qual item cancelar?" aoFechar={fechar}>
        <p className={styles.texto}>
          O item volta para a vitrine na hora. O código continua valendo para o resto. Não dá para desfazer.
        </p>
        {cancelar.isError && <MensagemErro erro={cancelar.error} />}
        {ativos.map((item) => (
          <Botao
            key={item.reserva_id}
            variante="perigo"
            disabled={cancelar.isPending}
            carregando={cancelar.isPending && cancelar.variables === item.reserva_id}
            textoCarregando="Cancelando…"
            onClick={() => cancelar.mutate(item.reserva_id)}
          >
            Cancelar {item.produto} ({item.quantidade} un.)
          </Botao>
        ))}
        <Botao variante="secundario" onClick={fechar}>
          Manter todos
        </Botao>
      </FolhaInferior>
    )
  }

  return (
    <FolhaInferior aberta={alvo === 'pedido'} titulo="Cancelar o pedido?" aoFechar={fechar}>
      <p className={styles.texto}>
        {ativos.length === 1 ? 'O item volta' : `Os ${ativos.length} itens voltam`} para a vitrine na hora e este código
        deixa de valer. Não dá para desfazer.
      </p>
      {cancelar.isError && <MensagemErro erro={cancelar.error} />}
      <Botao variante="perigoSolido" carregando={cancelar.isPending} textoCarregando="Cancelando…" onClick={() => cancelar.mutate(null)}>
        Sim, cancelar o pedido
      </Botao>
      <Botao variante="secundario" onClick={fechar}>
        Manter o pedido
      </Botao>
    </FolhaInferior>
  )
}
