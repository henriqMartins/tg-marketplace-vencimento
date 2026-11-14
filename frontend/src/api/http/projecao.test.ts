import { describe, expect, it, vi } from 'vitest'
import { criarCliente } from '..'
import { lerConfigApi } from '../config'
import { ErroApi } from '../erros'
import { criarProjecaoHttp } from './projecao'
import { criarRequisitar } from './requisitar'

const TABELA_5 = {
  rodadas: 5000,
  filtro: { lote: null, procura: null, chegada: 2 },
  janelas: [{ janela_horas: 4, perda_pct: 31.3, bloqueados_pct: 13.8, retirada_pct: 53.3 }],
}

function fetchFalso(status: number, corpo: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } }))
}

const projecaoCom = (fetch: typeof globalThis.fetch) =>
  criarProjecaoHttp(criarRequisitar({ baseUrl: 'http://api.teste', obterToken: () => 'abc', fetch }))

describe('grupo G na API real (http)', () => {
  it('sem filtro: só a rota, com o token; devolve o que a API mandou', async () => {
    const fetch = fetchFalso(200, TABELA_5)
    expect(await projecaoCom(fetch).projecao(1)).toEqual(TABELA_5)
    const [url, opcoes] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://api.teste/api/lojas/1/projecao')
    expect(opcoes.method).toBe('GET')
    expect((opcoes.headers as Record<string, string>).Authorization).toBe('Token abc')
  })

  it('com filtro: lote, procura e chegada na query', async () => {
    const fetch = fetchFalso(200, { ...TABELA_5, rodadas: 218 })
    await projecaoCom(fetch).projecao(3, { lote: '5-14', procura: '2.3-3.0', chegada: 4 })
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe('http://api.teste/api/lojas/3/projecao?lote=5-14&procura=2.3-3.0&chegada=4')
  })

  it('403 (não é responsável) vira ErroApi com a frase do contrato', async () => {
    const fetch = fetchFalso(403, { erro: 'Só o responsável da loja pode ver isso.', codigo: 'sem_permissao' })
    const erro = await projecaoCom(fetch)
      .projecao(1)
      .catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroApi)
    expect([(erro as ErroApi).status, (erro as ErroApi).message]).toEqual([403, 'Só o responsável da loja pode ver isso.'])
  })

  it('VITE_API=G liga a projeção na API real; os outros grupos continuam no mock', () => {
    const api = criarCliente({ config: lerConfigApi('G'), obterToken: () => null, baseUrl: 'http://api.teste' })
    expect(api.projecao).not.toBe(criarCliente({ config: lerConfigApi('mock'), obterToken: () => null, baseUrl: '' }).projecao)
    expect(typeof api.consumidor.listarOfertas).toBe('function')
  })
})
