import type { ReactNode } from 'react'
import { Botao } from './Botao'
import styles from './EstadoVazio.module.css'

export interface EstadoVazioProps {
  /** Ícone decorativo (ex.: <IconeSacola />). */
  icone: ReactNode
  /** A frase principal, ex.: "Nenhuma reserva ativa". */
  frase: string
  detalhe?: string
  /** Uma ação, como pede a especificação (ex.: "Ver ofertas"). */
  acao: { rotulo: string; aoClicar: () => void }
}

export function EstadoVazio({ icone, frase, detalhe, acao }: EstadoVazioProps) {
  return (
    <div className={styles.vazio}>
      <span className={styles.icone} aria-hidden="true">
        {icone}
      </span>
      <p className={styles.frase}>{frase}</p>
      {detalhe && <p className={styles.detalhe}>{detalhe}</p>}
      <Botao variante="secundario" larguraTotal={false} className={styles.acao} onClick={acao.aoClicar}>
        {acao.rotulo}
      </Botao>
    </div>
  )
}
