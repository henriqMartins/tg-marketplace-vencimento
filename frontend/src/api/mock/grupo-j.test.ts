import { beforeEach, describe, expect, it } from 'vitest'
import { ErroApi } from '../erros'
import type { Estoque } from '../tipos'
import { criarClienteMock, type ClienteMock } from './cliente-mock'
import { SENHA_MOCK } from './semente'

// Relógio fixo: "hoje" do protótipo (22/10/2026, 16:00 em Brasília). Janela das ofertas: 4 h.
const INICIO = new Date('2026-10-22T16:00:00-03:00')
const ANA = 'ana@email.com'
const JULIANA = 'juliana.prado@email.com' // funcionária do Mercadinho Vila Nova (loja 1)

let agora: Date
let token: string | null
let api: ClienteMock

const conservacao = (e: Estoque) => e.livre + e.reservado + e.retirado + e.ajustado + e.perda

async function entrarComo(email: string) {
  token = (await api.acesso.entrar({ email, senha: SENHA_MOCK })).token
}

async function erroDe(promessa: Promise<unknown>): Promise<ErroApi> {
  const e = await promessa.then(
    () => { throw new Error('esperava erro') },
    (e: unknown) => e,
  )
  expect(e).toBeInstanceOf(ErroApi)
  return e as ErroApi
}

/** Loja 1: iogurte (id 1, livre 6), presunto (2, livre 5), queijo (5, livre 3), requeijão (6, encerrada). */
async function confirmar(itens: [ofertaId: number, pedido: number][], loja_id = 1) {
  const r = await api.pedidos.confirmar({ loja_id, itens: itens.map(([oferta_id, pedido]) => ({ oferta_id, pedido })) })
  if (r.status !== 'criado') throw new Error('esperava pedido criado')
  return r.pedido
}

beforeEach(async () => {
  agora = INICIO
  token = null
  api = criarClienteMock({ obterToken: () => token, agora: () => agora })
  await entrarComo(ANA)
})

describe('mock · confirmar o pedido (POST /api/pedidos)', () => {
  it('3 itens todos confirmados: um código, total e prazo do pedido', async () => {
    const pedido = await confirmar([[1, 2], [2, 1], [5, 1]])
    expect(pedido).toMatchObject({
      codigo: expect.stringMatching(/^\d{6}$/),
      loja: { id: 1, nome: 'Mercadinho Vila Nova' },
      estado: 'ativo',
      criado_em: '2026-10-22T16:00:00-03:00',
      expira_em_proximo: '2026-10-22T20:00:00-03:00',
      total: '19.41', // 6.28 + 4.74 + 8.39
    })
    expect(pedido.itens.map((i) => [i.oferta_id, i.status, i.quantidade, i.subtotal])).toEqual([
      [1, 'confirmada', 2, '6.28'],
      [2, 'confirmada', 1, '4.74'],
      [5, 'confirmada', 1, '8.39'],
    ])
    // Cada item é uma reserva com o código do pedido; a vitrine já desconta.
    const reserva = await api.consumidor.obterReserva(pedido.itens[0].reserva_id!)
    expect([reserva.codigo, reserva.pedido_id]).toEqual([pedido.codigo, pedido.id])
    expect((await api.consumidor.obterOferta(2)).livre).toBe(4)
  })

  it('misto (201): parcial e recusada vêm por item, na ordem enviada; o total conta só o reservado', async () => {
    const pedido = await confirmar([[6, 1], [5, 5], [1, 2]])
    expect(pedido.itens.map((i) => [i.oferta_id, i.status, i.motivo, i.pedido, i.quantidade, i.estado])).toEqual([
      [6, 'recusada', 'oferta_encerrada', 1, 0, null],
      [5, 'parcial', null, 5, 3, 'reservada'],
      [1, 'confirmada', null, 2, 2, 'reservada'],
    ])
    expect(pedido.itens[0]).toMatchObject({ reserva_id: null, subtotal: '0.00', expira_em: null })
    expect(pedido.total).toBe('31.45') // 3 × 8.39 + 2 × 3.14
    // Fora do POST, os itens são só as reservas (o recusado não virou reserva).
    expect((await api.pedidos.obter(pedido.id)).itens.map((i) => i.oferta_id)).toEqual([5, 1])
  })

  it('nada sobrou: 409 tudo_esgotado vira resultado, sem código e sem reserva', async () => {
    await confirmar([[5, 3]]) // queijo: livre 3 → 0
    const r = await api.pedidos.confirmar({ loja_id: 1, itens: [{ oferta_id: 5, pedido: 1 }, { oferta_id: 6, pedido: 2 }] })
    expect(r).toEqual({
      status: 'tudo_esgotado',
      erro: 'Esgotou tudo agora há pouco.',
      itens: [
        expect.objectContaining({ oferta_id: 5, status: 'recusada', motivo: 'esgotada', quantidade: 0 }),
        expect.objectContaining({ oferta_id: 6, status: 'recusada', motivo: 'oferta_encerrada' }),
      ],
    })
    expect(await api.pedidos.listar('ativo')).toHaveLength(2) // a reserva da semente + o pedido do queijo
  })

  it('erros de entrada, na ordem do backend', async () => {
    const tentar = (corpo: unknown) => erroDe(api.pedidos.confirmar(corpo as never)).then((e) => [e.status, e.codigo])
    expect(await tentar({ loja_id: 1, itens: [] })).toEqual([400, 'itens_vazios'])
    expect(await tentar({ loja_id: 1, itens: [{ oferta_id: 1, pedido: 0 }] })).toEqual([400, 'pedido_invalido'])
    expect(await tentar({ loja_id: 1, itens: [{ oferta_id: 1, pedido: 1 }, { oferta_id: 1, pedido: 2 }] })).toEqual([400, 'item_repetido'])
    expect(await tentar({ loja_id: 1, itens: [{ oferta_id: 3, pedido: 1 }] })).toEqual([400, 'oferta_de_outra_loja']) // biscoito é da loja 2
    expect(await tentar({ loja_id: 1, itens: [{ oferta_id: 999, pedido: 1 }] })).toEqual([400, 'oferta_de_outra_loja'])
    token = null
    expect(await tentar({ loja_id: 1, itens: [{ oferta_id: 1, pedido: 1 }] })).toEqual([401, 'http_401'])
  })

  it('reservar uma oferta só (rota antiga) cria um pedido de 1 item', async () => {
    const r = await api.consumidor.reservar(2, 1)
    if (r.status === 'recusada') throw new Error('esperava reserva')
    const pedido = await api.pedidos.obter(r.reserva.pedido_id)
    expect([pedido.codigo, pedido.itens.length, pedido.total]).toEqual([r.reserva.codigo, 1, '4.74'])
  })
})

describe('mock · ver, listar e cancelar', () => {
  it('lista os ativos (prazo mais próximo primeiro) e depois os encerrados; estado inválido → 400', async () => {
    const lista = await api.pedidos.listar()
    expect(lista.map((p) => [p.codigo, p.estado])).toEqual([
      ['482917', 'ativo'], // semente: reserva 31 da Ana
      ['118340', 'retirado'],
      ['640921', 'encerrado'],
      ['993021', 'encerrado'],
    ])
    expect(lista[2].total).toBe('0.00')
    expect((await erroDe(api.pedidos.listar('ativa' as never))).codigo).toBe('parametro_invalido')
  })

  it('pedido de outra pessoa → 404', async () => {
    const pedido = await confirmar([[1, 1]])
    await entrarComo(JULIANA)
    expect((await erroDe(api.pedidos.obter(pedido.id))).codigo).toBe('nao_encontrado')
  })

  it('cancelar um item devolve só ele; o código segue para o resto', async () => {
    const pedido = await confirmar([[1, 2], [2, 1]])
    const depois = await api.pedidos.cancelarItem(pedido.id, pedido.itens[1].reserva_id!)
    expect(depois).toMatchObject({ estado: 'ativo', codigo: pedido.codigo, total: '6.28' })
    expect(depois.itens.map((i) => i.estado)).toEqual(['reservada', 'cancelada'])
    expect(api.estoqueDe(2)).toMatchObject({ livre: 5, reservado: 2 })
    expect((await erroDe(api.pedidos.cancelarItem(pedido.id, pedido.itens[1].reserva_id!))).codigo).toBe('ja_encerrado')
    expect((await erroDe(api.pedidos.cancelarItem(pedido.id, 31))).status).toBe(404) // item de outro pedido
  })

  it('cancelar o pedido cancela os ativos; de novo → 409 nada_ativo', async () => {
    const pedido = await confirmar([[1, 2], [2, 1]])
    expect((await api.pedidos.cancelar(pedido.id)).estado).toBe('encerrado')
    expect(api.estoqueDe(1)).toMatchObject({ livre: 6, reservado: 4 })
    expect((await erroDe(api.pedidos.cancelar(pedido.id))).codigo).toBe('nada_ativo')
  })

  it('vencido: os itens expiram e o pedido fica encerrado, sem prazo', async () => {
    const pedido = await confirmar([[1, 1]])
    agora = new Date('2026-10-22T20:01:00-03:00')
    expect(await api.pedidos.obter(pedido.id)).toMatchObject({ estado: 'encerrado', expira_em_proximo: null, total: '0.00' })
  })
})

describe('mock · balcão (L12 → L13): o código é do pedido', () => {
  it('prévia lista os itens ativos; a retirada leva todos e conserva cada estoque', async () => {
    const pedido = await confirmar([[1, 2], [2, 1], [5, 1]])
    await api.pedidos.cancelarItem(pedido.id, pedido.itens[2].reserva_id!) // desistiu do queijo
    await entrarComo(JULIANA)

    const previa = await api.pedidos.previaNoBalcao(1, pedido.codigo)
    expect(previa).toMatchObject({ pedido_id: pedido.id, codigo: pedido.codigo, cliente: 'Ana S.', total: '11.02' })
    expect(previa.itens.map((i) => [i.produto, i.reserva.quantidade, i.total, i.fita.cor])).toEqual([
      ['Iogurte natural 170 g', 2, '6.28', 'branco'],
      ['Presunto fatiado 200 g', 1, '4.74', 'branco'],
    ])

    const feita = await api.operacao.retirar(1, pedido.codigo)
    expect(feita).toMatchObject({ codigo: pedido.codigo, cliente: 'Ana S.', total: '11.02', retirada_por: 'Juliana Prado' })
    expect(feita.itens.map((i) => i.produto)).toEqual(['Iogurte natural 170 g', 'Presunto fatiado 200 g'])
    for (const item of feita.itens) expect(conservacao(item.oferta.estoque)).toBe(item.oferta.estoque.separado)
    expect(feita.reserva).toEqual(feita.itens[0].reserva) // campos antigos: do 1º item
    expect((await erroDe(api.operacao.retirar(1, pedido.codigo))).codigo).toBe('nao_encontrada')

    await entrarComo(ANA)
    expect(await api.pedidos.obter(pedido.id)).toMatchObject({ estado: 'retirado', total: '11.02' })
  })

  it('código inexistente → 404 nao_encontrado; vencido → 409 venceu; sem vínculo → 403', async () => {
    const pedido = await confirmar([[1, 1]])
    expect((await erroDe(api.pedidos.previaNoBalcao(1, pedido.codigo))).status).toBe(403) // a Ana não é da loja
    await entrarComo(JULIANA)
    expect((await erroDe(api.pedidos.previaNoBalcao(1, '000000'))).codigo).toBe('nao_encontrado')
    agora = new Date('2026-10-22T20:01:00-03:00')
    expect((await erroDe(api.pedidos.previaNoBalcao(1, pedido.codigo))).codigo).toBe('venceu')
  })
})
