import { beforeEach, describe, expect, it } from 'vitest'
import { ErroApi } from '../erros'
import type { Estoque } from '../tipos'
import { criarClienteMock, type ClienteMock } from './cliente-mock'
import { SENHA_MOCK } from './semente'

// Relógio fixo: "hoje" do protótipo (22/10/2026, 16:00 em Brasília).
const INICIO = new Date('2026-10-22T16:00:00-03:00')

let agora: Date
let token: string | null
let api: ClienteMock

const conservacao = (e: Estoque) => e.livre + e.reservado + e.retirado + e.ajustado + e.perda

async function entrarComo(email: string) {
  token = (await api.acesso.entrar({ email, senha: SENHA_MOCK })).token
}

beforeEach(() => {
  agora = INICIO
  token = null
  api = criarClienteMock({ obterToken: () => token, agora: () => agora })
})

async function erroDe(promessa: Promise<unknown>): Promise<ErroApi> {
  const e = await promessa.then(
    () => { throw new Error('esperava erro') },
    (e: unknown) => e,
  )
  expect(e).toBeInstanceOf(ErroApi)
  return e as ErroApi
}

describe('mock · reservar devolve os 3 resultados no formato do contrato', () => {
  beforeEach(() => entrarComo('ana@email.com'))

  it('confirmada: quantidade == pedido', async () => {
    const r = await api.consumidor.reservar(1, 2) // iogurte: livre 6

    expect(r.status).toBe('confirmada')
    if (r.status === 'recusada') return
    expect(r.reserva).toEqual({
      id: expect.any(Number),
      estado: 'reservada',
      quantidade: 2,
      pedido: 2,
      codigo: expect.stringMatching(/^\d{6}$/),
      criada_em: '2026-10-22T16:00:00-03:00',
      expira_em: '2026-10-22T20:00:00-03:00', // agora + janela de 4 h
      encerrada_em: null,
      total: '6.28',
      economia: '2.70',
      oferta: {
        id: 1,
        produto: { nome: 'Iogurte natural 170 g', categoria: 'laticinios' },
        preco: '3.14',
        preco_original: '4.49',
        fita: { cor: 'branco', bimestre: 'set–out', ano: 2026 }, // validade 28/10
        loja: { id: 1, nome: 'Mercadinho Vila Nova', endereco: 'Rua das Palmeiras, 410 · Boa Vista' },
      },
    })
    expect((await api.consumidor.obterOferta(1)).livre).toBe(4)
  })

  it('parcial: pede 3 com livre 2 → reserva 2, e é sucesso', async () => {
    const r = await api.consumidor.reservar(4, 3) // molho de tomate: livre 2

    expect(r.status).toBe('parcial')
    if (r.status === 'recusada') return
    expect(r.reserva.pedido).toBe(3)
    expect(r.reserva.quantidade).toBe(2)
    expect((await api.consumidor.obterOferta(4)).livre).toBe(0)
  })

  it('recusada: livre 0 → {status, pedido, erro, codigo}', async () => {
    await api.consumidor.reservar(4, 2) // esgota o molho
    const r = await api.consumidor.reservar(4, 1)

    expect(r).toEqual({ status: 'recusada', pedido: 1, erro: 'Esgotou agora há pouco', codigo: 'esgotada' })
  })

  it('expira_em nunca passa do fim da oferta', async () => {
    agora = new Date('2026-10-23T22:00:00-03:00') // queijo: fim 23/10, 23:59
    const r = await api.consumidor.reservar(5, 1)

    if (r.status === 'recusada') throw new Error('não devia recusar')
    expect(r.reserva.expira_em).toBe('2026-10-23T23:59:00-03:00')
  })
})

describe('mock · estoque', () => {
  beforeEach(() => entrarComo('ana@email.com'))

  it('cancelar devolve ao livre exatamente uma vez e a conservação fecha', async () => {
    const antes = api.estoqueDe(1)
    const r = await api.consumidor.reservar(1, 3)
    if (r.status === 'recusada') throw new Error('não devia recusar')

    const cancelada = await api.consumidor.cancelarReserva(r.reserva.id)
    expect(cancelada.estado).toBe('cancelada')
    expect(cancelada.encerrada_em).toBe('2026-10-22T16:00:00-03:00')

    const segunda = await erroDe(api.consumidor.cancelarReserva(r.reserva.id))
    expect([segunda.status, segunda.codigo]).toEqual([409, 'nao_ativa'])

    const depois = api.estoqueDe(1)
    expect(depois).toEqual(antes)
    expect(conservacao(depois)).toBe(depois.separado)
  })

  it('reserva vencida vira expirada na próxima leitura e devolve ao livre uma vez', async () => {
    agora = new Date('2026-10-22T19:43:00-03:00') // a reserva 31 da Ana vencia 19:42

    const r = await api.consumidor.obterReserva(31)
    expect(r.estado).toBe('expirada')
    expect(r.encerrada_em).toBe(r.expira_em)

    await api.consumidor.obterReserva(31) // ler de novo não devolve em dobro
    const e = api.estoqueDe(1)
    expect(e.livre).toBe(6 + 2 + 1) // + reserva 31 (2) + reserva 32 de Bruno, vencida 16:52 (1)
    expect(conservacao(e)).toBe(e.separado)
  })

  it('todas as ofertas da semente fecham a conservação', () => {
    for (const id of [1, 2, 3, 4, 5, 6]) {
      const e = api.estoqueDe(id)
      expect(conservacao(e), `oferta ${id}`).toBe(e.separado)
    }
  })
})

describe('mock · acesso e permissões', () => {
  it('reservar sem login → 401', async () => {
    const e = await erroDe(api.consumidor.reservar(1, 1))
    expect(e.status).toBe(401)
  })

  it('reserva de outra pessoa → 404', async () => {
    await entrarComo('ana@email.com')
    const e = await erroDe(api.consumidor.obterReserva(32)) // reserva do Bruno
    expect([e.status, e.codigo]).toEqual([404, 'nao_encontrada'])
  })

  it('senha errada → 400 credenciais_invalidas, com a frase no corpo', async () => {
    const e = await erroDe(api.acesso.entrar({ email: 'ana@email.com', senha: 'errada123' }))
    expect([e.status, e.codigo]).toEqual([400, 'credenciais_invalidas'])
    expect(e.corpo).toEqual({ erro: 'E-mail ou senha incorretos.', codigo: 'credenciais_invalidas' })
  })

  it('/eu traz os vínculos: Carlos é responsável da loja 1', async () => {
    await entrarComo('carlos@vilanova.com.br')
    expect(await api.acesso.eu()).toEqual({
      id: 1,
      nome: 'Carlos Lima',
      email: 'carlos@vilanova.com.br',
      vinculos: [{ loja: { id: 1, nome: 'Mercadinho Vila Nova' }, papel: 'responsavel' }],
    })
  })

  it('sair invalida o token', async () => {
    await entrarComo('ana@email.com')
    await api.acesso.sair()
    expect((await erroDe(api.acesso.eu())).status).toBe(401)
  })

  it('criar conta: senha curta → 400 senha_curta; certa → sessão de consumidor', async () => {
    const curta = await erroDe(
      api.acesso.criarConta({ nome: 'Rita', email: 'rita@email.com', senha: '123', aceite_termos: true }),
    )
    expect(curta.codigo).toBe('senha_curta')

    const sessao = await api.acesso.criarConta({
      nome: 'Rita Alves', email: 'rita@email.com', senha: '12345678', aceite_termos: true,
    })
    expect(sessao.usuario.vinculos).toEqual([])
    expect(sessao.token).toEqual(expect.any(String))
  })
})

describe('mock · vitrine', () => {
  it('sem lat/lng: distancia null e ordem pelo fim mais próximo; encerrada não aparece', async () => {
    const lista = await api.consumidor.listarOfertas()
    expect(lista.map((o) => o.id)).toEqual([5, 1, 2, 4, 3])
    expect(lista.every((o) => o.distancia_km === null)).toBe(true)
  })

  it('com lat/lng: ordena por distância', async () => {
    const lista = await api.consumidor.listarOfertas({ lat: -20.81, lng: -49.37 })
    expect(lista.map((o) => o.distancia_km)).toEqual([0.4, 0.4, 0.4, 1.1, 1.8])
  })

  it('filtros: categoria, faixa de desconto e busca sem acento', async () => {
    const laticinios = await api.consumidor.listarOfertas({ categoria: 'laticinios' })
    expect(laticinios.map((o) => o.id).sort()).toEqual([1, 5])

    const ate30 = await api.consumidor.listarOfertas({ faixa_desconto: 'ate30' })
    expect(ate30.map((o) => o.desconto).sort()).toEqual([25, 30])

    const busca = await api.consumidor.listarOfertas({ q: 'QUEIJO MINAS' })
    expect(busca.map((o) => o.id)).toEqual([5])
  })

  it('grupos ainda sem mock avisam a etapa', async () => {
    await expect(api.operacao.resumoDoDia(1)).rejects.toThrow('etapa F6')
  })
})
