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
