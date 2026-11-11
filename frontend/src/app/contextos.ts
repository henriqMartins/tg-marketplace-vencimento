import { createContext, useContext } from 'react'
import type { ClienteApi, EntradaConta, EntradaLogin, Eu, Papel } from '../api'

// ---------- Cliente da API ----------

export const ContextoApi = createContext<ClienteApi | null>(null)

/** O cliente da API (mock ou real, conforme VITE_API). Telas usam só isto. */
export function useApi(): ClienteApi {
  const api = useContext(ContextoApi)
  if (!api) throw new Error('useApi precisa estar dentro de <ProvedorApp>.')
  return api
}

// ---------- Sessão ----------

export interface Sessao {
  token: string | null
  /** Quem está logado (GET /api/eu); null para visitante ou enquanto carrega. */
  eu: Eu | null
  carregandoEu: boolean
  erroEu: unknown
  entrar(entrada: EntradaLogin, lembrar?: boolean): Promise<Eu>
  criarConta(entrada: EntradaConta): Promise<Eu>
  sair(): Promise<void>
  /** Papel do usuário na loja, ou null se não tem vínculo com ela. */
  papelNaLoja(lojaId: number): Papel | null
}

export const ContextoSessao = createContext<Sessao | null>(null)

export function useSessao(): Sessao {
  const sessao = useContext(ContextoSessao)
  if (!sessao) throw new Error('useSessao precisa estar dentro de <ProvedorApp>.')
  return sessao
}
