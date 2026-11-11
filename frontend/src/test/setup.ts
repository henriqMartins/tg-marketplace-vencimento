// Comparadores do DOM (toBeInTheDocument, toHaveAttribute…) para o Vitest.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { definirLarguraTela, instalarMatchMedia } from './tela'

instalarMatchMedia()

// Desmonta o que cada teste renderizou, para um não vazar no outro.
afterEach(() => {
  cleanup()
  definirLarguraTela(390)
})
