import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { NOME_DO_APP } from './app/marca'

describe('App', () => {
  it('abre na A1 com o nome do app e "Conectando ao servidor…"', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: NOME_DO_APP })).toBeInTheDocument()
    expect(screen.getByText('Conectando ao servidor…')).toBeInTheDocument()
  })
})
