// Comparadores do DOM (toBeInTheDocument, toHaveAttribute…) para o Vitest.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { definirLarguraTela, instalarMatchMedia } from './tela'

// Os testes das funções da Vercel (testes-vercel/) rodam em ambiente Node, sem DOM.
if (typeof window !== 'undefined') {
  instalarMatchMedia()

  // Desmonta o que cada teste renderizou, para um não vazar no outro.
  afterEach(() => {
    cleanup()
    definirLarguraTela(390)
    window.localStorage.clear() // escolha lembrada (A4) não vaza de um teste para outro
    window.sessionStorage.clear()
  })
}
