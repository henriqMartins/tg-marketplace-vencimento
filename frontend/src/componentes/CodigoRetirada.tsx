import { classes } from '../util/classes'
import styles from './CodigoRetirada.module.css'

/**
 * Código de 6 dígitos em duas caixas de 3 (C6). O leitor de tela ouve "4 8 2 9 1 7" de uma vez;
 * as caixas são só visuais. `invalido`: código riscado (C7, expirada).
 */
export function CodigoRetirada({ codigo, invalido = false }: { codigo: string; invalido?: boolean }) {
  const digitos = codigo.split('')
  return (
    <div className={classes(styles.codigo, invalido && styles.invalido)}>
      <span className="so-leitor">
        {invalido ? 'Código sem validade: ' : 'Código: '}
        {digitos.join(' ')}
      </span>
      <span className={styles.grupos} aria-hidden="true">
        {[digitos.slice(0, 3), digitos.slice(3)].map((grupo, g) => (
          <span key={g} className={styles.grupo}>
            {grupo.map((d, i) => (
              <span key={i} className={styles.caixa}>
                {d}
              </span>
            ))}
          </span>
        ))}
      </span>
    </div>
  )
}
