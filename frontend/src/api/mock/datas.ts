/*
 * Datas no horário de Brasília (-03:00, sem horário de verão desde 2019),
 * no formato do contrato. Só o mock produz datas; a tela só formata as que recebe.
 */
import type { Data, DataHora } from '../tipos'

const FUSO_MS = 3 * 3600_000
const dois = (n: number) => String(n).padStart(2, '0')

/** Date → "2026-10-22T20:00:00-03:00". */
export function isoBrasilia(d: Date): DataHora {
  const b = new Date(d.getTime() - FUSO_MS)
  return (
    `${b.getUTCFullYear()}-${dois(b.getUTCMonth() + 1)}-${dois(b.getUTCDate())}` +
    `T${dois(b.getUTCHours())}:${dois(b.getUTCMinutes())}:${dois(b.getUTCSeconds())}-03:00`
  )
}

/** Date → "2026-10-22" (o dia em Brasília). */
export function dataBrasilia(d: Date): Data {
  return isoBrasilia(d).slice(0, 10)
}

/** "2026-10-28" + n dias → "2026-11-03". */
export function somarDias(data: Data, dias: number): Data {
  const [ano, mes, dia] = data.split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias))
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`
}

export function somarMinutos(d: Date, minutos: number): Date {
  return new Date(d.getTime() + minutos * 60_000)
}

/** 23:59 do dia, em Brasília. */
export function fimDoDia(data: Data): Date {
  return new Date(`${data}T23:59:00-03:00`)
}
