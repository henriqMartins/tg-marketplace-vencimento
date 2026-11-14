import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { criarClienteDoAmbiente, type ClienteApi } from '../api'
import { ProvedorToast } from '../componentes/toast/ProvedorToast'
import type { BuscarCep } from '../localizacao/cep'
import type { GeocodificarEndereco } from '../localizacao/endereco'
import type { ObterPosicao } from '../localizacao/posicao'
import { ProvedorLocal } from '../localizacao/ProvedorLocal'
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
  buscarCep?: BuscarCep
  obterPosicao?: ObterPosicao
  geocodificarEndereco?: GeocodificarEndereco
}

/** Tudo que as telas precisam por perto: API, consultas, sessão, local escolhido e toast. */
export function ProvedorApp({ children, ...pecas }: ProvedorAppProps) {
  const [armazem] = useState(() => pecas.armazem ?? criarArmazemSessao())
  const [cliente] = useState(() => pecas.cliente ?? criarClienteDoAmbiente(armazem.obterToken))
  const [consultas] = useState(() => pecas.consultas ?? criarClienteConsultas(() => armazem.limpar()))

  return (
    <QueryClientProvider client={consultas}>
      <ContextoApi.Provider value={cliente}>
        <ProvedorSessao armazem={armazem}>
          <ProvedorLocal buscarCep={pecas.buscarCep} obterPosicao={pecas.obterPosicao} geocodificarEndereco={pecas.geocodificarEndereco}>
            <ProvedorToast>{children}</ProvedorToast>
          </ProvedorLocal>
        </ProvedorSessao>
      </ContextoApi.Provider>
    </QueryClientProvider>
  )
}
