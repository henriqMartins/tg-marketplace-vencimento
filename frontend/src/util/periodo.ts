/*
 * Períodos do gestor (G1, G3): 7 dias, 30 dias ou mês atual, contados a partir de hoje
 * em Brasília. Só define o intervalo PEDIDO à API; os números vêm prontos dela.
 */
import type { Data } from '../api/tipos'

export type Periodo = '7d' | '30d' | 'mes'

export const PERIODOS: readonly { id: Periodo; rotulo: string }[] = [
  { id: '7d', rotulo: '7 dias' },
  { id: '30d', rotulo: '30 dias' },
  { id: 'mes', rotulo: 'Mês atual' },
]

export const PERIODO_PADRAO: Periodo = 'mes'

export function lerPeriodo(texto: string | null): Periodo {
  return PERIODOS.some((p) => p.id === texto) ? (texto as Periodo) : PERIODO_PADRAO
}

/** O dia de hoje em Brasília: "2026-10-22". */
export function hojeEmBrasilia(agora: Date): Data {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)
}

/** Data de calendário + n dias ("2026-10-31" + 1 → "2026-11-01"). Só para opções de tela. */
export function somarDias(data: Data, dias: number): Data {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

const voltarDias = (data: Data, dias: number) => somarDias(data, -dias)

/** Intervalo inclusivo: 7 dias = hoje e os 6 anteriores. */
export function intervaloDo(periodo: Periodo, agora: Date): { de: Data; ate: Data } {
  const ate = hojeEmBrasilia(agora)
  if (periodo === '7d') return { de: voltarDias(ate, 6), ate }
  if (periodo === '30d') return { de: voltarDias(ate, 29), ate }
  return { de: `${ate.slice(0, 8)}01`, ate }
}
