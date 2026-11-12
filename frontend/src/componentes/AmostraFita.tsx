import type { Data, Fita } from '../api/tipos'
import { classes } from '../util/classes'
import { nomeDaCor } from '../util/fita'
import { formatarData } from '../util/formatar'
import styles from './AmostraFita.module.css'

export interface AmostraFitaProps {
  /** Vem pronta da API (a cor é calculada só no backend). */
  fita: Fita
  /** Data exata — obrigatória: a amostra nunca aparece só com a cor (daltonismo, iluminação). */
  data: Data
  /** Texto antes da data, ex.: "vence", "ref.". */
  rotuloData?: string
  /** "lista": quadrado de 44 px (L4, L5); "linha": 20 px, dentro de texto. */
  tamanho?: 'lista' | 'linha'
}

export function AmostraFita({ fita, data, rotuloData = 'vence', tamanho = 'lista' }: AmostraFitaProps) {
  return (
    <span className={classes(styles.amostra, styles[tamanho])}>
      <span className={classes(styles.cor, styles[fita.cor])} aria-hidden="true" />
      <span className={styles.texto}>
        Fita <strong>{nomeDaCor(fita.cor)}</strong> · {rotuloData} {formatarData(data)}
      </span>
    </span>
  )
}
