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

/** "3.14" → "R$ 3,14"; "1234.50" → "R$ 1.234,50". Só texto: nenhuma conta com número decimal. */
export function formatarDinheiro(valor: string): string {
  const [inteiro, centavos = '00'] = valor.split('.')
  const negativo = inteiro.startsWith('-')
  const digitos = negativo ? inteiro.slice(1) : inteiro
  const comMilhar = digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negativo ? '−' : ''}R$ ${comMilhar},${centavos.padEnd(2, '0').slice(0, 2)}`
}

/** 0.4 → "0,4 km"; 12.25 → "12,3 km". */
export function formatarDistancia(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`
}

const FUSO = 'America/Sao_Paulo'
const diaEm = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d) // "2026-10-22"
const horaEm = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)

/**
 * Horário vindo da API, no fuso de Brasília: "hoje, 20:00", "amanhã, 09:00" ou "28/10, 20:00".
 * `agora` só decide a PALAVRA (hoje/amanhã); o horário é sempre o que a API mandou.
 */
export function formatarHorario(dataHora: string, agora: Date = new Date()): string {
  const momento = new Date(dataHora)
  const dia = diaEm(momento)
  const hoje = diaEm(agora)
  const amanha = diaEm(new Date(agora.getTime() + 24 * 3600_000))
  const quando = dia === hoje ? 'hoje' : dia === amanha ? 'amanhã' : formatarDataCurta(dia)
  return `${quando}, ${horaEm(momento)}`
}

/** Tempo até um prazo: "3 h 42 min", "52 min", "menos de 1 min". Só exibe; não decide nada. */
export function formatarTempoRestante(ms: number): string {
  if (ms < 60_000) return 'menos de 1 min'
  const minutos = Math.floor(ms / 60_000)
  const h = Math.floor(minutos / 60)
  const min = minutos % 60
  return h > 0 ? `${h} h ${String(min).padStart(2, '0')} min` : `${min} min`
}

/** Data e hora curtas, em Brasília: "22/10 14:18" (tabelas do gestor). */
export function formatarDataHoraCurta(dataHora: string): string {
  const momento = new Date(dataHora)
  return `${formatarDataCurta(diaEm(momento))} ${horaEm(momento)}`
}

/** Taxa de 0 a 1 vinda da API → "66,7%"; null (base zero) → "—". Só formata. */
export function formatarTaxa(taxa: number | null): string {
  if (taxa === null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(taxa)
}

/** "hoje, 20:00" fica igual; "28/10, 20:00" vira "em 28/10, 20:00" (evita "em hoje"). */
export function comEm(horario: string): string {
  return horario.startsWith('hoje') || horario.startsWith('amanhã') ? horario : `em ${horario}`
}

/** Percentual que a API já manda em % (ex.: 31.3) → "31,3%"; null (sem base) → "—". Só formata. */
export function formatarPercentual(pct: number | null): string {
  if (pct === null) return '—'
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

/** Janela de reserva em horas → "30 min", "1 h", "24 h". */
export function formatarJanela(horas: number): string {
  return horas < 1 ? `${Math.round(horas * 60)} min` : `${horas.toLocaleString('pt-BR')} h`
}
