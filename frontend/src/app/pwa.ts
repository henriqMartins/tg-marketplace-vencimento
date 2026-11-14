/*
 * PWA (F9): o manifesto num lugar só. O vite.config.ts entrega isto ao vite-plugin-pwa,
 * que gera o manifest.webmanifest e o service worker no build.
 * Nome e ícone são PROVISÓRIOS: trocar o nome é mexer só em marca.ts.
 */
import type { ManifestOptions } from 'vite-plugin-pwa'
import { NOME_DO_APP } from './marca.ts'

export const MANIFESTO: Partial<ManifestOptions> = {
  name: NOME_DO_APP,
  short_name: NOME_DO_APP,
  description: 'Produtos perto do vencimento, com desconto, nos mercadinhos do bairro.',
  lang: 'pt-BR',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: '#1E6A48', // primary
  background_color: '#F6F5F1', // bg
  icons: [
    { src: 'icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    // Android recorta em círculo ou "gota": a etiqueta fica dentro da área segura (70%).
    { src: 'icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}

/**
 * O que o service worker guarda no aparelho: SÓ os arquivos do app. A API nunca entra em
 * cache — estoque, reservas e códigos precisam vir sempre do servidor; sem internet, o app
 * abre e a faixa "Conectando ao servidor…" aparece.
 */
export const ARQUIVOS_DO_APP = ['**/*.{js,css,html,svg,png,woff2}']

/** Rotas que o service worker NÃO responde com o index.html (a API e o /health). */
export const FORA_DO_APP = [/^\/api\//, /^\/health/, /^\/tarefas\//]
