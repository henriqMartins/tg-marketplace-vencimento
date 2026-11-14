/*
 * "Instalar na tela inicial" (C9). O navegador dispara `beforeinstallprompt` UMA vez, logo
 * que o app abre: guardamos o evento aqui (ouvirInstalacao, chamado no main.tsx) para a C9
 * usar quando a pessoa tocar no botão. iPhone (Safari) não tem esse evento: a C9 mostra a
 * instrução de "Compartilhar → Adicionar à Tela de Início" (decisão 3a da F9).
 */
import { useSyncExternalStore } from 'react'

/** O evento do Chrome/Android (não está nos tipos do DOM). */
export interface PedidoInstalacao extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type SituacaoInstalacao = 'pode_instalar' | 'instalado' | 'sem_pedido'

let pedido: PedidoInstalacao | null = null
let instalado = false
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

/** Liga os ouvintes do navegador. Chamado uma vez, antes de o React montar. */
export function ouvirInstalacao(janela: Window = window): () => void {
  instalado = janela.matchMedia?.('(display-mode: standalone)').matches ?? false
  const aoPedir = (e: Event) => {
    e.preventDefault() // o navegador não mostra a faixa dele; o pedido fica para a C9
    pedido = e as PedidoInstalacao
    avisar()
  }
  const aoInstalar = () => {
    pedido = null
    instalado = true
    avisar()
  }
  janela.addEventListener('beforeinstallprompt', aoPedir)
  janela.addEventListener('appinstalled', aoInstalar)
  return () => {
    janela.removeEventListener('beforeinstallprompt', aoPedir)
    janela.removeEventListener('appinstalled', aoInstalar)
  }
}

function situacao(): SituacaoInstalacao {
  if (instalado) return 'instalado'
  return pedido ? 'pode_instalar' : 'sem_pedido'
}

function assinar(avisarReact: () => void) {
  ouvintes.add(avisarReact)
  return () => ouvintes.delete(avisarReact)
}

/** Abre o pedido do navegador. O evento só serve uma vez: depois some (aceito ou não). */
export async function instalar(): Promise<void> {
  const atual = pedido
  if (!atual) return
  pedido = null
  avisar()
  await atual.prompt()
  await atual.userChoice
}

export function useInstalacao(): SituacaoInstalacao {
  return useSyncExternalStore(assinar, situacao)
}

/** Só para os testes: volta ao estado inicial. */
export function reiniciarInstalacao() {
  pedido = null
  instalado = false
  avisar()
}
