import type { Estoque } from '../api'

/** "6 livres · 4 reservadas · 2 retiradas" (só o que não é zero; livre sempre aparece). */
export function resumoEstoque(e: Estoque): string {
  const partes = [`${e.livre} ${e.livre === 1 ? 'livre' : 'livres'}`]
  if (e.reservado) partes.push(`${e.reservado} ${e.reservado === 1 ? 'reservada' : 'reservadas'}`)
  if (e.retirado) partes.push(`${e.retirado} ${e.retirado === 1 ? 'retirada' : 'retiradas'}`)
  if (e.ajustado) partes.push(`${e.ajustado} ${e.ajustado === 1 ? 'ajustada' : 'ajustadas'}`)
  if (e.perda) partes.push(`${e.perda} de perda`)
  return partes.join(' · ')
}
