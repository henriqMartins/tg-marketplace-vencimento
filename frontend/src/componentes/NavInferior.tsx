import { useEffect, type ReactNode } from 'react'
import { NavLink } from 'react-router'
import styles from './NavInferior.module.css'

export interface ItemNav {
  para: string
  rotulo: string
  icone: ReactNode
  /** Só fica ativo na rota exata (ex.: "Início" não acende em /loja/1/lotes). */
  exato?: boolean
  /** Número no selo (ex.: avisos para conferir). */
  contador?: number
  /** Texto do contador para leitor de tela, ex.: "para conferir". */
  rotuloContador?: string
}

const ALTURA = '64px'

/** Navegação inferior (seção 0, item 5). O item da página atual recebe aria-current="page". */
export function NavInferior({ rotulo, itens }: { rotulo: string; itens: ItemNav[] }) {
  // Avisa o resto da página (ex.: o toast) para não ficar embaixo da navegação.
  useEffect(() => {
    const raiz = document.documentElement
    raiz.style.setProperty('--espaco-inferior', ALTURA)
    return () => {
      raiz.style.removeProperty('--espaco-inferior')
    }
  }, [])

  return (
    <nav className={styles.nav} aria-label={rotulo}>
      <ul className={styles.lista} style={{ gridTemplateColumns: `repeat(${itens.length}, 1fr)` }}>
        {itens.map((item) => (
          <li key={item.para}>
            <NavLink
              to={item.para}
              end={item.exato}
              className={({ isActive }) => (isActive ? `${styles.item} ${styles.ativo}` : styles.item)}
            >
              <span className={styles.icone}>
                {item.icone}
                {item.contador ? (
                  <span className={styles.contador}>
                    {item.contador}
                    <span className="so-leitor"> {item.rotuloContador}</span>
                  </span>
                ) : null}
              </span>
              {item.rotulo}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
