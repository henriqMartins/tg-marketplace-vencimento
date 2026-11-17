/*
 * Configuração do TanStack Query (buscar dados e mantê-los atualizados).
 * Seção 0 da especificação: servidor acordando (nova tentativa), estado sempre fresco
 * (recarga de 30 s só com a tela visível) e 401 → sessão encerrada.
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ehErroApi } from '../api'

const MAX_TENTATIVAS = 10

/**
 * Tenta de novo só quando faz sentido: sem resposta (servidor acordando, rede) ou erro 5xx.
 * Erro de regra (400, 404, 409) ou de permissão (401, 403) não muda repetindo.
 */
export function deveTentarDeNovo(falhas: number, erro: unknown): boolean {
  if (falhas >= MAX_TENTATIVAS) return false
  return ehErroApi(erro) && (erro.status === 0 || erro.status >= 500)
}

/** 1 s, 2 s, 4 s, 8 s, depois 10 s: cobre o ~1 min que o Render leva para acordar. */
export function atrasoNovaTentativa(tentativa: number): number {
  return Math.min(1000 * 2 ** tentativa, 10_000)
}

/**
 * Para as telas de reserva, código, oferta e painel: recarrega a cada 30 s.
 * Com a aba oculta não recarrega (refetchIntervalInBackground fica false) e,
 * quando a aba volta, recarrega na hora (refetchOnWindowFocus).
 */
export const RECARGA_30S = { refetchInterval: 30_000 } as const

export function criarClienteConsultas(aoNaoAutenticado: () => void): QueryClient {
  const tratar401 = (erro: unknown) => {
    if (ehErroApi(erro) && erro.status === 401) aoNaoAutenticado()
  }
  return new QueryClient({
    queryCache: new QueryCache({ onError: tratar401 }),
    mutationCache: new MutationCache({ onError: tratar401 }),
    defaultOptions: {
      queries: {
        retry: deveTentarDeNovo,
        retryDelay: atrasoNovaTentativa,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  })
}
