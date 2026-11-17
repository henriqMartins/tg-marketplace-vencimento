/*
 * Validade impressa digitada no teclado numérico (L3): "22102026" → "22/10/2026" → "2026-10-22".
 * Só confere o FORMATO e se a data existe no calendário; se já venceu, quem diz é a API
 * (`400 validade_passada`).
 */
import type { Data } from '../api/tipos'

/** Máscara progressiva: só dígitos, com as barras entrando sozinhas ("2210" → "22/10"). */
export function mascararData(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** "dd/mm/aaaa" de uma data que existe → "aaaa-mm-dd"; senão null (incompleta, 31/02…). */
export function paraDataIso(texto: string): Data | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto)
  if (!m) return null
  const [, dia, mes, ano] = m
  const iso = `${ano}-${mes}-${dia}`
  const d = new Date(`${iso}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null
}
