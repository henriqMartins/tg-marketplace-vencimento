/*
 * Service worker (F9). Só no build de produção: no `npm run dev` e nos testes não há.
 * Versão nova não recarrega sozinha (decisão 2a): avisamos, e a pessoa toca em "Atualizar"
 * quando não estiver no meio de uma reserva ou de uma conferência.
 */
import { useSyncExternalStore } from 'react'

let atualizar: (() => Promise<void>) | null = null
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

/** Chamado no main.tsx. O módulo virtual só existe no build com o vite-plugin-pwa. */
export async function registrarServico(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const { registerSW } = await import('virtual:pwa-register')
  const atualizarSW = registerSW({
    onNeedRefresh() {
      // A versão nova já está baixada e esperando; "Atualizar" a ativa e recarrega.
      atualizar = () => atualizarSW(true)
      avisar()
    },
  })
}

/** Para os testes e para quem quiser simular: há versão nova esperando. */
export function avisarVersaoNova(acao: () => Promise<void>) {
  atualizar = acao
  avisar()
}

/** A função que ativa a versão nova, ou null se não há nenhuma esperando. */
export function useVersaoNova(): (() => Promise<void>) | null {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f)
      return () => ouvintes.delete(f)
    },
    () => atualizar,
  )
}
