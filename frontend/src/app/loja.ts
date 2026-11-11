import { useParams } from 'react-router'
import type { Papel } from '../api'
import { useSessao } from './contextos'

export interface LojaAtual {
  lojaId: number
  nome: string
  /** null se o usuário não tem vínculo com esta loja. */
  papel: Papel | null
}

/** A loja da rota atual (/loja/:lojaId/…) e o papel do usuário nela. */
export function useLojaAtual(): LojaAtual {
  const { lojaId } = useParams()
  const { eu } = useSessao()
  const id = Number(lojaId)
  const vinculo = eu?.vinculos.find((v) => v.loja.id === id)
  return { lojaId: id, nome: vinculo?.loja.nome ?? '', papel: vinculo?.papel ?? null }
}
