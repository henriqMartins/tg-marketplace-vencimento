import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { ContextoSessao, useApi, type Sessao } from '../contextos'
import type { ArmazemSessao } from './armazem'

/** Sessão: o token guardado no aparelho + quem é o usuário (GET /api/eu). */
export function ProvedorSessao({ armazem, children }: { armazem: ArmazemSessao; children: ReactNode }) {
  const api = useApi()
  const consultas = useQueryClient()
  const token = useSyncExternalStore(armazem.assinar, armazem.obterToken)

  // O token faz parte da chave: trocar de conta nunca reaproveita o "eu" de outra pessoa.
  const consultaEu = useQuery({
    queryKey: ['eu', token],
    queryFn: () => api.acesso.eu(),
    enabled: token !== null,
    staleTime: 5 * 60_000,
  })

  const sessao = useMemo<Sessao>(() => {
    const eu = token ? (consultaEu.data ?? null) : null
    return {
      token,
      eu,
      carregandoEu: token !== null && consultaEu.isPending,
      erroEu: token ? consultaEu.error : null,
      async entrar(entrada, lembrar = true) {
        const { token: novo, usuario } = await api.acesso.entrar(entrada)
        consultas.setQueryData(['eu', novo], usuario)
        armazem.definir(novo, lembrar)
        return usuario
      },
      async criarConta(entrada) {
        const { token: novo, usuario } = await api.acesso.criarConta(entrada)
        consultas.setQueryData(['eu', novo], usuario)
        armazem.definir(novo, true)
        return usuario
      },
      async sair() {
        try {
          await api.acesso.sair()
        } catch {
          // Sem rede, sai do mesmo jeito neste aparelho.
        } finally {
          armazem.limpar()
          consultas.clear()
        }
      },
      papelNaLoja: (lojaId) => eu?.vinculos.find((v) => v.loja.id === lojaId)?.papel ?? null,
    }
  }, [token, consultaEu.data, consultaEu.isPending, consultaEu.error, api, armazem, consultas])

  return <ContextoSessao.Provider value={sessao}>{children}</ContextoSessao.Provider>
}
