import { describe, expect, it, vi } from 'vitest'
import { ErroEndereco, geocodificarEndereco } from './endereco'

const respostaJson = (corpo: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch

describe('endereço → coordenada (Nominatim)', () => {
  it('uma busca restrita ao Brasil; devolve a coordenada com 6 casas e como o serviço entendeu', async () => {
    const fetchFalso = respostaJson([{ lat: '-20.81134567', lon: '-49.37581234', display_name: 'Rua das Palmeiras, Boa Vista, São José do Rio Preto' }])
    const local = await geocodificarEndereco('Rua das Palmeiras, 410 · Boa Vista', fetchFalso)
    expect(local).toEqual({ latitude: -20.811346, longitude: -49.375812, descricao: 'Rua das Palmeiras, Boa Vista, São José do Rio Preto' })
    const url = new URL(vi.mocked(fetchFalso).mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search')
    expect(url.searchParams.get('countrycodes')).toBe('br')
    expect(url.searchParams.get('limit')).toBe('1')
    expect(url.searchParams.get('q')).not.toContain('·')
  })

  it('lista vazia = não achou (null); falha de rede ou erro HTTP = ErroEndereco', async () => {
    expect(await geocodificarEndereco('Rua que não existe', respostaJson([]))).toBeNull()
    await expect(geocodificarEndereco('x', respostaJson({}, 503))).rejects.toBeInstanceOf(ErroEndereco)
    const semRede = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(geocodificarEndereco('x', semRede)).rejects.toBeInstanceOf(ErroEndereco)
  })
})
