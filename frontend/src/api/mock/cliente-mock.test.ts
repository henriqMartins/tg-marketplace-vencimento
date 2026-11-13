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
    expect(e.corpo).toEqual({ erro: 'E-mail ou senha incorretos. Confira e tente de novo.', codigo: 'credenciais_invalidas' })
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
    await expect(api.lotes.listarProdutos(1)).rejects.toThrow('etapa F8')
  })
})

describe('mock · gestor (grupo F)', () => {
  const OUTUBRO = ['2026-10-01', '2026-10-22'] as const

  it('só o responsável: a funcionária recebe 403', async () => {
    await entrarComo('juliana.prado@email.com')
    expect((await erroDe(api.gestor.indicadores(1, ...OUTUBRO))).status).toBe(403)
    expect((await erroDe(api.gestor.historico(1))).status).toBe(403)
  })

  it('indicadores fecham entre si (encerradas, taxas, bloqueados, semanas)', async () => {
    await entrarComo('carlos@vilanova.com.br')
    const i = await api.gestor.indicadores(1, ...OUTUBRO)
    const { total, retiradas, expiradas, canceladas } = i.encerradas
    expect(i.reservas_criadas).toBeGreaterThan(50) // histórico gerado, não só a semente
    expect(retiradas + expiradas + canceladas).toBe(total)
    expect(i.taxa_retirada).toBeCloseTo(retiradas / total, 3)
    expect(i.taxa_expiracao).toBeCloseTo(expiradas / total, 3)
    expect(i.bloqueados.total).toBe(i.bloqueados.recusas + i.bloqueados.parciais)
    expect(i.bloqueados.recusas).toBeGreaterThan(0)
    expect(i.bloqueados.parciais).toBeGreaterThan(0)
    expect(i.perda_unidades).toBeGreaterThan(0)
    expect(i.semanas[0].inicio).toBe('2026-09-28') // segunda-feira da semana de 01/10
    const nasSemanas = i.semanas.reduce((s, x) => s + x.retiradas + x.expiradas + x.canceladas, 0)
    expect(nasSemanas).toBe(total)
  })

  it('período sem reserva: taxas null (base zero), não 0', async () => {
    await entrarComo('carlos@vilanova.com.br')
    const i = await api.gestor.indicadores(1, '2025-01-01', '2025-01-31')
    expect(i.encerradas.total).toBe(0)
    expect(i.taxa_retirada).toBeNull()
    expect(i.taxa_expiracao).toBeNull()
  })

  it('o histórico gerado é determinístico e conserva o estoque das ofertas', async () => {
    await entrarComo('carlos@vilanova.com.br')
    let tokenOutra: string | null = null
    const outra = criarClienteMock({ obterToken: () => tokenOutra, agora: () => agora })
    tokenOutra = (await outra.acesso.entrar({ email: 'carlos@vilanova.com.br', senha: SENHA_MOCK })).token
    expect(await outra.gestor.indicadores(1, ...OUTUBRO)).toEqual(await api.gestor.indicadores(1, ...OUTUBRO))
    for (const id of [50, 55, 61]) {
      const e = api.estoqueDe(id)
      expect(conservacao(e)).toBe(e.separado)
    }
  })

  it('histórico: totais batem com os indicadores; filtros por estado e busca', async () => {
    await entrarComo('carlos@vilanova.com.br')
    const filtroPeriodo = { de: OUTUBRO[0], ate: OUTUBRO[1] }
    const i = await api.gestor.indicadores(1, ...OUTUBRO)
    const h = await api.gestor.historico(1, filtroPeriodo)
    expect(h.total_reservas).toBe(i.reservas_criadas)
    expect(h.total_recusas).toBe(i.bloqueados.recusas)
    expect(h.itens).toHaveLength(h.total_reservas + h.total_recusas)
    expect(h.itens[0].criada_em >= h.itens.at(-1)!.criada_em).toBe(true) // mais recente primeiro

    const recusas = await api.gestor.historico(1, { ...filtroPeriodo, estado: 'recusa' })
    expect(recusas.itens.every((x) => x.tipo === 'recusa' && x.quantidade === 0 && x.codigo_final === null)).toBe(true)
    expect(recusas.total_recusas).toBe(h.total_recusas) // totais não mudam com o filtro

    const porCodigo = await api.gestor.historico(1, { q: '917' })
    expect(porCodigo.itens.map((x) => x.codigo_final)).toContain('917')
    expect(porCodigo.itens.every((x) => x.codigo_final?.endsWith('917') || x.produto.includes('917'))).toBe(true)

    const porProduto = await api.gestor.historico(1, { q: 'requeijao' }) // sem acento também acha
    expect(porProduto.itens.length).toBeGreaterThan(0)
    expect(porProduto.itens.every((x) => x.produto.startsWith('Requeijão'))).toBe(true)
  })

  it('uma recusa feita agora aparece no histórico com o nome curto do cliente', async () => {
    await entrarComo('ana@email.com')
    await api.consumidor.reservar(5, 3) // queijo: 3 livres
    await api.consumidor.reservar(5, 1) // agora 0 → recusa
    await entrarComo('carlos@vilanova.com.br')
    const h = await api.gestor.historico(1, { estado: 'recusa', q: 'queijo minas' })
    expect(h.itens[0]).toMatchObject({ tipo: 'recusa', cliente: 'Ana S.', pedido: 1, quantidade: 0, encerrada_em: null })
  })
})

describe('mock · estado guardado entre recargas', () => {
  it('outra instância com o mesmo armazenamento continua de onde parou (login e estoque)', async () => {
    const guarda = new Map<string, string>()
    const persistencia = {
      getItem: (k: string) => guarda.get(k) ?? null,
      setItem: (k: string, v: string) => void guarda.set(k, v),
      removeItem: (k: string) => void guarda.delete(k),
    }
    const primeira = criarClienteMock({ obterToken: () => token, agora: () => agora, persistencia })
    token = (await primeira.acesso.entrar({ email: 'ana@email.com', senha: SENHA_MOCK })).token
    await primeira.consumidor.reservar(1, 2)

    // "recarregou a página"
    const segunda = criarClienteMock({ obterToken: () => token, agora: () => agora, persistencia })
    expect((await segunda.acesso.eu()).nome).toBe('Ana Souza')
    expect(segunda.estoqueDe(1).livre).toBe(4)
    const ativas = await segunda.consumidor.minhasReservas('ativa')
    expect(ativas.map((r) => r.expira_em)).toContain('2026-10-22T20:00:00-03:00') // datas voltam como datas

    segunda.reiniciar()
    expect(criarClienteMock({ obterToken: () => token, agora: () => agora, persistencia }).estoqueDe(1).livre).toBe(6)
  })
})

describe('mock · grupo C (operação da loja)', () => {
  beforeEach(() => entrarComo('juliana.prado@email.com')) // funcionária da loja 1

  it('resumo do dia conta reservas (PEDIDO-API 2): 4 aguardando, 2 expiram em 1 h, 3 ofertas ativas', async () => {
    expect(await api.operacao.resumoDoDia(1)).toEqual({
      loja: { id: 1, nome: 'Mercadinho Vila Nova', endereco: 'Rua das Palmeiras, 410 · Boa Vista' },
      papel: 'funcionario',
      aguardando_retirada: 4,
      expiram_em_1h: 2,
      ofertas_ativas: 3,
      avisos_para_conferir: 5,
    })
  })

  it('sem vínculo com a loja → 403', async () => {
    await entrarComo('ana@email.com')
    expect((await erroDe(api.operacao.resumoDoDia(1))).status).toBe(403)
    await entrarComo('juliana.prado@email.com')
    expect((await erroDe(api.operacao.resumoDoDia(2))).status).toBe(403)
  })

  it('detalhe da oferta: código mascarado para a loja (só o final)', async () => {
    const oferta = await api.operacao.obterOferta(1, 1)
    expect(oferta.reservas.map((r) => r.codigo_final)).toEqual(['118', '917', '204']) // 32 (16:52), 31, 33
    expect(oferta.reservas[1]).not.toHaveProperty('codigo')
    expect(oferta.estoque).toEqual({ separado: 12, livre: 6, reservado: 4, retirado: 2, ajustado: 0, perda: 0 })
  })

  it('ajuste: só tira do livre; acima do livre → 409 com o livre no corpo', async () => {
    const e = await erroDe(api.operacao.ajustar(1, 1, { quantidade: 7, motivo: 'Danificada' }))
    expect([e.status, e.codigo]).toEqual([409, 'acima_do_livre'])
    expect(e.corpo).toMatchObject({ livre: 6 })

    const { estoque } = await api.operacao.ajustar(1, 1, { quantidade: 2, motivo: 'Danificada' })
    expect(estoque).toMatchObject({ livre: 4, ajustado: 2, reservado: 4 })
    expect(conservacao(estoque)).toBe(estoque.separado)
    expect((await erroDe(api.operacao.ajustar(1, 1, { quantidade: 1, motivo: ' ' }))).codigo).toBe('sem_motivo')
  })

  it('retirada por loja + código: prévia, confirmação e estoque conservado', async () => {
    const previa = await api.operacao.previaRetirada(1, '482917')
    expect(previa).toMatchObject({ codigo: '482917', total: '6.28', produto: 'Iogurte natural 170 g', fita: { cor: 'branco' } })
    expect(previa.reserva).toMatchObject({ cliente: 'Ana S.', quantidade: 2, codigo_final: '917' })

    const feita = await api.operacao.retirar(1, '482917')
    expect(feita.retirada_por).toBe('Juliana Prado')
    expect(feita.oferta.estoque).toMatchObject({ livre: 6, reservado: 2, retirado: 4 })
    expect(conservacao(feita.oferta.estoque)).toBe(feita.oferta.estoque.separado)
    // retirada não se repete
    expect((await erroDe(api.operacao.retirar(1, '482917'))).codigo).toBe('nao_encontrada')
  })

  it('código de outra loja ou inexistente → 404; vencido agora há pouco → 409 venceu', async () => {
    expect((await erroDe(api.operacao.previaRetirada(1, '208455'))).status).toBe(404) // reserva da loja 3
    expect((await erroDe(api.operacao.previaRetirada(1, '000000'))).codigo).toBe('nao_encontrada')

    agora = new Date('2026-10-22T19:45:00-03:00') // a 31 venceu às 19:42
    expect((await erroDe(api.operacao.retirar(1, '482917'))).codigo).toBe('venceu')
    // Como no backend: a prévia também responde "venceu", por até 24 h depois do prazo.
    const previa = await erroDe(api.operacao.previaRetirada(1, '482917'))
    expect([previa.status, previa.codigo, previa.message]).toEqual([409, 'venceu', 'Esta reserva venceu: o prazo de retirada acabou.'])
    agora = new Date('2026-10-23T19:43:00-03:00') // 24 h e 1 min depois
    expect((await erroDe(api.operacao.previaRetirada(1, '482917'))).codigo).toBe('nao_encontrada')
    expect((await erroDe(api.operacao.previaRetirada(1, '48291'))).codigo).toBe('nao_encontrada') // fora do formato
  })
})

describe('mock · projeção (grupo G)', () => {
  /** Tabela 5 do artigo: janela, perda (% do lote), bloqueados (% dos compradores), retirada (%). */
  const TABELA_5 = [
    [0.5, 92.6, 0.6, 4.6],
    [1, 74.2, 1.3, 16.1],
    [2, 48.4, 5.4, 34.7],
    [4, 31.3, 13.8, 53.3],
    [8, 24.9, 19.5, 64.5],
    [12, 23.7, 21.2, 67.4],
    [24, 24.4, 21.8, 67.4],
  ]

  it('sem filtro e chegada 2 h = exatamente a Tabela 5, com 5.000 rodadas', async () => {
    await entrarComo('carlos@vilanova.com.br')
    const p = await api.projecao.projecao(1)
    expect(p.rodadas).toBe(5000)
    expect(p.filtro).toEqual({ lote: null, procura: null, chegada: 2 })
    expect(p.janelas.map((j) => [j.janela_horas, j.perda_pct, j.bloqueados_pct, j.retirada_pct])).toEqual(TABELA_5)
  })

  it('com filtro: menos rodadas, números diferentes; as faixas somam as 5.000', async () => {
    await entrarComo('carlos@vilanova.com.br')
    const pequenos = await api.projecao.projecao(1, { lote: '5-14' })
    expect(pequenos.rodadas).toBeGreaterThan(0)
    expect(pequenos.rodadas).toBeLessThan(5000)
    expect(pequenos.filtro).toEqual({ lote: '5-14', procura: null, chegada: 2 })
    expect(pequenos.janelas[3].perda_pct).not.toBe(31.3)

    let soma = 0
    for (const lote of ['5-14', '15-24', '25-34', '35-44', '45-60'] as const) {
      soma += (await api.projecao.projecao(1, { lote })).rodadas
    }
    expect(soma).toBe(5000)
    const celula = await api.projecao.projecao(1, { lote: '25-34', procura: '0.8-1.3' })
    expect(celula.rodadas).toBeLessThan((await api.projecao.projecao(1, { lote: '25-34' })).rodadas)
  })

  it('chegada 1 ou 4 h: só com a API real; funcionária: 403', async () => {
    await entrarComo('carlos@vilanova.com.br')
    const e = await erroDe(api.projecao.projecao(1, { chegada: 4 }))
    expect(e.codigo).toBe('chegada_so_na_api')
    expect(e.message).toBe('Projeção com chegada de 4 h disponível só com a API real.')
    await entrarComo('juliana.prado@email.com')
    expect((await erroDe(api.projecao.projecao(1))).status).toBe(403)
  })
})

describe('mock · configuração da loja (grupo E)', () => {
  it('leitura com qualquer vínculo; escrita só do responsável (403)', async () => {
    await entrarComo('juliana.prado@email.com')
    expect((await api.configuracao.obterLoja(1)).janela_padrao_horas).toBe(4)
    expect((await api.configuracao.listarVinculos(1)).map((v) => v.usuario.nome)).toEqual(['Carlos Lima', 'Juliana Prado'])
    expect((await erroDe(api.configuracao.atualizarLoja(1, { nome: 'X' }))).status).toBe(403)
    expect((await erroDe(api.configuracao.criarVinculo(1, { email: 'ana@email.com', papel: 'funcionario' }))).status).toBe(403)
  })

  it('PATCH parcial; um campo errado e nada é gravado', async () => {
    await entrarComo('carlos@vilanova.com.br')
    const nova = await api.configuracao.atualizarLoja(1, { nome: '  Vila Nova Express ', janela_padrao_horas: 8 })
    expect(nova).toMatchObject({ nome: 'Vila Nova Express', janela_padrao_horas: 8, margem_fim_dias: 1 })
    // O nome novo aparece também no vínculo de quem está logado.
    expect((await api.acesso.eu()).vinculos[0]).toEqual({ loja: { id: 1, nome: 'Vila Nova Express' }, papel: 'responsavel' })

    const e = await erroDe(api.configuracao.atualizarLoja(1, { nome: 'Outro nome', janela_padrao_horas: 3 }))
    expect([e.status, e.codigo]).toEqual([400, 'janela_invalida'])
    expect((await api.configuracao.obterLoja(1)).nome).toBe('Vila Nova Express') // nada mudou
  })

  it('antecedência precisa ser maior que a margem (no par final); limites de cada campo', async () => {
    await entrarComo('carlos@vilanova.com.br')
    const codigo = async (campos: object) => (await erroDe(api.configuracao.atualizarLoja(1, campos))).codigo
    expect(await codigo({ antecedencia_aviso_dias: 1 })).toBe('antecedencia_menor_que_margem') // margem é 1
    expect(await codigo({ margem_fim_dias: 7, antecedencia_aviso_dias: 7 })).toBe('antecedencia_menor_que_margem')
    expect(await codigo({ antecedencia_aviso_dias: 31 })).toBe('antecedencia_invalida')
    expect(await codigo({ margem_fim_dias: 8 })).toBe('margem_invalida')
    expect(await codigo({ nome: '   ' })).toBe('sem_nome')
    expect(await codigo({ latitude: -20.8 })).toBe('coordenadas_incompletas')
    expect(await codigo({ latitude: 95, longitude: 0 })).toBe('coordenadas_invalidas')
    const semCoordenada = await api.configuracao.atualizarLoja(1, { latitude: null, longitude: null })
    expect([semCoordenada.latitude, semCoordenada.longitude]).toEqual([null, null])
    expect((await api.configuracao.atualizarLoja(1, { margem_fim_dias: 0, antecedencia_aviso_dias: 1 })).margem_fim_dias).toBe(0)
  })

  it('equipe: adicionar pelo e-mail da conta (404, 409) e remover (409 próprio)', async () => {
    await entrarComo('carlos@vilanova.com.br')
    const codigoAo = async (p: Promise<unknown>) => {
      const e = await erroDe(p)
      return [e.status, e.codigo]
    }
    expect(await codigoAo(api.configuracao.criarVinculo(1, { email: 'ninguem@email.com', papel: 'funcionario' }))).toEqual([
      404,
      'conta_nao_existe',
    ])
    expect(await codigoAo(api.configuracao.criarVinculo(1, { email: 'Juliana.Prado@email.com', papel: 'funcionario' }))).toEqual([
      409,
      'ja_vinculado',
    ])
    expect(await codigoAo(api.configuracao.criarVinculo(1, { email: 'ana@', papel: 'funcionario' }))).toEqual([400, 'email_invalido'])

    const ana = await api.configuracao.criarVinculo(1, { email: 'ANA@email.com', papel: 'funcionario' })
    expect(ana).toMatchObject({ usuario: { nome: 'Ana Souza', email: 'ana@email.com' }, papel: 'funcionario', eu: false })

    const eu = (await api.configuracao.listarVinculos(1)).find((v) => v.eu)!
    expect(await codigoAo(api.configuracao.removerVinculo(1, eu.id))).toEqual([409, 'proprio_vinculo'])
    expect(await codigoAo(api.configuracao.removerVinculo(1, 99999))).toEqual([404, 'nao_encontrado'])

    await api.configuracao.removerVinculo(1, ana.id)
    expect((await api.configuracao.listarVinculos(1)).map((v) => v.usuario.nome)).toEqual(['Carlos Lima', 'Juliana Prado'])
    // A conta continua: a Ana volta a ser só consumidora.
    await entrarComo('ana@email.com')
    expect((await api.acesso.eu()).vinculos).toEqual([])
  })
})

describe('mock · acerto com o contrato da main (A, B, C)', () => {
  it('A · criar conta: sem_nome e email_invalido, na ordem do backend', async () => {
    const criar = (nome: string, email: string) =>
      erroDe(api.acesso.criarConta({ nome, email, senha: '12345678', aceite_termos: true }))
    expect((await criar('  ', 'x@y.com')).codigo).toBe('sem_nome')
    expect((await criar('Bia', 'bia@')).codigo).toBe('email_invalido')
    expect((await criar('Bia', 'ANA@email.com')).codigo).toBe('email_em_uso') // sem diferenciar maiúsculas
  })

  it('B · vitrine sem esgotadas; o detalhe responde; filtro inválido → 400', async () => {
    await entrarComo('ana@email.com')
    await api.consumidor.reservar(4, 2) // o molho (loja 3) tinha 2 livres
    expect((await api.consumidor.listarOfertas()).map((o) => o.id)).not.toContain(4)
    expect((await api.consumidor.obterOferta(4)).livre).toBe(0)

    const e = await erroDe(api.consumidor.listarOfertas({ categoria: 'pao' as never }))
    expect([e.status, e.codigo]).toEqual([400, 'parametro_invalido'])
    expect((await erroDe(api.consumidor.minhasReservas('todas' as never))).codigo).toBe('parametro_invalido')
  })

  it('B · loja sem coordenada vai para o fim da lista por distância, com distancia_km null', async () => {
    await entrarComo('carlos@vilanova.com.br')
    await api.configuracao.atualizarLoja(1, { latitude: null, longitude: null })
    const lista = await api.consumidor.listarOfertas({ lat: -20.81, lng: -49.37 })
    const ultimas = lista.slice(-3)
    expect(ultimas.every((o) => o.loja.id === 1 && o.distancia_km === null)).toBe(true)
    expect(lista[0].distancia_km).not.toBeNull()
  })

  it('C · ofertas sem estado: ativas (fim mais próximo) e depois encerradas (mais recente)', async () => {
    await entrarComo('carlos@vilanova.com.br')
    const todas = await api.operacao.listarOfertas(1)
    const estados = todas.map((o) => o.estado)
    expect(estados.indexOf('encerrada')).toBe(estados.lastIndexOf('ativa') + 1)
    const ativas = todas.filter((o) => o.estado === 'ativa').map((o) => o.fim)
    const encerradas = todas.filter((o) => o.estado === 'encerrada').map((o) => o.fim)
    expect(ativas).toEqual([...ativas].sort())
    expect(encerradas).toEqual([...encerradas].sort().reverse())
  })

  it('C · oferta de outra loja → 404; erros do ajuste na ordem do backend', async () => {
    await entrarComo('carlos@vilanova.com.br')
    expect((await erroDe(api.operacao.obterOferta(1, 3))).status).toBe(404) // a 3 é da loja 2
    const codigo = async (quantidade: number, motivo: string, oferta = 1) =>
      (await erroDe(api.operacao.ajustar(1, oferta, { quantidade, motivo }))).codigo
    expect(await codigo(0, '')).toBe('quantidade_invalida')
    expect(await codigo(1, '  ')).toBe('sem_motivo')
    expect(await codigo(1, 'x'.repeat(201))).toBe('motivo_longo')
    expect(await codigo(1, 'Danificada', 3)).toBe('nao_encontrada')
    expect(await codigo(1, 'Danificada', 6)).toBe('oferta_encerrada')
    const acima = await erroDe(api.operacao.ajustar(1, 1, { quantidade: 99, motivo: 'Danificada' }))
    expect([acima.codigo, acima.message, acima.corpo]).toEqual([
      'acima_do_livre',
      'Só dá para ajustar unidades livres; as reservadas não entram.',
      expect.objectContaining({ livre: 6 }),
    ])
  })
})
