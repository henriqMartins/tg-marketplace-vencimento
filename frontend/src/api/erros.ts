/*
 * Erro da API no formato do contrato: {"erro": "<frase para a pessoa>", "codigo": "<identificador>"}.
 * A tela mostra `message` (a frase) e decide o que fazer pelo `codigo`.
 */

/** Código usado quando não houve resposta (rede caiu ou servidor ainda acordando). */
export const SEM_CONEXAO = 'sem_conexao'

export class ErroApi extends Error {
  /** Status HTTP; 0 quando não houve resposta. */
  readonly status: number
  readonly codigo: string
  /** Corpo completo da resposta (ex.: `livre` no 409 acima_do_livre). */
  readonly corpo: unknown

  constructor(status: number, codigo: string, mensagem: string, corpo?: unknown) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
    this.codigo = codigo
    this.corpo = corpo
  }

  /** true quando nem chegou resposta: a casca mostra "Conectando ao servidor…". */
  get semConexao(): boolean {
    return this.status === 0
  }
}

/** Frase padrão quando a resposta de erro não trouxe `erro` (ex.: 401 do próprio DRF). */
export function mensagemPadrao(status: number): string {
  if (status === 0) return 'Não foi possível falar com o servidor.'
  if (status === 401) return 'Entre na sua conta para continuar.'
  if (status === 403) return 'Você não tem permissão para fazer isso.'
  if (status === 404) return 'Não encontrado.'
  if (status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.'
  return 'Não foi possível concluir. Tente de novo.'
}

export function ehErroApi(e: unknown): e is ErroApi {
  return e instanceof ErroApi
}
