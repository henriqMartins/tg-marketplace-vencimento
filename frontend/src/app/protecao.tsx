/*
 * Proteção das rotas. É CONFORTO, não segurança: evita mostrar uma tela que daria erro.
 * Quem barra de verdade é o backend (401 sem login, 403 sem papel).
 */
import { Navigate, Outlet, useLocation } from 'react-router'
import type { Papel } from '../api'
import { Botao } from '../componentes/Botao'
import { MensagemErro } from '../componentes/Mensagem'
import { useSessao } from './contextos'
import { useLojaAtual } from './loja'
import styles from './protecao.module.css'
import { SemAcesso } from './telas/SemAcesso'

/** Sem login → /entrar?voltar=<onde estava>. Enquanto descobre quem é, mostra "Carregando…". */
export function ExigeLogin() {
  const { token, eu, erroEu, recarregarEu } = useSessao()
  const local = useLocation()

  if (!token) {
    const voltar = encodeURIComponent(local.pathname + local.search)
    return <Navigate to={`/entrar?voltar=${voltar}`} replace />
  }
  if (erroEu && !eu) {
    return (
      <div className={styles.centro}>
        <MensagemErro erro={erroEu} />
        <Botao variante="secundario" onClick={recarregarEu}>
          Tentar de novo
        </Botao>
      </div>
    )
  }
  if (!eu) {
    return (
      <p className={styles.centro} role="status">
        Carregando…
      </p>
    )
  }
  return <Outlet />
}

/** Exige vínculo com a loja da rota; com `papel="responsavel"`, só o responsável passa. */
export function ExigeVinculo({ papel }: { papel?: Papel }) {
  const loja = useLojaAtual()
  if (!loja.papel || (papel && loja.papel !== papel)) return <SemAcesso />
  return <Outlet />
}
