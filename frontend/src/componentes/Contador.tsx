import { useEffect, useLayoutEffect, useRef, type MouseEvent, type PointerEvent } from 'react'
import { classes } from '../util/classes'
import styles from './Contador.module.css'

/** 60 px (consumidor, C4), 72 px (cadastro do lote, L3), 96 px (conferência na gôndola, L6). */
export type TamanhoContador = 'consumidor' | 'cadastro' | 'conferencia'

export interface ContadorProps {
  valor: number
  min?: number
  max: number
  aoMudar: (valor: number) => void
  /** Nome do grupo para leitor de tela, ex.: "Quantidade". */
  rotulo: string
  tamanho?: TamanhoContador
}

const ESPERA_REPETIR_MS = 400
const INTERVALO_REPETIR_MS = 100

/**
 * Contador −/+. Nunca abre teclado (não tem campo de texto). No limite, o botão
 * trava com 40% de opacidade. Segurar o botão repete (útil para contar 24 unidades).
 * Os limites (ex.: max = livre) vêm de quem usa; o contador só os respeita.
 */
export function Contador({ valor, min = 0, max, aoMudar, rotulo, tamanho = 'consumidor' }: ContadorProps) {
  const valorAtual = useRef(valor)
  const timers = useRef<{ espera?: number; repete?: number }>({})
  const repetiu = useRef(false)

  useLayoutEffect(() => {
    valorAtual.current = valor
  }, [valor])

  function parar() {
    window.clearTimeout(timers.current.espera)
    window.clearInterval(timers.current.repete)
    timers.current = {}
  }

  useEffect(() => parar, [])

  function passo(delta: number) {
    const proximo = Math.min(max, Math.max(min, valorAtual.current + delta))
    if (proximo === valorAtual.current) {
      parar()
      return
    }
    valorAtual.current = proximo
    aoMudar(proximo)
  }

  const iniciarRepeticao = (delta: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button > 0) return // só botão principal / dedo
    repetiu.current = false
    parar()
    timers.current.espera = window.setTimeout(() => {
      repetiu.current = true
      passo(delta)
      timers.current.repete = window.setInterval(() => passo(delta), INTERVALO_REPETIR_MS)
    }, ESPERA_REPETIR_MS)
  }

  const clicar = (delta: number) => (e: MouseEvent<HTMLButtonElement>) => {
    // Depois de segurar, o clique que vem ao soltar não conta de novo.
    // (Clique pelo teclado tem detail 0 e sempre conta.)
    if (repetiu.current && e.detail > 0) {
      repetiu.current = false
      return
    }
    passo(delta)
  }

  const eventos = (delta: number) => ({
    onClick: clicar(delta),
    onPointerDown: iniciarRepeticao(delta),
    onPointerUp: parar,
    onPointerLeave: parar,
    onPointerCancel: parar,
    onContextMenu: (e: MouseEvent) => e.preventDefault(), // toque longo não abre menu
  })

  return (
    <div className={classes(styles.contador, styles[tamanho])} role="group" aria-label={rotulo}>
      <button
        type="button"
        className={classes(styles.botao, styles.menos)}
        aria-label="Diminuir"
        disabled={valor <= min}
        {...eventos(-1)}
      >
        −
      </button>
      <output className={styles.valor} aria-live="polite">
        {valor}
      </output>
      <button
        type="button"
        className={classes(styles.botao, styles.mais)}
        aria-label="Aumentar"
        disabled={valor >= max}
        {...eventos(+1)}
      >
        +
      </button>
    </div>
  )
}
