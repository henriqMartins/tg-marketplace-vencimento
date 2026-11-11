import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DURACAO_TOAST_MS, useToast, type DadosToast } from './contexto'
import { ProvedorToast } from './ProvedorToast'

function Disparar({ toast }: { toast: DadosToast | string }) {
  const mostrar = useToast()
  return (
    <button type="button" onClick={() => mostrar(toast)}>
      disparar
    </button>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Toast', () => {
  it('aparece na região de status e some depois de 4 s', () => {
    render(
      <ProvedorToast>
        <Disparar toast="Reserva cancelada" />
      </ProvedorToast>,
    )
    fireEvent.click(screen.getByText('disparar'))
    expect(screen.getByRole('status')).toHaveTextContent('Reserva cancelada')

    act(() => vi.advanceTimersByTime(DURACAO_TOAST_MS - 1))
    expect(screen.getByRole('status')).toHaveTextContent('Reserva cancelada')
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('ação opcional: chama e fecha', () => {
    const desfazer = vi.fn()
    render(
      <ProvedorToast>
        <Disparar toast={{ mensagem: 'Aviso adiado', acao: { rotulo: 'Desfazer', aoClicar: desfazer } }} />
      </ProvedorToast>,
    )
    fireEvent.click(screen.getByText('disparar'))
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(desfazer).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('useToast fora do provedor avisa o erro de montagem', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Disparar toast="x" />)).toThrow('ProvedorToast')
  })
})
