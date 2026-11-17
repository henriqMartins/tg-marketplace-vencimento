import { useQuery } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErroApi } from '../api'
import { criarPecas } from '../test/pecas'
import { atrasoNovaTentativa, deveTentarDeNovo, RECARGA_30S } from './consultas'

function definirVisibilidade(estado: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado })
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
}

afterEach(() => {
  definirVisibilidade('visible')
  vi.useRealTimers()
})

describe('nova tentativa', () => {
  it('só sem resposta ou 5xx; erro de regra/permissão não repete', () => {
    expect(deveTentarDeNovo(0, new ErroApi(0, 'sem_conexao', ''))).toBe(true)
    expect(deveTentarDeNovo(0, new ErroApi(503, 'http_503', ''))).toBe(true)
    for (const status of [400, 401, 403, 404, 409]) {
      expect(deveTentarDeNovo(0, new ErroApi(status, 'x', '')), `status ${status}`).toBe(false)
    }
    expect(deveTentarDeNovo(10, new ErroApi(0, 'sem_conexao', ''))).toBe(false)
  })

  it('espera crescente até 10 s', () => {
    expect([0, 1, 2, 3, 4, 5].map(atrasoNovaTentativa)).toEqual([1000, 2000, 4000, 8000, 10000, 10000])
  })
})

describe('recarga a cada 30 s (estado sempre fresco)', () => {
  function Tela({ buscar }: { buscar: () => Promise<number> }) {
    useQuery({ queryKey: ['reserva', 31], queryFn: buscar, ...RECARGA_30S })
    return null
  }

  it('recarrega com a aba visível, para com a aba oculta e recarrega ao voltar', async () => {
    vi.useFakeTimers()
    const { Provedor } = criarPecas()
    const buscar = vi.fn(async () => 1)
    render(
      <Provedor>
        <Tela buscar={buscar} />
      </Provedor>,
    )
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(buscar).toHaveBeenCalledTimes(1) // ao abrir

    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(buscar).toHaveBeenCalledTimes(2)

    act(() => definirVisibilidade('hidden'))
    await act(() => vi.advanceTimersByTimeAsync(90_000))
    expect(buscar).toHaveBeenCalledTimes(2) // aba oculta não recarrega

    await act(async () => {
      definirVisibilidade('visible')
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(buscar).toHaveBeenCalledTimes(3) // voltou: recarrega na hora

    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(buscar).toHaveBeenCalledTimes(4)
  })
})
