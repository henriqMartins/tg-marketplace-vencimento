/*
 * Formatação para a tela. Só muda a APARÊNCIA do que a API devolveu; nunca calcula
 * (regra de ouro do contrato).
 */
import type { Data } from '../api/tipos'

/** "2026-10-28" → "28/10/2026". */
export function formatarData(data: Data): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

/** "2026-10-28" → "28/10". */
export function formatarDataCurta(data: Data): string {
  return formatarData(data).slice(0, 5)
}
