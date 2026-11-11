import { createContext, useContext } from 'react'

/** Tempo na tela (especificação, seção 0: "aparece por 4 s"). */
export const DURACAO_TOAST_MS = 4000

export interface DadosToast {
  mensagem: string
  /** Uma ação opcional, ex.: "Desfazer". */
  acao?: { rotulo: string; aoClicar: () => void }
}

export type MostrarToast = (toast: DadosToast | string) => void

export const ContextoToast = createContext<MostrarToast | null>(null)

/** const mostrarToast = useToast(); mostrarToast('Reserva cancelada') */
export function useToast(): MostrarToast {
  const mostrar = useContext(ContextoToast)
  if (!mostrar) throw new Error('useToast precisa estar dentro de <ProvedorToast>.')
  return mostrar
}
