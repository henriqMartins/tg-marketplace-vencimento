import { Link, NavLink, Outlet, useMatches } from 'react-router'
import { useSessao } from '../contextos'
import { useLojaAtual } from '../loja'
import { NOME_DO_APP } from '../marca'
import styles from './Layouts.module.css'

/** Marca, na definição da rota, que a tela usa a largura toda do gestor (até 1240 px). */
export interface HandleRota {
  largura?: 'larga'
}

const MENU = [
  { caminho: 'painel', rotulo: 'Painel' },
  { caminho: 'projecao', rotulo: 'Projeção' },
  { caminho: 'ofertas', rotulo: 'Ofertas' },
  { caminho: 'lotes', rotulo: 'Lotes e fitas' },
  { caminho: 'reservas', rotulo: 'Reservas' },
  { caminho: 'config', rotulo: 'Configurações' },
]

/**
 * Responsável no computador: menu lateral de 232 px (especificação, Página 4) + o item
 * "Operação da loja" (→ L1), acrescentado em 11/11/2026. Telas de operação (L1, L5, L12…)
 * aparecem no centro, na largura de celular.
 */
export function LayoutGestor() {
  const { lojaId, nome } = useLojaAtual()
  const { eu } = useSessao()
  const larga = useMatches().some((rota) => (rota.handle as HandleRota | undefined)?.largura === 'larga')
  const base = `/loja/${lojaId}`
  const classeItem = ({ isActive }: { isActive: boolean }) =>
    isActive ? `${styles.itemMenu} ${styles.itemAtivo}` : styles.itemMenu

  return (
    <div className={styles.gestor}>
      <aside className={styles.lateral}>
        <div className={styles.marca}>
          <span className={styles.nomeApp}>{NOME_DO_APP}</span>
          <span className={styles.nomeLoja}>{nome}</span>
        </div>
        <nav aria-label="Menu do gestor" className={styles.menu}>
          {MENU.map((item) => (
            <NavLink key={item.caminho} to={`${base}/${item.caminho}`} className={classeItem}>
              {item.rotulo}
            </NavLink>
          ))}
          <hr className={styles.divisoria} />
          <NavLink to={base} end className={classeItem}>
            Operação da loja
          </NavLink>
        </nav>
        <div className={styles.usuario}>
          <span>{eu?.nome}</span>
          <Link to="/escolher" className={styles.trocar}>
            Trocar perfil
          </Link>
        </div>
      </aside>
      <main className={larga ? styles.conteudoLargo : styles.conteudo}>
        <Outlet />
      </main>
    </div>
  )
}
