import { useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { classes } from '../util/classes'
import styles from './Campo.module.css'
import { IconeOlho, IconeOlhoFechado } from './icones'

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> {
  rotulo: string
  /** Ajuda fixa embaixo do campo, ex.: "Pelo menos 8 caracteres." */
  dica?: string
  /** Erro embaixo do campo; liga aria-invalid e é lido junto com o campo. */
  erro?: string | null
  /** Algo ao lado do rótulo (ex.: link). */
  aoLadoDoRotulo?: ReactNode
  /** Algo dentro da caixa, à direita (ex.: botão de mostrar senha). */
  dentro?: ReactNode
}

/** Rótulo + campo de 52 px + dica + erro (artboard "Campos"). */
export function Campo({ rotulo, dica, erro, aoLadoDoRotulo, dentro, id, className, ...entrada }: CampoProps) {
  const gerado = useId()
  const idCampo = id ?? gerado
  const idDica = `${idCampo}-dica`
  const idErro = `${idCampo}-erro`
  const descritoPor = [dica && idDica, erro && idErro].filter(Boolean).join(' ') || undefined

  return (
    <div className={classes(styles.campo, className)}>
      <div className={styles.linhaRotulo}>
        <label htmlFor={idCampo} className={styles.rotulo}>
          {rotulo}
        </label>
        {aoLadoDoRotulo}
      </div>
      <div className={classes(styles.caixa, erro && styles.comErro)}>
        <input
          id={idCampo}
          className={styles.entrada}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descritoPor}
          {...entrada}
        />
        {dentro}
      </div>
      {dica && (
        <span id={idDica} className={styles.dica}>
          {dica}
        </span>
      )}
      {erro && (
        <span id={idErro} className={styles.erro}>
          {erro}
        </span>
      )}
    </div>
  )
}

/** Campo de senha com o botão de olho "Mostrar senha". */
export function CampoSenha(props: Omit<CampoProps, 'type' | 'dentro'>) {
  const [visivel, setVisivel] = useState(false)
  return (
    <Campo
      {...props}
      type={visivel ? 'text' : 'password'}
      dentro={
        <button
          type="button"
          className={styles.olho}
          aria-label="Mostrar senha"
          aria-pressed={visivel}
          onClick={() => setVisivel((v) => !v)}
        >
          {visivel ? <IconeOlhoFechado /> : <IconeOlho />}
        </button>
      }
    />
  )
}

export interface CampoTextoProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'> {
  rotulo: string
  dica?: string
  erro?: string | null
}

/** Rótulo + texto de várias linhas (ex.: mensagem opcional, motivo). Mesmo visual do Campo. */
export function CampoTexto({ rotulo, dica, erro, id, className, rows = 3, ...entrada }: CampoTextoProps) {
  const gerado = useId()
  const idCampo = id ?? gerado
  const idDica = `${idCampo}-dica`
  const idErro = `${idCampo}-erro`
  const descritoPor = [dica && idDica, erro && idErro].filter(Boolean).join(' ') || undefined

  return (
    <div className={classes(styles.campo, className)}>
      <label htmlFor={idCampo} className={styles.rotulo}>
        {rotulo}
      </label>
      <div className={classes(styles.caixa, styles.caixaTexto, erro && styles.comErro)}>
        <textarea
          id={idCampo}
          rows={rows}
          className={classes(styles.entrada, styles.entradaTexto)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descritoPor}
          {...entrada}
        />
      </div>
      {dica && (
        <span id={idDica} className={styles.dica}>
          {dica}
        </span>
      )}
      {erro && (
        <span id={idErro} className={styles.erro}>
          {erro}
        </span>
      )}
    </div>
  )
}
