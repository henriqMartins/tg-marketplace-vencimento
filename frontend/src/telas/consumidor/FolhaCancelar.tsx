import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Reserva } from '../../api'
import { useApi } from '../../app/contextos'
import { Botao } from '../../componentes/Botao'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { MensagemErro } from '../../componentes/Mensagem'
import styles from './Consumidor.module.css'

/** C7, estado 1: confirmar o cancelamento (folha sobre C5 parcial ou C6). */
export function FolhaCancelar({
  reserva,
  aberta,
  aoFechar,
  aoCancelar,
}: {
  reserva: Reserva
  aberta: boolean
  aoFechar: () => void
  aoCancelar: (cancelada: Reserva) => void
}) {
  const api = useApi()
  const consultas = useQueryClient()
  const cancelar = useMutation({
    mutationFn: () => api.consumidor.cancelarReserva(reserva.id),
    onSuccess: (cancelada) => {
      consultas.setQueryData(['reserva', cancelada.id], cancelada)
      void consultas.invalidateQueries({ queryKey: ['minhas-reservas'] })
      void consultas.invalidateQueries({ queryKey: ['vitrine'] })
      void consultas.invalidateQueries({ queryKey: ['oferta', cancelada.oferta.id] })
      aoCancelar(cancelada)
    },
  })
  const unidades = reserva.quantidade === 1 ? 'A unidade volta' : `As ${reserva.quantidade} unidades voltam`

  return (
    <FolhaInferior aberta={aberta} titulo="Cancelar esta reserva?" aoFechar={aoFechar}>
      <p className={styles.texto}>
        {unidades} para a vitrine na hora e este código deixa de valer. Não dá para desfazer.
      </p>
      {cancelar.isError && <MensagemErro erro={cancelar.error} />}
      <Botao variante="perigoSolido" carregando={cancelar.isPending} textoCarregando="Cancelando…" onClick={() => cancelar.mutate()}>
        Sim, cancelar
      </Botao>
      <Botao variante="secundario" onClick={aoFechar}>
        Manter reserva
      </Botao>
    </FolhaInferior>
  )
}
