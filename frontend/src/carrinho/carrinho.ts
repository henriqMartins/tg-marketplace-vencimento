/*
 * Carrinho do pedido (docs/pedido.md, versão B): fica SÓ no aparelho (localStorage) e não
 * segura estoque. Nada é reservado antes de "Confirmar pedido nesta loja" (POST /api/pedidos).
 *
 * Uma lista por conta logada (`tg.carrinho.<id>`) e uma do visitante. Ao entrar, a do
 * visitante passa para a conta; ao sair, a da conta some da tela (fica guardada para a volta).
 */
import type { Dinheiro } from '../api'

export interface ItemCarrinho {
  ofertaId: number
  lojaId: number
  /** Cópia de quando foi adicionado, para mostrar sem esperar a API. O preço oficial vem dela. */
  lojaNome: string
  produto: string
  preco: Dinheiro
  /** Quantidade pedida (a API pode reservar menos: parcial). */
  pedido: number
}

export const CHAVE_VISITANTE = 'tg.carrinho.visitante'
export const chaveDaConta = (usuarioId: number) => `tg.carrinho.${usuarioId}`

const ehItem = (x: unknown): x is ItemCarrinho => {
  const i = x as ItemCarrinho
  return (
    typeof i === 'object' && i !== null &&
    Number.isInteger(i.ofertaId) && Number.isInteger(i.lojaId) && Number.isInteger(i.pedido) && i.pedido >= 1 &&
    typeof i.lojaNome === 'string' && typeof i.produto === 'string' && typeof i.preco === 'string'
  )
}

/** Lê o texto guardado; qualquer coisa estranha vira lista vazia (ou some só o item ruim). */
export function lerTexto(texto: string | null): ItemCarrinho[] {
  if (!texto) return []
  try {
    const valor: unknown = JSON.parse(texto)
    return Array.isArray(valor) ? valor.filter(ehItem) : []
  } catch {
    return []
  }
}

/** Adiciona, ou troca a quantidade se a oferta já está no carrinho ("Atualizar no pedido"). */
export function colocar(itens: ItemCarrinho[], novo: ItemCarrinho): ItemCarrinho[] {
  return itens.some((i) => i.ofertaId === novo.ofertaId)
    ? itens.map((i) => (i.ofertaId === novo.ofertaId ? novo : i))
    : [...itens, novo]
}

export function alterar(itens: ItemCarrinho[], ofertaId: number, pedido: number): ItemCarrinho[] {
  return itens.map((i) => (i.ofertaId === ofertaId ? { ...i, pedido: Math.max(1, pedido) } : i))
}

export function tirar(itens: ItemCarrinho[], ofertaIds: readonly number[]): ItemCarrinho[] {
  return itens.filter((i) => !ofertaIds.includes(i.ofertaId))
}

/**
 * Carrinho do visitante entrando na conta: junta os dois. A mesma oferta nos dois fica
 * com a quantidade MAIOR (quem montou duas vezes não quer o dobro, quer o que escolheu).
 */
export function juntar(daConta: ItemCarrinho[], doVisitante: ItemCarrinho[]): ItemCarrinho[] {
  return doVisitante.reduce((lista, v) => {
    const igual = lista.find((i) => i.ofertaId === v.ofertaId)
    return igual ? alterar(lista, v.ofertaId, Math.max(igual.pedido, v.pedido)) : [...lista, v]
  }, daConta)
}

export interface GrupoLoja {
  lojaId: number
  lojaNome: string
  itens: ItemCarrinho[]
}

/** Um grupo por loja (um pedido = uma loja), na ordem em que cada loja entrou no carrinho. */
export function agruparPorLoja(itens: ItemCarrinho[]): GrupoLoja[] {
  const grupos: GrupoLoja[] = []
  for (const item of itens) {
    const grupo = grupos.find((g) => g.lojaId === item.lojaId)
    if (grupo) grupo.itens.push(item)
    else grupos.push({ lojaId: item.lojaId, lojaNome: item.lojaNome, itens: [item] })
  }
  return grupos
}
