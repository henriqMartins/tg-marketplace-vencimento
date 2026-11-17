/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** "mock" (padrão), "http" ou letras de grupo do contrato, ex.: "A,B". */
  readonly VITE_API?: string
  /** Endereço da API real. Padrão: http://localhost:8000 */
  readonly VITE_API_URL?: string
  /** Atraso artificial das respostas do mock, em ms. Padrão: 400 */
  readonly VITE_MOCK_ATRASO_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
