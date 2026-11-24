import { createContext, useContext } from 'react'
import type { ItemCarrinho } from './carrinho'

export interface Carrinho {
  itens: ItemCarrinho[]
  /** O item desta oferta, se já está no carrinho (a C4 vira "Atualizar no pedido"). */
  itemDa(ofertaId: number): ItemCarrinho | undefined
  colocar(item: ItemCarrinho): void
  alterar(ofertaId: number, pedido: number): void
  tirar(...ofertaIds: number[]): void
}

export const ContextoCarrinho = createContext<Carrinho | null>(null)

export function useCarrinho(): Carrinho {
  const carrinho = useContext(ContextoCarrinho)
  if (!carrinho) throw new Error('useCarrinho precisa estar dentro de <ProvedorApp>.')
  return carrinho
}
