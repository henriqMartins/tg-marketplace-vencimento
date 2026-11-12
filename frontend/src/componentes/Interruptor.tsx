import { useId, type ReactNode } from 'react'
import styles from './Interruptor.module.css'

/** Interruptor liga/desliga (role="switch"), com o texto clicável. */
export function Interruptor({
  ligado,
  aoMudar,
  children,
  detalhe,
  desabilitado = false,
}: {
  ligado: boolean
  aoMudar: (ligado: boolean) => void
  children: ReactNode
  detalhe?: string
  desabilitado?: boolean
}) {
  const id = useId()
  return (
    <div className={styles.linha}>
      <span className={styles.textos}>
        <label htmlFor={id} className={styles.rotulo}>
          {children}
        </label>
        {detalhe && <span className={styles.detalhe}>{detalhe}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={ligado}
        disabled={desabilitado}
        className={styles.interruptor}
        onClick={() => aoMudar(!ligado)}
      >
        <span className={styles.bolinha} aria-hidden="true" />
      </button>
    </div>
  )
}
