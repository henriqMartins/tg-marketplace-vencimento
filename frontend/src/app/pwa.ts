/*
 * PWA (F9): o manifesto num lugar só. O vite.config.ts entrega isto ao vite-plugin-pwa,
 * que gera o manifest.webmanifest e o service worker no build.
 * O nome vem de marca.ts; os ícones estão em public/icons/.
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
  background_color: '#1E6A48', // primary: a tela de abertura do Android emenda na A1, que é verde
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    // Android recorta em círculo ou "gota": o símbolo fica dentro da área segura.
    { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
