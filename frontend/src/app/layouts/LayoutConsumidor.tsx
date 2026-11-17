import { Outlet, useLocation } from 'react-router'
import { IconeEntrar, IconePerfil, IconeReservas, IconeVitrine } from '../../componentes/icones'
import { NavInferior, type ItemNav } from '../../componentes/NavInferior'
import { useSessao } from '../contextos'
import styles from './Layouts.module.css'

/** Consumidor: Vitrine · Reservas · Perfil. Visitante: Vitrine · Entrar (decidido 11/11/2026). */
export function LayoutConsumidor() {
  const { token } = useSessao()
  const local = useLocation()

  const itens: ItemNav[] = token
    ? [
        { para: '/vitrine', rotulo: 'Vitrine', icone: <IconeVitrine /> },
        { para: '/reservas', rotulo: 'Reservas', icone: <IconeReservas /> },
        { para: '/perfil', rotulo: 'Perfil', icone: <IconePerfil /> },
      ]
    : [
        { para: '/vitrine', rotulo: 'Vitrine', icone: <IconeVitrine /> },
        {
          para: `/entrar?voltar=${encodeURIComponent(local.pathname + local.search)}`,
          rotulo: 'Entrar',
          icone: <IconeEntrar />,
        },
      ]

  return (
    <div className={styles.celular}>
      <main className={styles.conteudo}>
        <Outlet />
      </main>
      <NavInferior rotulo="Navegação principal" itens={itens} />
    </div>
  )
}
