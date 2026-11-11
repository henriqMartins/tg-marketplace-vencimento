import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { classes } from '../util/classes'
import styles from './Botao.module.css'

export type VarianteBotao = 'primario' | 'secundario' | 'perigo'

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao
  /** Mostra o giro e trava o botão (evita envio em dobro). */
  carregando?: boolean
  textoCarregando?: string
  /** Padrão: largura total, como na especificação. */
  larguraTotal?: boolean
}

/** Primário 56 px; secundário e perigo 52 px. */
export function Botao({
  variante = 'primario',
  carregando = false,
  textoCarregando = 'Enviando…',
  larguraTotal = true,
  disabled,
  className,
  children,
  type = 'button',
  ...resto
}: BotaoProps) {
  return (
    <button
      type={type}
      className={classes(styles.botao, styles[variante], larguraTotal && styles.total, className)}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando ? (
        <>
          <span className={styles.giro} aria-hidden="true" />
          {textoCarregando}
        </>
      ) : (
        children
      )}
    </button>
  )
}

export interface BotaoIconeProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Nome para leitor de tela — obrigatório, porque o botão só tem ícone. */
  rotulo: string
  children: ReactNode
}

/** Botão só de ícone, 44 × 44. */
export function BotaoIcone({ rotulo, className, children, type = 'button', ...resto }: BotaoIconeProps) {
  return (
    <button type={type} aria-label={rotulo} title={rotulo} className={classes(styles.icone, className)} {...resto}>
      {children}
    </button>
  )
}
