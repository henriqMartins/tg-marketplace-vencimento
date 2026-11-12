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

// ---------- Navegação ----------

type PropsIcone = { tamanho?: number }

export function IconeCasa({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-5h6v5" />
    </Icone>
  )
}

export function IconeVitrine({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M4 9h16l-1.5-5h-13L4 9z" />
      <path d="M5 9v11h14V9" />
      <path d="M10 20v-6h4v6" />
    </Icone>
  )
}

export function IconeReservas({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4V7z" />
      <path d="M14 5v14" strokeDasharray="2 2" />
    </Icone>
  )
}

export function IconePerfil({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icone>
  )
}

export function IconeEntrar({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8l4 4-4 4" />
      <path d="M4 12h10" />
    </Icone>
  )
}

export function IconeLotes({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </Icone>
  )
}

export function IconeAvisos({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" />
      <path d="M10 21h4" />
    </Icone>
  )
}

export function IconeRetirada({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" strokeWidth="3" />
    </Icone>
  )
}

// ---------- Formulário ----------

export function IconeOlho({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icone>
  )
}

export function IconeOlhoFechado({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </Icone>
  )
}

export function IconePino({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Icone>
  )
}

export function IconeBusca({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </Icone>
  )
}

// ---------- Loja ----------

export function IconeConfig({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icone>
  )
}

export function IconeTrocar({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M7 4L3 8l4 4" />
      <path d="M3 8h14" />
      <path d="M17 20l4-4-4-4" />
      <path d="M21 16H7" />
    </Icone>
  )
}

export function IconeEtiqueta({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </Icone>
  )
}

export function IconePainel({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M3 3v18h18" />
      <path d="M7 15v3M12 10v8M17 6v12" />
    </Icone>
  )
}

export function IconeMais({ tamanho }: PropsIcone) {
  return (
    <Icone tamanho={tamanho}>
      <path d="M12 5v14M5 12h14" />
    </Icone>
  )
}
