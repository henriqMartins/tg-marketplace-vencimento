/*
 * "Lembrar minha escolha neste aparelho" (A4): grava em localStorage, por usuário.
 * Dá para trocar depois no Perfil (C9) e na L1 — a A4 em /escolher sempre aparece.
 */

export type EscolhaLembrada = { tipo: 'comprar' } | { tipo: 'loja'; lojaId: number }

const chave = (usuarioId: number) => `tg.escolha.${usuarioId}`

export function lerEscolha(usuarioId: number): EscolhaLembrada | null {
  try {
    const texto = window.localStorage.getItem(chave(usuarioId))
    if (!texto) return null
    const valor = JSON.parse(texto) as EscolhaLembrada
    if (valor.tipo === 'comprar') return valor
    if (valor.tipo === 'loja' && Number.isInteger(valor.lojaId)) return valor
    return null
  } catch {
    return null
  }
}

export function lembrarEscolha(usuarioId: number, escolha: EscolhaLembrada): void {
  try {
    window.localStorage.setItem(chave(usuarioId), JSON.stringify(escolha))
  } catch {
    /* armazenamento bloqueado: só não lembra */
  }
}

export function esquecerEscolha(usuarioId: number): void {
  try {
    window.localStorage.removeItem(chave(usuarioId))
  } catch {
    /* nada a fazer */
  }
}
