import { ErroApi, SEM_CONEXAO, mensagemPadrao } from '../erros'

export type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export type ValorQuery = string | number | boolean | null | undefined

export interface OpcoesRequisicao {
  corpo?: unknown
  query?: Record<string, ValorQuery>
}

export interface OpcoesHttp {
  /** Ex.: "http://localhost:8000" (sem barra no fim). */
  baseUrl: string
  /** Token da sessão; null = visitante. */
  obterToken: () => string | null
  /** Para testes; padrão: o fetch do navegador. */
  fetch?: typeof fetch
}

export type Requisitar = <T>(metodo: Metodo, caminho: string, opcoes?: OpcoesRequisicao) => Promise<T>

/** Monta a query string ignorando parâmetros vazios (filtro não escolhido). */
export function montarQuery(query: Record<string, ValorQuery> | undefined): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [chave, valor] of Object.entries(query)) {
    if (valor === undefined || valor === null || valor === '') continue
    params.set(chave, String(valor))
  }
  const texto = params.toString()
  return texto ? `?${texto}` : ''
}

/**
 * Base de todas as chamadas reais: põe o token, envia/lê JSON e converte
 * qualquer falha em ErroApi (status 0 = sem resposta; a casca mostra "Conectando…").
 */
export function criarRequisitar({ baseUrl, obterToken, fetch: fetchFn }: OpcoesHttp): Requisitar {
  const base = baseUrl.replace(/\/+$/, '')

  return async function requisitar<T>(metodo: Metodo, caminho: string, opcoes: OpcoesRequisicao = {}) {
    const cabecalhos: Record<string, string> = { Accept: 'application/json' }
    const token = obterToken()
    if (token) cabecalhos.Authorization = `Token ${token}`
    if (opcoes.corpo !== undefined) cabecalhos['Content-Type'] = 'application/json'

    let resposta: Response
    try {
      resposta = await (fetchFn ?? fetch)(base + caminho + montarQuery(opcoes.query), {
        method: metodo,
        headers: cabecalhos,
        body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
      })
    } catch (causa) {
      throw new ErroApi(0, SEM_CONEXAO, mensagemPadrao(0), causa)
    }

    if (resposta.status === 204) return undefined as T

    const corpo = await lerJson(resposta)
    if (!resposta.ok) {
      const { erro, codigo } = (corpo ?? {}) as { erro?: unknown; codigo?: unknown }
      throw new ErroApi(
        resposta.status,
        typeof codigo === 'string' ? codigo : `http_${resposta.status}`,
        typeof erro === 'string' ? erro : mensagemPadrao(resposta.status),
        corpo,
      )
    }
    return corpo as T
  }
}

async function lerJson(resposta: Response): Promise<unknown> {
  const texto = await resposta.text()
  if (!texto) return null
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}
