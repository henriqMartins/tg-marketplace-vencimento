/*
 * Guarda o estado do mock no sessionStorage (decidido 11/11/2026): recarregar a página
 * mantém login e reservas; fechar a aba recomeça da semente. Só desenvolvimento.
 */
import type { BancoMock } from './semente'

export type Guarda = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Mudou o formato da semente? Suba a versão: o estado antigo é descartado. */
export const CHAVE_MOCK = 'tg.mock.v5'

/** JSON não sabe guardar Date nem Map: marca os dois para reconstruir na volta. */
export function serializar(banco: BancoMock): string {
  return JSON.stringify(banco, function (this: Record<string, unknown>, chave, valor) {
    const original = this[chave]
    if (original instanceof Date) return { $data: original.toISOString() }
    if (original instanceof Map) return { $mapa: [...original] }
    return valor
  })
}

export function desserializar(texto: string): BancoMock {
  return JSON.parse(texto, (_chave, valor) => {
    if (valor && typeof valor === 'object') {
      if ('$data' in valor) return new Date(valor.$data)
      if ('$mapa' in valor) return new Map(valor.$mapa)
    }
    return valor
  })
}

export function carregar(guarda: Guarda | null): BancoMock | null {
  try {
    const texto = guarda?.getItem(CHAVE_MOCK)
    return texto ? desserializar(texto) : null
  } catch {
    return null // estado corrompido ou bloqueado: recomeça da semente
  }
}

export function salvar(guarda: Guarda | null, banco: BancoMock): void {
  try {
    guarda?.setItem(CHAVE_MOCK, serializar(banco))
  } catch {
    /* sem espaço ou bloqueado: segue só na memória */
  }
}
