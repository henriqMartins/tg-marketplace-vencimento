import { useRef, type KeyboardEvent } from 'react'
import styles from './Abas.module.css'
import { idAba, idPainel } from './abasIds'

export interface Aba {
  id: string
  rotulo: string
}

/**
 * Abas com o padrão de acessibilidade de "tablist": setas ← → trocam de aba, só a ativa recebe Tab.
 * Quem usa desenha o painel com role="tabpanel", id={idPainel(…)} e aria-labelledby={idAba(…)}.
 */
export function Abas({
  prefixo,
  abas,
  ativa,
  aoTrocar,
  rotulo,
}: {
  prefixo: string
  abas: Aba[]
  ativa: string
  aoTrocar: (id: string) => void
  rotulo: string
}) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([])

  function teclas(e: KeyboardEvent, indice: number) {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!passo) return
    e.preventDefault()
    const proximo = (indice + passo + abas.length) % abas.length
    aoTrocar(abas[proximo].id)
    botoes.current[proximo]?.focus()
  }

  return (
    <div role="tablist" aria-label={rotulo} className={styles.abas}>
      {abas.map((aba, i) => {
        const selecionada = aba.id === ativa
        return (
          <button
            key={aba.id}
            ref={(el) => {
              botoes.current[i] = el
            }}
            type="button"
            role="tab"
            id={idAba(prefixo, aba.id)}
            aria-selected={selecionada}
            aria-controls={idPainel(prefixo, aba.id)}
            tabIndex={selecionada ? 0 : -1}
            className={styles.aba}
            onClick={() => aoTrocar(aba.id)}
            onKeyDown={(e) => teclas(e, i)}
          >
            {aba.rotulo}
          </button>
        )
      })}
    </div>
  )
}
