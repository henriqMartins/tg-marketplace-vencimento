import type { CorFita } from '../api'

const NOME_DA_COR: Record<CorFita, string> = {
  vermelho: 'Vermelho',
  amarelo: 'Amarelo',
  verde: 'Verde',
  azul: 'Azul',
  branco: 'Branco',
  preto: 'Preto',
}

/** "branco" → "Branco". */
export const nomeDaCor = (cor: CorFita) => NOME_DA_COR[cor]

const COR_NA_FRASE: Record<CorFita, string> = {
  vermelho: 'vermelha',
  amarelo: 'amarela',
  verde: 'verde',
  azul: 'azul',
  branco: 'branca',
  preto: 'preta',
}

/** Concorda com "fita": "Cole a fita preta na caixa". */
export const corDaFita = (cor: CorFita) => COR_NA_FRASE[cor]

/** As 6 cores na ordem do ano (jan–fev … nov–dez). */
export const CORES: readonly CorFita[] = ['vermelho', 'amarelo', 'verde', 'azul', 'branco', 'preto']

/** Bimestre de cada cor, na mesma ordem de CORES (calendário de fitas da G5). */
export const BIMESTRES: readonly string[] = ['jan–fev', 'mar–abr', 'mai–jun', 'jul–ago', 'set–out', 'nov–dez']

/**
 * Qual dos 6 bimestres contém o mês desta data ("2026-11-13" → 5, nov–dez). Só para DESTACAR
 * o bimestre atual no calendário da G5; a cor de cada lote ou grupo vem sempre da API.
 */
export const bimestreDoMes = (data: string) => Math.floor((Number(data.slice(5, 7)) - 1) / 2)
