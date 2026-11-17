import { describe, expect, it, vi } from 'vitest'
import { ErroApi } from '../erros'
import { criarRequisitar, montarQuery } from './requisitar'

function fetchFalso(resposta: Response | Error) {
  return vi.fn<typeof fetch>(async () => {
    if (resposta instanceof Error) throw resposta
    return resposta
  })
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

describe('requisitar (base do cliente http)', () => {
  it('envia o token no cabeçalho e o corpo em JSON', async () => {
    const fetch = fetchFalso(json({ ok: true }, 201))
    const requisitar = criarRequisitar({ baseUrl: 'http://api/', obterToken: () => 'abc', fetch })

    await requisitar('POST', '/api/ofertas/1/reservas', { corpo: { pedido: 3 } })

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('http://api/api/ofertas/1/reservas')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({ Authorization: 'Token abc', 'Content-Type': 'application/json' })
    expect(init?.body).toBe('{"pedido":3}')
  })

  it('visitante: sem cabeçalho Authorization', async () => {
    const fetch = fetchFalso(json([]))
    await criarRequisitar({ baseUrl: 'http://api', obterToken: () => null, fetch })('GET', '/api/ofertas')
    expect(fetch.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization')
  })

  it('erro do contrato vira ErroApi com a frase e o código', async () => {
    const corpo = { erro: 'Ajuste maior que o livre', codigo: 'acima_do_livre', livre: 6 }
    const requisitar = criarRequisitar({ baseUrl: 'http://api', obterToken: () => 't', fetch: fetchFalso(json(corpo, 409)) })

    const e = await requisitar('POST', '/x').catch((e: unknown) => e)
    expect(e).toBeInstanceOf(ErroApi)
    expect(e).toMatchObject({ status: 409, codigo: 'acima_do_livre', message: 'Ajuste maior que o livre', corpo })
  })

  it('erro fora do formato (ex.: 401 do DRF) ganha código http_401 e frase padrão', async () => {
    const fetch = fetchFalso(json({ detail: 'As credenciais não foram fornecidas.' }, 401))
    const e = await criarRequisitar({ baseUrl: 'http://api', obterToken: () => null, fetch })('GET', '/api/eu')
      .catch((e: unknown) => e)
    expect(e).toMatchObject({ status: 401, codigo: 'http_401', message: 'Entre na sua conta para continuar.' })
  })

  it('204 → undefined', async () => {
    const fetch = fetchFalso(new Response(null, { status: 204 }))
    const r = await criarRequisitar({ baseUrl: 'http://api', obterToken: () => 't', fetch })('POST', '/api/auth/sair')
    expect(r).toBeUndefined()
  })

  it('sem resposta (rede) → ErroApi status 0, semConexao', async () => {
    const fetch = fetchFalso(new TypeError('Failed to fetch'))
    const e = await criarRequisitar({ baseUrl: 'http://api', obterToken: () => null, fetch })('GET', '/health')
      .catch((e: unknown) => e)
    expect(e).toBeInstanceOf(ErroApi)
    expect((e as ErroApi).semConexao).toBe(true)
  })

  it('montarQuery ignora filtros vazios', () => {
    expect(montarQuery({ categoria: 'frios', q: '', lat: undefined, lng: null, pagina: 2 })).toBe('?categoria=frios&pagina=2')
    expect(montarQuery({})).toBe('')
  })
})
