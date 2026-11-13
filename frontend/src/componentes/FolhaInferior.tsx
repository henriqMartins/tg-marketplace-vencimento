import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './FolhaInferior.module.css'

export interface FolhaInferiorProps {
  aberta: boolean
  /** Título visível; também dá o nome do diálogo (aria-labelledby). */
  titulo: string
  aoFechar: () => void
  children: ReactNode
  /** 'modal': caixa no centro, para o computador (G4 abre a L11 assim). Padrão: folha de baixo. */
  forma?: 'folha' | 'modal'
}

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Folha inferior (bottom sheet) com véu. É um diálogo modal: foco vai para dentro ao abrir,
 * Tab não escapa, Esc ou toque no véu fecham, e o foco volta para quem abriu.
 */
export function FolhaInferior({ aberta, titulo, aoFechar, children, forma = 'folha' }: FolhaInferiorProps) {
  const idTitulo = useId()
  const folha = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberta) return
    const anterior = document.activeElement as HTMLElement | null
    const primeiro = folha.current?.querySelector<HTMLElement>(FOCAVEIS)
    ;(primeiro ?? folha.current)?.focus()
    return () => anterior?.focus()
  }, [aberta])

  if (!aberta) return null

  function teclas(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      aoFechar()
      return
    }
    if (e.key !== 'Tab' || !folha.current) return
    const focaveis = [...folha.current.querySelectorAll<HTMLElement>(FOCAVEIS)]
    if (focaveis.length === 0) {
      e.preventDefault()
      return
    }
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primeiro.focus()
    }
  }

  return createPortal(
    <div
      className={forma === 'modal' ? `${styles.veu} ${styles.veuCentro}` : styles.veu}
      data-testid="veu"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar()
      }}
    >
      <div
        ref={folha}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={forma === 'modal' ? `${styles.folha} ${styles.modal}` : styles.folha}
        onKeyDown={teclas}
      >
        {forma === 'folha' && <span className={styles.puxador} aria-hidden="true" />}
        <h2 id={idTitulo} className={styles.titulo}>
          {titulo}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}
