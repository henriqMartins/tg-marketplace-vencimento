import { ehErroApi } from '../api'

/**
 * Seção 0, item 3: erro de regra vira mensagem, não código HTTP.
 * A frase vem do backend (campo `erro` do contrato); o resto ganha uma frase genérica.
 */
export function mensagemDeErro(erro: unknown): string {
  if (ehErroApi(erro)) return erro.message
  return 'Algo deu errado. Tente de novo.'
}

/** Código do contrato (ex.: "acima_do_livre"), para a tela decidir o que fazer. */
export function codigoDoErro(erro: unknown): string | null {
  return ehErroApi(erro) ? erro.codigo : null
}
