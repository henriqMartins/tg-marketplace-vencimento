import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Contador, type TamanhoContador } from './Contador'

function ComEstado({ inicial = 1, min = 1, max = 3, tamanho }: { inicial?: number; min?: number; max?: number; tamanho?: TamanhoContador }) {
  const [valor, setValor] = useState(inicial)
  return <Contador valor={valor} min={min} max={max} aoMudar={setValor} rotulo="Quantidade" tamanho={tamanho} />
}

const valor = () => screen.getByRole('status').textContent
const mais = () => screen.getByRole('button', { name: 'Aumentar' })
const menos = () => screen.getByRole('button', { name: 'Diminuir' })

afterEach(() => {
  vi.useRealTimers()
})

describe('Contador −/+', () => {
  it('soma e subtrai respeitando mínimo e máximo', async () => {
    const usuario = userEvent.setup()
    render(<ComEstado inicial={1} min={1} max={3} />)

    expect(menos()).toBeDisabled() // já no mínimo
    await usuario.click(mais())
    await usuario.click(mais())
    expect(valor()).toBe('3')
    expect(mais()).toBeDisabled() // chegou no máximo (ex.: max = livre)
    await usuario.click(mais())
    expect(valor()).toBe('3')

    await usuario.click(menos())
    expect(valor()).toBe('2')
  })

  it('nunca abre teclado: não há campo de texto nem de número', () => {
    const { container } = render(<ComEstado />)
    expect(container.querySelector('input, textarea, [contenteditable]')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.getByRole('group', { name: 'Quantidade' })).toBeInTheDocument()
  })

  it('funciona pelo teclado (Enter/Espaço nos botões)', async () => {
    const usuario = userEvent.setup()
    render(<ComEstado inicial={1} max={5} />)
    mais().focus()
    await usuario.keyboard('{Enter}')
    await usuario.keyboard(' ')
    expect(valor()).toBe('3')
  })

  it('segurar repete; o clique que o navegador dispara ao soltar não conta em dobro', () => {
    vi.useFakeTimers()
    render(<ComEstado inicial={0} min={0} max={10} tamanho="conferencia" />)

    fireEvent.pointerDown(mais(), { button: 0 })
    act(() => vi.advanceTimersByTime(400)) // começa a repetir: 1
    act(() => vi.advanceTimersByTime(200)) // +2 → 3
    fireEvent.pointerUp(mais())
    fireEvent.click(mais(), { detail: 1 })
    act(() => vi.advanceTimersByTime(1000)) // soltou: não repete mais
    expect(valor()).toBe('3')

    fireEvent.click(mais(), { detail: 1 }) // o próximo toque volta a contar
    expect(valor()).toBe('4')
  })

  it('segurar para no máximo', () => {
    vi.useFakeTimers()
    render(<ComEstado inicial={0} min={0} max={5} />)
    fireEvent.pointerDown(mais(), { button: 0 })
    act(() => vi.advanceTimersByTime(3000))
    expect(valor()).toBe('5')
    expect(mais()).toBeDisabled()
  })

  it('toque curto: só o clique conta, uma vez', () => {
    vi.useFakeTimers()
    render(<ComEstado inicial={0} min={0} max={5} />)
    fireEvent.pointerDown(mais(), { button: 0 })
    act(() => vi.advanceTimersByTime(150))
    fireEvent.pointerUp(mais())
    fireEvent.click(mais(), { detail: 1 })
    act(() => vi.advanceTimersByTime(1000))
    expect(valor()).toBe('1')
  })
})
