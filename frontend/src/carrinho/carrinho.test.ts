import { describe, expect, it } from 'vitest'
import { agruparPorLoja, alterar, colocar, juntar, lerTexto, tirar, type ItemCarrinho } from './carrinho'

const item = (ofertaId: number, lojaId: number, pedido = 1): ItemCarrinho => ({
  ofertaId, lojaId, lojaNome: `Loja ${lojaId}`, produto: `Produto ${ofertaId}`, preco: '1.00', pedido,
})

describe('carrinho (funções puras)', () => {
  it('colocar adiciona; a mesma oferta troca a quantidade em vez de repetir', () => {
    const lista = colocar(colocar([], item(1, 1, 2)), item(2, 1))
    expect(colocar(lista, item(1, 1, 5)).map((i) => [i.ofertaId, i.pedido])).toEqual([[1, 5], [2, 1]])
  })

  it('alterar nunca deixa abaixo de 1; tirar remove várias', () => {
    const lista = [item(1, 1, 2), item(2, 1), item(3, 2)]
    expect(alterar(lista, 1, 0)[0].pedido).toBe(1)
    expect(tirar(lista, [1, 3]).map((i) => i.ofertaId)).toEqual([2])
  })

  it('juntar (visitante → conta): fica a quantidade MAIOR; os novos entram no fim', () => {
    const daConta = [item(1, 1, 1), item(2, 1, 4)]
    const doVisitante = [item(2, 1, 2), item(1, 1, 3), item(9, 2)]
    expect(juntar(daConta, doVisitante).map((i) => [i.ofertaId, i.pedido])).toEqual([[1, 3], [2, 4], [9, 1]])
  })

  it('agrupa por loja na ordem em que cada loja entrou', () => {
    const grupos = agruparPorLoja([item(1, 2), item(2, 1), item(3, 2)])
    expect(grupos.map((g) => [g.lojaId, g.itens.map((i) => i.ofertaId)])).toEqual([[2, [1, 3]], [1, [2]]])
  })

  it('lerTexto tolera lixo: texto quebrado vira vazio; item inválido é descartado', () => {
    expect(lerTexto(null)).toEqual([])
    expect(lerTexto('{quebrado')).toEqual([])
    expect(lerTexto(JSON.stringify([item(1, 1), { ofertaId: 2, pedido: 0 }]))).toEqual([item(1, 1)])
  })
})
