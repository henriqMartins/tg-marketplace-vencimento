import { useMemo, useState, type ReactNode } from 'react'
import { buscarCep as buscarCepReal, type BuscarCep } from './cep'
import { ContextoLocal, type EstadoLocal, type Local } from './contexto'
import { obterPosicao as obterPosicaoReal, type ObterPosicao } from './posicao'

export interface ProvedorLocalProps {
  children: ReactNode
  /** Nos testes: serviços falsos (sem internet nem GPS). */
  buscarCep?: BuscarCep
  obterPosicao?: ObterPosicao
}

/** Guarda o local escolhido na memória da aba. Recarregou a página → sem local. */
export function ProvedorLocal({ children, buscarCep, obterPosicao }: ProvedorLocalProps) {
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
    }),
    [local, decidiu, buscarCep, obterPosicao],
  )

  return <ContextoLocal.Provider value={estado}>{children}</ContextoLocal.Provider>
}
