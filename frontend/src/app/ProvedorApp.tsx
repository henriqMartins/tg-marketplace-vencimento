import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { criarClienteDoAmbiente, type ClienteApi } from '../api'
import { ProvedorToast } from '../componentes/toast/ProvedorToast'
import { criarClienteConsultas } from './consultas'
import { ContextoApi } from './contextos'
import { criarArmazemSessao, type ArmazemSessao } from './sessao/armazem'
import { ProvedorSessao } from './sessao/ProvedorSessao'

export interface ProvedorAppProps {
  children: ReactNode
  /** Nos testes: peças controladas (mock com relógio fixo, armazenamento em memória…). */
  armazem?: ArmazemSessao
  cliente?: ClienteApi
  consultas?: QueryClient
}

/** Tudo que as telas precisam por perto: API, consultas, sessão e toast. */
export function ProvedorApp({ children, ...pecas }: ProvedorAppProps) {
  const [armazem] = useState(() => pecas.armazem ?? criarArmazemSessao())
  const [cliente] = useState(() => pecas.cliente ?? criarClienteDoAmbiente(armazem.obterToken))
  const [consultas] = useState(() => pecas.consultas ?? criarClienteConsultas(() => armazem.limpar()))

  return (
    <QueryClientProvider client={consultas}>
      <ContextoApi.Provider value={cliente}>
        <ProvedorSessao armazem={armazem}>
          <ProvedorToast>{children}</ProvedorToast>
        </ProvedorSessao>
      </ContextoApi.Provider>
    </QueryClientProvider>
  )
}
