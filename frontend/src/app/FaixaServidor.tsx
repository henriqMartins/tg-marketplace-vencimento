import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Botao } from '../componentes/Botao'
import { ATRASO_FAIXA_MS, LIMITE_SERVIDOR_MS, useLimiteEspera, useOnline } from './espera'
import styles from './FaixaServidor.module.css'

/**
 * Faixa global (seção 0, item 1): observa TODAS as chamadas em andamento.
 *   > 2 s esperando  → "Conectando ao servidor… pode levar até 1 minuto"
 *   > 90 s           → "O servidor não respondeu" + Tentar de novo
 *   sem internet     → "Sem internet. Mostrando os dados da última atualização."
 * Nenhuma tela precisa fazer nada para ganhar a faixa.
 */
export function FaixaServidor() {
  const consultas = useQueryClient()
  const esperando = useIsFetching() + useIsMutating() > 0
  const online = useOnline()
  const [reinicio, setReinicio] = useState(0)
  const demorando = useLimiteEspera(esperando, ATRASO_FAIXA_MS, reinicio)
  const naoRespondeu = useLimiteEspera(esperando, LIMITE_SERVIDOR_MS, reinicio)

  async function tentarDeNovo() {
    setReinicio((n) => n + 1)
    await consultas.cancelQueries()
    await consultas.refetchQueries({ type: 'active' })
  }

  if (!online) {
    return (
      <div className={`${styles.faixa} ${styles.offline}`} role="status">
        Sem internet. Mostrando os dados da última atualização.
      </div>
    )
  }
  if (naoRespondeu) {
    return (
      <div className={`${styles.faixa} ${styles.erro}`} role="alert">
        <span>O servidor não respondeu.</span>
        <Botao variante="secundario" larguraTotal={false} className={styles.botao} onClick={tentarDeNovo}>
          Tentar de novo
        </Botao>
      </div>
    )
  }
  if (demorando) {
    return (
      <div className={`${styles.faixa} ${styles.acordando}`} role="status">
        <span className={styles.giro} aria-hidden="true" />
        Conectando ao servidor… pode levar até 1 minuto
      </div>
    )
  }
  return null
}
