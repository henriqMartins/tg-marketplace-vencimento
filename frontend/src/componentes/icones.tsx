/* Ícones em SVG (traço, 24×24), sempre decorativos: quem usa dá o nome acessível. */
import type { ReactNode } from 'react'

function Icone({ tamanho = 22, children }: { tamanho?: number; children: ReactNode }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function IconeVoltar({ tamanho }: { tamanho?: number }) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M15 18l-6-6 6-6" />
    </Icone>
  )
}

export function IconeFechar({ tamanho }: { tamanho?: number }) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icone>
  )
}

export function IconeSacola({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M6 7h12l-1 13H7L6 7z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
    </Icone>
  )
}
