import { ehErroApi } from '../api'
import { ErroCep } from '../localizacao/cep'
import { ErroEndereco } from '../localizacao/endereco'

/**
 * Seção 0, item 3: erro de regra vira mensagem, não código HTTP.
 * A frase vem do backend (campo `erro` do contrato) ou dos serviços de localização, que
 * também escrevem para a pessoa; qualquer outro erro ganha uma frase genérica (nada técnico vaza).
 */
export function mensagemDeErro(erro: unknown): string {
  if (ehErroApi(erro) || erro instanceof ErroCep || erro instanceof ErroEndereco) return erro.message
  return 'Algo deu errado. Tente de novo.'
}

/** Código do contrato (ex.: "acima_do_livre"), para a tela decidir o que fazer. */
export function codigoDoErro(erro: unknown): string | null {
  return ehErroApi(erro) ? erro.codigo : null
}
