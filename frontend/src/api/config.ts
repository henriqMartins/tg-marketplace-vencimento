import { GRUPOS, type GrupoContrato } from './cliente'

export type Implementacao = 'mock' | 'http'
export type ConfigApi = Record<GrupoContrato, Implementacao>

/**
 * Lê VITE_API e diz qual implementação atende cada grupo do contrato.
 *   vazio ou "mock" → tudo no mock
 *   "http"          → tudo na API real
 *   "A,B"           → só A e B na API real; o resto no mock
 */
export function lerConfigApi(valor: string | undefined): ConfigApi {
  const texto = (valor ?? '').trim().toLowerCase()
  const todos = (impl: Implementacao) =>
    Object.fromEntries(GRUPOS.map((g) => [g, impl])) as ConfigApi

  if (texto === '' || texto === 'mock') return todos('mock')
  if (texto === 'http') return todos('http')

  const config = todos('mock')
  for (const parte of texto.split(',')) {
    const letra = parte.trim().toUpperCase()
    if (letra === '') continue
    if (!GRUPOS.includes(letra as GrupoContrato)) {
      throw new Error(
        `VITE_API inválida: "${valor}". Use "mock", "http" ou letras de grupo separadas por vírgula (ex.: "A,B").`,
      )
    }
    config[letra as GrupoContrato] = 'http'
  }
  return config
}
