import { createContext, useContext } from 'react'
import type { BuscarCep } from './cep'
import type { GeocodificarEndereco } from './endereco'
import type { ObterPosicao } from './posicao'

/** Onde a pessoa quer ver ofertas. Só na memória: NADA é gravado (nem aqui, nem no backend). */
export interface Local {
  lat: number
  lng: number
  /** Texto do botão da vitrine, ex.: "Boa Vista · CEP 15025-000" ou "Sua localização". */
  rotulo: string
}

export interface EstadoLocal {
  /** null = sem local (vitrine sem ordem de distância). */
  local: Local | null
  /** A pessoa já passou pela C1 nesta visita (escolheu local ou "ver todas"). */
  decidiu: boolean
  definir(local: Local): void
  verSemLocal(): void
  buscarCep: BuscarCep
  obterPosicao: ObterPosicao
  /** Endereço da loja → coordenada (L14/G6). */
  geocodificarEndereco: GeocodificarEndereco
}

export const ContextoLocal = createContext<EstadoLocal | null>(null)

export function useLocal(): EstadoLocal {
  const estado = useContext(ContextoLocal)
  if (!estado) throw new Error('useLocal precisa estar dentro de <ProvedorApp>.')
  return estado
}
