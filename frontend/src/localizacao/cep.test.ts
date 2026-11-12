import { describe, expect, it, vi } from 'vitest'
import { buscarCep, ErroCep, limparCep } from './cep'

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })

// Resposta real da AwesomeAPI para 15025-000 (consultada em 12/11/2026).
const BOA_VISTA = {
  cep: '15025000', address: 'Avenida Bady Bassitt', state: 'SP', district: 'Boa Vista',
  lat: '-20.810642', lng: '-49.3855984', city: 'São José do Rio Preto',
}

async function motivo(promessa: Promise<unknown>) {
  const e = await promessa.catch((e: unknown) => e)
  expect(e).toBeInstanceOf(ErroCep)
  return (e as ErroCep).motivo
}

describe('CEP → coordenada (AwesomeAPI)', () => {
  it('aceita com ou sem traço e devolve números', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => resposta(BOA_VISTA))
    expect(await buscarCep('15025-000', fetch)).toEqual({
      lat: -20.810642, lng: -49.3855984, cep: '15025-000', bairro: 'Boa Vista', cidade: 'São José do Rio Preto',
    })
    expect(fetch).toHaveBeenCalledWith('https://cep.awesomeapi.com.br/json/15025000')
  })

  it('CEP com número errado de dígitos: nem chama o serviço', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    expect(await motivo(buscarCep('1502-500', fetch))).toBe('invalido')
    expect(fetch).not.toHaveBeenCalled()
    expect(limparCep(' 15.025-000 ')).toBe('15025000')
  })

  it('404 do serviço → não encontrado, com a frase da C3', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => resposta({ code: 'not_found' }, 404))
    const e = (await buscarCep('99999999', fetch).catch((e: unknown) => e)) as ErroCep
    expect(e.motivo).toBe('nao_encontrado')
    expect(e.message).toBe('Não encontramos esse CEP. Confira os números')
  })

  it('CEP sem coordenada conta como não encontrado', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => resposta({ ...BOA_VISTA, lat: '', lng: '' }))
    expect(await motivo(buscarCep('15025000', fetch))).toBe('nao_encontrado')
  })

  it('sem internet → sem_conexao (é outra mensagem)', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await motivo(buscarCep('15025000', fetch))).toBe('sem_conexao')
  })
})
