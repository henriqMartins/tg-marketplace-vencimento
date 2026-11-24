import { Link, NavLink, Outlet } from 'react-router'
import { IconeCasa, IconeMais, IconeReservas } from '../../componentes/icones'
import { NavInferior } from '../../componentes/NavInferior'
import { useSessao } from '../contextos'
import { NOME_DO_APP } from '../marca'
import { useEhDesktop } from '../tela'
import styles from './Layouts.module.css'

const MENU = [
  { caminho: '/plataforma/interessados', rotulo: 'Interessados' },
  { caminho: '/plataforma/lojas', rotulo: 'Lojas', exato: true },
  { caminho: '/plataforma/lojas/nova', rotulo: 'Cadastrar loja' },
]

/**
 * Área da equipe da plataforma (P1–P3). Computador primeiro: menu lateral como o do gestor.
 * No celular: o mesmo conteúdo empilhado, com a navegação inferior.
 */
export function LayoutPlataforma() {
  const { eu } = useSessao()
  const desktop = useEhDesktop()
  const classeItem = ({ isActive }: { isActive: boolean }) =>
    isActive ? `${styles.itemMenu} ${styles.itemAtivo}` : styles.itemMenu

  if (!desktop) {
    return (
      <div className={styles.celular}>
        <header className={styles.topoCelular}>
          <span className={styles.nomeApp}>Equipe da plataforma</span>
          <Link to="/escolher" className={styles.trocar}>
            Trocar perfil
          </Link>
        </header>
        <main className={styles.conteudo}>
          <Outlet />
        </main>
        <NavInferior
          rotulo="Navegação da plataforma"
          itens={[
            { para: '/plataforma/interessados', rotulo: 'Interessados', icone: <IconeReservas /> },
            { para: '/plataforma/lojas', rotulo: 'Lojas', icone: <IconeCasa />, exato: true },
            { para: '/plataforma/lojas/nova', rotulo: 'Nova loja', icone: <IconeMais /> },
          ]}
        />
      </div>
    )
  }

  return (
    <div className={styles.gestor}>
      <aside className={styles.lateral}>
        <div className={styles.marca}>
          <span className={styles.nomeApp}>{NOME_DO_APP}</span>
          <span className={styles.nomeLoja}>Equipe da plataforma</span>
        </div>
        <nav aria-label="Menu da plataforma" className={styles.menu}>
          {MENU.map((item) => (
            <NavLink key={item.caminho} to={item.caminho} end={item.exato} className={classeItem}>
              {item.rotulo}
            </NavLink>
          ))}
        </nav>
        <div className={styles.usuario}>
          <span>{eu?.nome}</span>
          <Link to="/escolher" className={styles.trocar}>
            Trocar perfil
          </Link>
        </div>
      </aside>
      <main className={styles.conteudoLargo}>
        <Outlet />
      </main>
    </div>
  )
}
