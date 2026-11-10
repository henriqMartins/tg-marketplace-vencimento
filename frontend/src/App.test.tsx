import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App, { NOME_DO_APP } from './App'

describe('App', () => {
  it('renderiza o título do app', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: NOME_DO_APP })).toBeInTheDocument()
  })
})
