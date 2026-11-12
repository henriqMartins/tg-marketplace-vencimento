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
