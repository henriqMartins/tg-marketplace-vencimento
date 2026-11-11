import { Outlet } from 'react-router'
import { IconeAvisos, IconeCasa, IconeLotes, IconeRetirada } from '../../componentes/icones'
import { NavInferior } from '../../componentes/NavInferior'
import { useLojaAtual } from '../loja'
import { useEhDesktop } from '../tela'
import { LayoutGestor } from './LayoutGestor'
import styles from './Layouts.module.css'

/**
 * Loja. Mesma rota no celular e no computador (especificação, Página 4):
 *   responsável com tela ≥ 1024 px → menu lateral do gestor;
 *   resto → navegação inferior Início · Lotes · Avisos · Retirada.
 */
export function LayoutLoja() {
  const { lojaId, papel } = useLojaAtual()
  const desktop = useEhDesktop()

  if (desktop && papel === 'responsavel') return <LayoutGestor />

  const base = `/loja/${lojaId}`
  return (
    <div className={styles.celular}>
      <main className={styles.conteudo}>
        <Outlet />
      </main>
      <NavInferior
        rotulo="Navegação da loja"
        itens={[
          { para: base, rotulo: 'Início', icone: <IconeCasa />, exato: true },
          { para: `${base}/lotes`, rotulo: 'Lotes', icone: <IconeLotes /> },
          // O contador de avisos (resumo do dia, grupo C) entra na F6.
          { para: `${base}/avisos`, rotulo: 'Avisos', icone: <IconeAvisos /> },
          { para: `${base}/retirada`, rotulo: 'Retirada', icone: <IconeRetirada /> },
        ]}
      />
    </div>
  )
}
