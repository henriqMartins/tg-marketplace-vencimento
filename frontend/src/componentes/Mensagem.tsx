import type { ReactNode } from 'react'
import { classes } from '../util/classes'
import { mensagemDeErro } from '../util/erros'
import styles from './Mensagem.module.css'

export type TipoMensagem = 'info' | 'sucesso' | 'atencao' | 'erro'

export interface MensagemProps {
  tipo: TipoMensagem
  /** Começo em negrito, ex.: "Atenção." */
  titulo?: string
  children: ReactNode
}

/** Caixa de mensagem (artboard "Mensagens"). A de erro é anunciada na hora (role="alert"). */
export function Mensagem({ tipo, titulo, children }: MensagemProps) {
  return (
    <div className={classes(styles.mensagem, styles[tipo])} role={tipo === 'erro' ? 'alert' : undefined}>
      {titulo && <strong>{titulo} </strong>}
      {children}
    </div>
  )
}

/** Mostra a frase do erro da API (nunca o código HTTP). */
export function MensagemErro({ erro, titulo }: { erro: unknown; titulo?: string }) {
  return (
    <Mensagem tipo="erro" titulo={titulo}>
      {mensagemDeErro(erro)}
    </Mensagem>
  )
}
