/*
 * Proteção das rotas. É CONFORTO, não segurança: evita mostrar uma tela que daria erro.
 * Quem barra de verdade é o backend (401 sem login, 403 sem papel).
 */
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router'
import type { Papel } from '../api'
import { Botao } from '../componentes/Botao'
import { MensagemErro } from '../componentes/Mensagem'
import { useSessao } from './contextos'
import { caminhoInternoSeguro, destinoAposEntrar } from './destino'
import { lerEscolha } from './escolha'
import { useLojaAtual } from './loja'
import styles from './protecao.module.css'
import { useEhDesktop } from './tela'
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

/**
 * Telas de visitante (entrar, criar conta). Quem já está logado vai direto para o destino —
 * inclusive logo depois de entrar: as telas só chamam entrar()/criarConta() e este guarda leva.
 *   destino="boas-vindas": depois de criar a conta, a C1 (que continua para o ?voltar).
 */
export function SoVisitante({ destino }: { destino?: 'boas-vindas' }) {
  const { token, eu, erroEu } = useSessao()
  const [parametros] = useSearchParams()
  const desktop = useEhDesktop()

  if (!token || erroEu) return <Outlet />
  if (!eu) {
    return (
      <p className={styles.centro} role="status">
        Carregando…
      </p>
    )
  }
  const voltar = caminhoInternoSeguro(parametros.get('voltar'))
  if (destino === 'boas-vindas') {
    return <Navigate to={voltar ? `/boas-vindas?voltar=${encodeURIComponent(voltar)}` : '/boas-vindas'} replace />
  }
  return <Navigate to={destinoAposEntrar(eu, { voltar, desktop, escolhaLembrada: lerEscolha(eu.id) })} replace />
}
