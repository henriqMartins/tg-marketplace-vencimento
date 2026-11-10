import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonte hospedada no próprio app (funciona offline na PWA). O navegador só baixa
// o subconjunto latino, por causa do unicode-range de cada @font-face.
import '@fontsource-variable/plus-jakarta-sans'
import './estilos/tokens.css'
import './estilos/base.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
