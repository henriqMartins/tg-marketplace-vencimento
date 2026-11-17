import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Botao } from './Botao'
import { FolhaInferior } from './FolhaInferior'

function Exemplo({ aoFechar = () => {} }: { aoFechar?: () => void }) {
  const [aberta, setAberta] = useState(false)
  return (
    <>
      <Botao onClick={() => setAberta(true)}>Cancelar reserva</Botao>
      <FolhaInferior
        aberta={aberta}
        titulo="Cancelar esta reserva?"
        aoFechar={() => {
          aoFechar()
          setAberta(false)
        }}
      >
        <Botao variante="perigo">Sim, cancelar</Botao>
        <Botao variante="secundario">Manter reserva</Botao>
      </FolhaInferior>
    </>
  )
}

describe('FolhaInferior', () => {
  it('é um diálogo modal nomeado pelo título', async () => {
    const usuario = userEvent.setup()
    render(<Exemplo />)
    expect(screen.queryByRole('dialog')).toBeNull()

    await usuario.click(screen.getByRole('button', { name: 'Cancelar reserva' }))

    const dialogo = screen.getByRole('dialog', { name: 'Cancelar esta reserva?' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
  })

  it('foco vai para dentro, Tab circula dentro e Esc fecha devolvendo o foco', async () => {
    const usuario = userEvent.setup()
    const aoFechar = vi.fn()
    render(<Exemplo aoFechar={aoFechar} />)
    const abrir = screen.getByRole('button', { name: 'Cancelar reserva' })
    await usuario.click(abrir)

    const sim = screen.getByRole('button', { name: 'Sim, cancelar' })
    const manter = screen.getByRole('button', { name: 'Manter reserva' })
    expect(sim).toHaveFocus()
    await usuario.tab()
    expect(manter).toHaveFocus()
    await usuario.tab()
    expect(sim).toHaveFocus() // não escapa para a página atrás do véu

    await usuario.keyboard('{Escape}')
    expect(aoFechar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(abrir).toHaveFocus()
  })

  it('toque no véu fecha; toque dentro da folha não', async () => {
    const usuario = userEvent.setup()
    const aoFechar = vi.fn()
    render(<Exemplo aoFechar={aoFechar} />)
    await usuario.click(screen.getByRole('button', { name: 'Cancelar reserva' }))

    await usuario.click(screen.getByRole('dialog'))
    expect(aoFechar).not.toHaveBeenCalled()

    await usuario.click(screen.getByTestId('veu'))
    expect(aoFechar).toHaveBeenCalledTimes(1)
  })
})
