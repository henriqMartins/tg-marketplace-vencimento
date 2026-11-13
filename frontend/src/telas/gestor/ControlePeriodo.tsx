import { PERIODOS, type Periodo } from '../../util/periodo'
import { classes } from '../../util/classes'
import styles from './Gestor.module.css'

/** Controle segmentado 7 dias · 30 dias · Mês atual. */
export function ControlePeriodo({ periodo, aoTrocar }: { periodo: Periodo; aoTrocar: (p: Periodo) => void }) {
  return (
    <div role="group" aria-label="Período" className={styles.segmentado}>
      {PERIODOS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={p.id === periodo}
          className={classes(styles.segmento, p.id === periodo && styles.segmentoAtivo)}
          onClick={() => aoTrocar(p.id)}
        >
          {p.rotulo}
        </button>
      ))}
    </div>
  )
}
