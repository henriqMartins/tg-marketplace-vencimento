import type { CorFita, Data, Fita } from '../api/tipos'
import { classes } from '../util/classes'
import { nomeDaCor } from '../util/fita'
import { formatarData, formatarDataCurta } from '../util/formatar'
import styles from './AmostraFita.module.css'

export interface AmostraFitaProps {
  /** Vem pronta da API (a cor é calculada só no backend). */
  fita: Fita
  /** Data exata — obrigatória: a amostra nunca aparece só com a cor (daltonismo, iluminação). */
  data: Data
  /** Texto antes da data, ex.: "vence", "ref.". */
  rotuloData?: string
  /** "lista": quadrado de 44 px (L4, L5); "linha": 20 px, dentro de texto; "compacta": 12 px e data curta (tabela da G4); "destaque": 64 px (L3). */
  tamanho?: 'lista' | 'linha' | 'compacta' | 'destaque'
}

export function AmostraFita({ fita, data, rotuloData = 'vence', tamanho = 'lista' }: AmostraFitaProps) {
  return (
    <span className={classes(styles.amostra, styles[tamanho])}>
      <span className={classes(styles.cor, styles[fita.cor])} aria-hidden="true" />
      {tamanho === 'destaque' ? (
        // Card da fita da L3: 64 px, nome grande e o bimestre — e a data exata, como sempre.
        <span className={styles.textoDestaque}>
          <strong className={styles.nomeDestaque}>{nomeDaCor(fita.cor)}</strong>
          <span className={styles.texto}>
            Bimestre de vencimento: {fita.bimestre} · {rotuloData} {formatarData(data)}
          </span>
        </span>
      ) : tamanho === 'compacta' ? (
        <span className={styles.texto}>
          <span className="so-leitor">Fita </span>
          <strong>{nomeDaCor(fita.cor)}</strong> · <span className="so-leitor">{rotuloData} </span>
          {formatarDataCurta(data)}
        </span>
      ) : (
        <span className={styles.texto}>
          Fita <strong>{nomeDaCor(fita.cor)}</strong> · {rotuloData} {formatarData(data)}
        </span>
      )}
    </span>
  )
}

/** Bolinha da cor, DECORATIVA: só ao lado do nome da cor (chips de filtro da L4 e da G5). */
export function BolinhaFita({ cor }: { cor: CorFita }) {
  return <span className={classes(styles.bolinha, styles[cor])} aria-hidden="true" />
}
