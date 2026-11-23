import { beforeEach, describe, expect, it } from 'vitest'
import { ErroApi } from '../erros'
import { criarClienteMock, type ClienteMock } from './cliente-mock'
import { CNPJ_ATIVA, CNPJ_FORA_DO_AR, CNPJ_INATIVA, CNPJ_NAO_ALIMENTAR } from './grupo-i'
import { SENHA_MOCK } from './semente'
import { completarCnpj } from '../../util/cnpj'

const INICIO = new Date('2026-11-18T10:00:00-03:00')
let agora: Date
let token: string | null
let api: ClienteMock

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

const ENTRADA_LOJA = {
  cnpj: CNPJ_ATIVA,
  nome: 'Mercearia São Jorge',
  endereco: 'Rua Bernardino de Campos, 1500 · Centro',
  latitude: -20.81,
  longitude: -49.38,
  telefone: '17999990000',
  email_responsavel: 'Marcos@Example.com',
  interesse_id: 3,
}

beforeEach(() => {
  agora = INICIO
  token = null
  api = criarClienteMock({ obterToken: () => token, agora: () => agora })
})

describe('mock · grupo I · Eu', () => {
  it('equipe com plataforma; Marcos com o interesse novo; Ana sem nada', async () => {
    await entrarComo('equipe@example.com')
    expect(await api.acesso.eu()).toMatchObject({ plataforma: true, interesse: null })
    await entrarComo('marcos@example.com')
    expect(await api.acesso.eu()).toMatchObject({
      plataforma: false,
      interesse: { id: 3, estado: 'novo', criado_em: expect.any(String) },
    })
    await entrarComo('ana@email.com')
    expect(await api.acesso.eu()).toMatchObject({ plataforma: false, interesse: null })
  })
})

describe('mock · grupo I · interesse', () => {
  it('registra; o segundo em aberto dá 409', async () => {
    await entrarComo('ana@email.com')
    const i = await api.parceria.registrarInteresse({ nome_mercado: ' Empório Ana ', cidade: 'Mirassol', telefone: '17988887777' })
    expect(i).toMatchObject({ nome_mercado: 'Empório Ana', estado: 'novo', mensagem: '', pessoa: { email: 'ana@email.com' } })
    expect((await api.acesso.eu()).interesse).toMatchObject({ id: i.id, estado: 'novo' })
    const e = await erroDe(api.parceria.registrarInteresse({ nome_mercado: 'X', cidade: 'Y', telefone: '1' }))
    expect([e.status, e.codigo]).toEqual([409, 'interesse_em_aberto'])
  })

  it('campo faltando → 400 campo_obrigatorio', async () => {
    await entrarComo('ana@email.com')
    const e = await erroDe(api.parceria.registrarInteresse({ nome_mercado: 'X', cidade: ' ', telefone: '1' }))
    expect([e.status, e.codigo]).toEqual([400, 'campo_obrigatorio'])
  })

  it('rotas da plataforma: 403 para quem não é equipe', async () => {
    await entrarComo('carlos@vilanova.com.br')
    for (const chamada of [
      api.parceria.listarInteresses(),
      api.parceria.listarLojas(),
      api.parceria.consultarCnpj(CNPJ_ATIVA),
      api.parceria.cadastrarLoja(ENTRADA_LOJA),
    ]) {
      expect((await erroDe(chamada)).status).toBe(403)
    }
  })

  it('equipe lista por estado e marca em conversa / descarta', async () => {
    await entrarComo('equipe@example.com')
    expect((await api.parceria.listarInteresses('novo')).map((i) => i.id)).toEqual([3])
    expect(await api.parceria.atualizarInteresse(3, { estado: 'em_conversa' })).toMatchObject({ estado: 'em_conversa' })
    expect(await api.parceria.listarInteresses('novo')).toEqual([])
    expect(await api.parceria.atualizarInteresse(3, { estado: 'descartado', motivo: 'Fora da região' })).toMatchObject({
      estado: 'descartado',
      motivo_descarte: 'Fora da região',
    })
  })
})

describe('mock · grupo I · CNPJ (Receita fingida)', () => {
  beforeEach(() => entrarComo('equipe@example.com'))

  it('ativa e alimentar; ativa fora do varejo; inativa', async () => {
    expect(await api.parceria.consultarCnpj('11.222.333/0001-81')).toMatchObject({ cnpj: CNPJ_ATIVA, ativa: true, alimentar: true })
    expect(await api.parceria.consultarCnpj(CNPJ_NAO_ALIMENTAR)).toMatchObject({ ativa: true, alimentar: false })
    expect(await api.parceria.consultarCnpj(CNPJ_INATIVA)).toMatchObject({ ativa: false, situacao: 'BAIXADA' })
  })

  it('dígito errado 400, não encontrado 404, fora do ar 503', async () => {
    expect((await erroDe(api.parceria.consultarCnpj('11222333000182'))).codigo).toBe('cnpj_invalido')
    expect((await erroDe(api.parceria.consultarCnpj(completarCnpj('112223330002')))).codigo).toBe('cnpj_nao_encontrado')
    const e = await erroDe(api.parceria.consultarCnpj(CNPJ_FORA_DO_AR))
    expect([e.status, e.codigo]).toEqual([503, 'consulta_indisponivel'])
  })
})

describe('mock · grupo I · loja e convite', () => {
  it('cadastra: loja + convite de 7 dias + interesse vira loja', async () => {
    await entrarComo('equipe@example.com')
    const { loja, convite } = await api.parceria.cadastrarLoja(ENTRADA_LOJA)
    expect(convite).toEqual({
      codigo: expect.stringMatching(/^[\w-]{20,}$/),
      email: 'marcos@example.com',
      expira_em: '2026-11-25T10:00:00-03:00',
    })
    expect(loja).toMatchObject({
      cnpj: CNPJ_ATIVA,
      cnpj_verificado: true,
      responsavel: null,
      convite: { estado: 'pendente', email: 'marcos@example.com', codigo: convite.codigo },
    })
    const [interesse] = await api.parceria.listarInteresses('virou_loja')
    expect(interesse).toMatchObject({ id: 3, loja_id: loja.id })
    // CNPJ repetido
    expect((await erroDe(api.parceria.cadastrarLoja({ ...ENTRADA_LOJA, interesse_id: undefined }))).codigo).toBe('cnpj_ja_cadastrado')
  })

  it('inativa bloqueia; Receita fora do ar segue como não verificado', async () => {
    await entrarComo('equipe@example.com')
    expect((await erroDe(api.parceria.cadastrarLoja({ ...ENTRADA_LOJA, cnpj: CNPJ_INATIVA }))).codigo).toBe('cnpj_inativo')
    const { loja } = await api.parceria.cadastrarLoja({ ...ENTRADA_LOJA, cnpj: CNPJ_FORA_DO_AR })
    expect(loja.cnpj_verificado).toBe(false)
  })

  it('aceite: e-mail diferente 403; certo vira responsável; de novo 409', async () => {
    await entrarComo('equipe@example.com')
    const { convite, loja } = await api.parceria.cadastrarLoja(ENTRADA_LOJA)

    await entrarComo('ana@email.com')
    expect(await api.parceria.obterConvite(convite.codigo)).toMatchObject({ loja: { nome: 'Mercearia São Jorge' }, email: 'marcos@example.com' })
    const e = await erroDe(api.parceria.aceitarConvite(convite.codigo))
    expect([e.status, e.codigo]).toEqual([403, 'email_diferente'])

    await entrarComo('marcos@example.com')
    expect(await api.parceria.aceitarConvite(convite.codigo)).toEqual({
      vinculo: { loja: { id: loja.id, nome: 'Mercearia São Jorge' }, papel: 'responsavel' },
    })
    expect((await api.acesso.eu()).vinculos).toContainEqual({ loja: { id: loja.id, nome: 'Mercearia São Jorge' }, papel: 'responsavel' })
    const usado = await erroDe(api.parceria.aceitarConvite(convite.codigo))
    expect([usado.status, usado.codigo]).toEqual([409, 'convite_usado'])

    await entrarComo('equipe@example.com')
    expect((await api.parceria.listarLojas()).find((l) => l.id === loja.id)).toMatchObject({
      responsavel: { nome: 'Marcos Lima' },
      convite: { estado: 'aceito' },
    })
    expect((await erroDe(api.parceria.novoConvite(loja.id))).codigo).toBe('loja_ja_ativa')
  })

  it('vencido 410; renovado: o antigo deixa de valer e o novo funciona', async () => {
    await entrarComo('equipe@example.com')
    const { convite, loja } = await api.parceria.cadastrarLoja(ENTRADA_LOJA)
    const novo = await api.parceria.novoConvite(loja.id)
    expect(novo.codigo).not.toBe(convite.codigo)

    await entrarComo('marcos@example.com')
    expect((await erroDe(api.parceria.aceitarConvite(convite.codigo))).status).toBe(410)
    agora = new Date('2026-11-26T10:00:00-03:00') // passou dos 7 dias
    expect((await erroDe(api.parceria.obterConvite(novo.codigo))).codigo).toBe('convite_vencido')
    expect((await erroDe(api.parceria.obterConvite('nao-existe'))).status).toBe(404)
  })
})

describe('mock · grupo I · decisões ★ do contrato (17/11/2026)', () => {
  it('Eu.interesse só traz o pedido em aberto', async () => {
    await entrarComo('equipe@example.com')
    await api.parceria.cadastrarLoja(ENTRADA_LOJA) // o pedido 3 vira loja
    await entrarComo('marcos@example.com')
    expect((await api.acesso.eu()).interesse).toBeNull()
  })

  it('PATCH: descartar exige motivo; virou_loja não volta a em_conversa', async () => {
    await entrarComo('equipe@example.com')
    const semMotivo = await erroDe(api.parceria.atualizarInteresse(3, { estado: 'descartado' }))
    expect([semMotivo.status, semMotivo.codigo]).toEqual([400, 'campo_obrigatorio'])
    await api.parceria.cadastrarLoja(ENTRADA_LOJA)
    expect((await erroDe(api.parceria.atualizarInteresse(3, { estado: 'em_conversa' }))).codigo).toBe('estado_invalido')
  })

  it('criação: CNPJ que a Receita não conhece bloqueia; interesse fechado → estado_invalido', async () => {
    await entrarComo('equipe@example.com')
    const desconhecido = await erroDe(api.parceria.cadastrarLoja({ ...ENTRADA_LOJA, cnpj: completarCnpj('112223330002') }))
    expect([desconhecido.status, desconhecido.codigo]).toEqual([400, 'cnpj_nao_encontrado'])
    await api.parceria.atualizarInteresse(3, { estado: 'descartado', motivo: 'Fora da região' })
    expect((await erroDe(api.parceria.cadastrarLoja(ENTRADA_LOJA))).codigo).toBe('estado_invalido')
  })

  it('403 email_diferente traz email_convite mascarado', async () => {
    await entrarComo('equipe@example.com')
    const { convite } = await api.parceria.cadastrarLoja(ENTRADA_LOJA)
    await entrarComo('ana@email.com')
    const e = await erroDe(api.parceria.aceitarConvite(convite.codigo))
    expect(e.corpo).toMatchObject({ codigo: 'email_diferente', email_convite: 'm…@example.com' })
  })
})

describe('mock · grupo I · detalhes do contrato publicado (23/11/2026)', () => {
  it('erro de campo traz `campo`; campo longo → campo_longo', async () => {
    await entrarComo('ana@email.com')
    const vazio = await erroDe(api.parceria.registrarInteresse({ nome_mercado: 'X', cidade: ' ', telefone: '1' }))
    expect(vazio.corpo).toEqual({ erro: 'Informe a cidade.', codigo: 'campo_obrigatorio', campo: 'cidade' })
    const longo = await erroDe(api.parceria.registrarInteresse({ nome_mercado: 'x'.repeat(121), cidade: 'Y', telefone: '1' }))
    expect(longo.corpo).toMatchObject({ codigo: 'campo_longo', campo: 'nome_mercado' })
    const fone = await erroDe(api.parceria.registrarInteresse({ nome_mercado: 'X', cidade: 'Y', telefone: '1'.repeat(21) }))
    expect(fone.corpo).toMatchObject({ codigo: 'campo_longo', campo: 'telefone' })
  })

  it('telefone guardado só com dígitos; e-mail do responsável em minúsculas', async () => {
    await entrarComo('ana@email.com')
    const i = await api.parceria.registrarInteresse({ nome_mercado: 'X', cidade: 'Y', telefone: '(17) 98888-7777' })
    expect(i.telefone).toBe('17988887777')
    await entrarComo('equipe@example.com')
    const { loja, convite } = await api.parceria.cadastrarLoja({ ...ENTRADA_LOJA, telefone: '(17) 3222-0000' })
    expect(loja.telefone).toBe('1732220000')
    expect(convite.email).toBe('marcos@example.com')
  })

  it('cadastro: telefone obrigatório; interesse_id inexistente → 404', async () => {
    await entrarComo('equipe@example.com')
    const semFone = await erroDe(api.parceria.cadastrarLoja({ ...ENTRADA_LOJA, telefone: ' ' }))
    expect(semFone.corpo).toMatchObject({ codigo: 'campo_obrigatorio', campo: 'telefone' })
    const inexistente = await erroDe(api.parceria.cadastrarLoja({ ...ENTRADA_LOJA, interesse_id: 999 }))
    expect([inexistente.status, inexistente.codigo]).toEqual([404, 'nao_encontrado'])
  })

  it('novo convite numa loja antiga, que nunca teve convite → 409 sem_convite', async () => {
    await entrarComo('equipe@example.com')
    const lojas = await api.parceria.listarLojas()
    expect(lojas.find((l) => l.id === 2)).toMatchObject({ cnpj: null, convite: null, responsavel: null })
    const e = await erroDe(api.parceria.novoConvite(2))
    expect([e.status, e.codigo]).toEqual([409, 'sem_convite'])
  })
})
