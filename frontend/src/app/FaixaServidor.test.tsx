import { onlineManager, useQuery } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarPecas } from '../test/pecas'
import { ATRASO_FAIXA_MS, LIMITE_SERVIDOR_MS } from './espera'
import { FaixaServidor } from './FaixaServidor'

function ChamadaLenta({ buscar }: { buscar: () => Promise<unknown> }) {
  useQuery({ queryKey: ['lenta'], queryFn: buscar })
  return null
}

afterEach(() => {
  vi.useRealTimers()
  onlineManager.setOnline(true)
})

describe('FaixaServidor (servidor acordando)', () => {
  it('API lenta: faixa após 2 s; aos 90 s "Tentar de novo", que chama de novo', async () => {
    vi.useFakeTimers()
    const { Provedor } = criarPecas()
    const buscar = vi.fn(() => new Promise<never>(() => {})) // servidor que não responde
    render(
      <Provedor>
        <FaixaServidor />
        <ChamadaLenta buscar={buscar} />
      </Provedor>,
    )

    await act(() => vi.advanceTimersByTimeAsync(ATRASO_FAIXA_MS - 1))
    expect(screen.queryByText(/Conectando ao servidor/)).toBeNull() // resposta rápida não pisca a faixa

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(screen.getByText('Conectando ao servidor… pode levar até 1 minuto')).toHaveAttribute('role', 'status')

    await act(() => vi.advanceTimersByTimeAsync(LIMITE_SERVIDOR_MS - ATRASO_FAIXA_MS))
    expect(screen.getByRole('alert')).toHaveTextContent('O servidor não respondeu.')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(buscar).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull() // a contagem recomeçou

    await act(() => vi.advanceTimersByTimeAsync(ATRASO_FAIXA_MS))
    expect(screen.getByText(/Conectando ao servidor/)).toBeInTheDocument()
  })

  it('resposta chega: a faixa some', async () => {
    vi.useFakeTimers()
    const { Provedor } = criarPecas()
    let responder: (v: string) => void = () => {}
    const buscar = () => new Promise<string>((r) => (responder = r))
    render(
      <Provedor>
        <FaixaServidor />
        <ChamadaLenta buscar={buscar} />
      </Provedor>,
    )
    await act(() => vi.advanceTimersByTimeAsync(5_000))
    expect(screen.getByText(/Conectando ao servidor/)).toBeInTheDocument()

    await act(async () => {
      responder('ok')
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.queryByText(/Conectando ao servidor/)).toBeNull()
  })

  it('sem internet: avisa que mostra os dados da última atualização', () => {
    const { Provedor } = criarPecas()
    render(
      <Provedor>
        <FaixaServidor />
      </Provedor>,
    )
    act(() => onlineManager.setOnline(false))
    expect(screen.getByText('Sem internet. Mostrando os dados da última atualização.')).toHaveAttribute('role', 'status')
  })
})
