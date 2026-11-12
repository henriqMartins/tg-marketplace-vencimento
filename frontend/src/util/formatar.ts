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
