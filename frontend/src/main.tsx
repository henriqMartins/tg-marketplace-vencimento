import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonte hospedada no próprio app (funciona offline na PWA). O navegador só baixa
// o subconjunto latino, por causa do unicode-range de cada @font-face.
import '@fontsource-variable/plus-jakarta-sans'
import './estilos/tokens.css'
import './estilos/base.css'
import App from './App.tsx'
import { ouvirInstalacao } from './app/instalacao'
import { registrarServico } from './app/servico'

// PWA (F9): o pedido de instalação chega uma vez, logo no início; o service worker só existe no build.
ouvirInstalacao()
void registrarServico()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
