import type { ButtonHTMLAttributes } from 'react'
import { classes } from '../util/classes'
import styles from './Chip.module.css'

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> {
  ativo: boolean
}

/** Chip em pílula (filtros da vitrine, por exemplo). Ativo: fundo primary, texto branco. */
export function Chip({ ativo, className, type = 'button', ...resto }: ChipProps) {
  return <button type={type} aria-pressed={ativo} className={classes(styles.chip, className)} {...resto} />
}
