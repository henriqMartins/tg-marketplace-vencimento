/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { ARQUIVOS_DO_APP, FORA_DO_APP, MANIFESTO } from './src/app/pwa.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt": versão nova espera a pessoa tocar em "Atualizar" (decisão 2a da F9),
      // para não recarregar no meio de uma reserva ou de uma conferência.
      registerType: 'prompt',
      injectRegister: false, // o registro é feito em src/app/servico.ts
      manifest: MANIFESTO,
      includeAssets: ['favicon.ico', 'icons/favicon.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        globPatterns: ARQUIVOS_DO_APP,
        navigateFallbackDenylist: FORA_DO_APP,
        cleanupOutdatedCaches: true,
        // Nenhum runtimeCaching: chamadas à API, ao CEP e ao mapa vão sempre à rede.
      },
      devOptions: { enabled: false }, // no `npm run dev` e nos testes, sem service worker
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
