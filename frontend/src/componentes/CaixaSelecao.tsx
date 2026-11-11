import type { InputHTMLAttributes, ReactNode } from 'react'
import styles from './CaixaSelecao.module.css'

export interface CaixaSelecaoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  children: ReactNode
}

/** Caixa de seleção nativa (22 px, cor primary) com o texto clicável e área de toque de 44 px. */
export function CaixaSelecao({ children, ...entrada }: CaixaSelecaoProps) {
  return (
    <label className={styles.caixa}>
      <input type="checkbox" className={styles.marca} {...entrada} />
      <span>{children}</span>
    </label>
  )
}
