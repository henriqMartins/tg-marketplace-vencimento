import { useSyncExternalStore } from 'react'
import { useLojaAtual } from './loja'

/** A partir daqui o responsável vê o layout de gestor (especificação, Página 4). */
const CONSULTA_DESKTOP = '(min-width: 1024px)'

function assinar(avisar: () => void) {
  const consulta = window.matchMedia(CONSULTA_DESKTOP)
  consulta.addEventListener('change', avisar)
  return () => consulta.removeEventListener('change', avisar)
}

/** true com tela de 1024 px ou mais; acompanha quando a janela muda de tamanho. */
export function useEhDesktop(): boolean {
  return useSyncExternalStore(assinar, () => window.matchMedia(CONSULTA_DESKTOP).matches)
}

/**
 * Responsável com tela ≥ 1024 px: vê o layout do gestor e as versões desktop
 * (G4, G5, G6) das rotas que também existem no celular.
 */
export function useVisaoGestor(): boolean {
  const desktop = useEhDesktop()
  const { papel } = useLojaAtual() // os dois hooks sempre, na mesma ordem
  return desktop && papel === 'responsavel'
}
