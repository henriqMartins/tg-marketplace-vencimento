import { useMemo, useState, type ReactNode } from 'react'
import { buscarCep as buscarCepReal, type BuscarCep } from './cep'
import { geocodificarEndereco as geocodificarReal, type GeocodificarEndereco } from './endereco'
import { ContextoLocal, type EstadoLocal, type Local } from './contexto'
import { obterPosicao as obterPosicaoReal, type ObterPosicao } from './posicao'

export interface ProvedorLocalProps {
  children: ReactNode
  /** Nos testes: serviços falsos (sem internet nem GPS). */
  buscarCep?: BuscarCep
  obterPosicao?: ObterPosicao
  geocodificarEndereco?: GeocodificarEndereco
}

/** Guarda o local escolhido na memória da aba. Recarregou a página → sem local. */
export function ProvedorLocal({ children, buscarCep, obterPosicao, geocodificarEndereco }: ProvedorLocalProps) {
  const [local, setLocal] = useState<Local | null>(null)
  const [decidiu, setDecidiu] = useState(false)

  const estado = useMemo<EstadoLocal>(
    () => ({
      local,
      decidiu,
      definir(novo) {
        setLocal(novo)
        setDecidiu(true)
      },
      verSemLocal() {
        setLocal(null)
        setDecidiu(true)
      },
      buscarCep: buscarCep ?? ((cep) => buscarCepReal(cep)),
      obterPosicao: obterPosicao ?? obterPosicaoReal,
      geocodificarEndereco: geocodificarEndereco ?? ((endereco) => geocodificarReal(endereco)),
    }),
    [local, decidiu, buscarCep, obterPosicao, geocodificarEndereco],
  )

  return <ContextoLocal.Provider value={estado}>{children}</ContextoLocal.Provider>
}
