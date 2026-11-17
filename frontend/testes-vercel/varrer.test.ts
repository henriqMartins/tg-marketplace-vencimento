// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { varrer } from '../api/varrer.ts'

const AMBIENTE = { BACKEND_URL: 'https://api.teste/', CRON_TOKEN: 'token-do-backend', CRON_SECRET: 'segredo-do-cron' }
const pedido = (autorizacao?: string) =>
  new Request('https://app.teste/api/varrer', { headers: autorizacao ? { Authorization: autorizacao } : {} })
const resposta = (status: number, corpo: unknown = { expiradas: 2, encerradas: 1 }) =>
  new Response(JSON.stringify(corpo), { status })

describe('função /api/varrer (Vercel → backend)', () => {
  it('sem o segredo do cron, ou com o segredo errado: 401 e nada vai ao backend', async () => {
    const fetch = vi.fn()
    expect((await varrer(pedido(), AMBIENTE, { fetch })).status).toBe(401)
    expect((await varrer(pedido('Bearer outro'), AMBIENTE, { fetch })).status).toBe(401)
    // CRON_SECRET vazio no painel não pode liberar a rota para "Bearer undefined".
    expect((await varrer(pedido('Bearer undefined'), { ...AMBIENTE, CRON_SECRET: undefined }, { fetch })).status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('autorizado: POST no backend com o CRON_TOKEN e devolve o status e o resumo', async () => {
    const fetch = vi.fn(async () => resposta(200))
    const r = await varrer(pedido('Bearer segredo-do-cron'), AMBIENTE, { fetch })
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ status: 200, tentativas: 1, resumo: { expiradas: 2, encerradas: 1 } })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.teste/tarefas/varrer')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-do-backend')
  })

  it('Render acordando (503): espera e tenta mais uma vez no mesmo prazo', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(resposta(503, 'acordando')).mockResolvedValueOnce(resposta(200))
    const r = await varrer(pedido('Bearer segredo-do-cron'), AMBIENTE, { fetch, pausaMs: 1 })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(await r.json()).toMatchObject({ status: 200, tentativas: 2 })
  })

  it('sem conexão nas duas tentativas → 504; erro do backend (401 do token) → 502 com o status dele', async () => {
    const semRede = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect((await varrer(pedido('Bearer segredo-do-cron'), AMBIENTE, { fetch: semRede, pausaMs: 1 })).status).toBe(504)
    expect(semRede).toHaveBeenCalledTimes(2)

    const tokenErrado = vi.fn(async () => resposta(401, { erro: 'Token inválido.' }))
    const r = await varrer(pedido('Bearer segredo-do-cron'), AMBIENTE, { fetch: tokenErrado })
    expect(r.status).toBe(502)
    expect(await r.json()).toMatchObject({ status: 401, resumo: { erro: 'Token inválido.' } })
  })

  it('o backend não responde dentro do prazo → 504', async () => {
    // fetch que só termina quando o AbortSignal do prazo dispara.
    const pendurado = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_ok, falhar) => init.signal!.addEventListener('abort', () => falhar(init.signal!.reason))),
    )
    const r = await varrer(pedido('Bearer segredo-do-cron'), AMBIENTE, { fetch: pendurado as unknown as typeof fetch, prazoMs: 50 })
    expect(r.status).toBe(504)
    expect(await r.json()).toMatchObject({ erro: 'O backend não respondeu em 0 s.' })
  })

  it('faltando BACKEND_URL ou CRON_TOKEN no painel: 500 com a frase do que falta', async () => {
    const r = await varrer(pedido('Bearer segredo-do-cron'), { CRON_SECRET: 'segredo-do-cron' }, { fetch: vi.fn() })
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ erro: 'Faltam BACKEND_URL ou CRON_TOKEN nas variáveis da Vercel.' })
  })
})
