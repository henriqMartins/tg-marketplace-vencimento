import { useSyncExternalStore } from 'react'

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
