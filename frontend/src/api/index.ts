/*
 * Ponto de entrada do cliente da API. Monta o ClienteApi grupo a grupo:
 * cada grupo do contrato (A…G) vem do mock ou da API real, conforme VITE_API.
 * É o ÚNICO arquivo fora de src/api/mock que pode importar o mock.
 */
import { GRUPOS, PARTE_DO_GRUPO, type ClienteApi, type GrupoContrato } from './cliente'
import { lerConfigApi, type ConfigApi } from './config'
import { criarRequisitar, type Requisitar } from './http/requisitar'
import { criarClienteMock } from './mock/cliente-mock'

export type { ClienteApi, GrupoContrato } from './cliente'
export { ErroApi, ehErroApi, SEM_CONEXAO } from './erros'
export * from './tipos'

type FabricaHttp<G extends GrupoContrato> = (requisitar: Requisitar) => ClienteApi[(typeof PARTE_DO_GRUPO)[G]]

/**
 * Implementações reais, por grupo. Cada uma entra quando o grupo vira ✅ no
 * docs/api/contrato.md (o Henrique avisa; `git merge main`; testar com o backend local).
 */
const FABRICAS_HTTP: { [G in GrupoContrato]?: FabricaHttp<G> } = {}

export interface OpcoesCliente {
  config: ConfigApi
  /** Token da sessão; null = visitante. */
  obterToken: () => string | null
  /** Endereço da API real, ex.: "http://localhost:8000". */
  baseUrl: string
  atrasoMockMs?: number
  agora?: () => Date
}

export function criarCliente({ config, obterToken, baseUrl, atrasoMockMs, agora }: OpcoesCliente): ClienteApi {
  const mock = criarClienteMock({ obterToken, agora, atrasoMs: atrasoMockMs })
  // Começa com tudo no mock (sem os ganchos de teste dele) e troca os grupos marcados como http.
  const cliente: ClienteApi = {
    acesso: mock.acesso,
    consumidor: mock.consumidor,
    operacao: mock.operacao,
    lotes: mock.lotes,
    configuracao: mock.configuracao,
    gestor: mock.gestor,
    projecao: mock.projecao,
  }
  let requisitar: Requisitar | undefined

  for (const grupo of GRUPOS) {
    if (config[grupo] !== 'http') continue
    const fabrica = FABRICAS_HTTP[grupo] as FabricaHttp<typeof grupo> | undefined
    if (!fabrica) {
      throw new Error(
        `O grupo ${grupo} ainda não tem implementação http. Use o mock para ele (VITE_API sem a letra ${grupo}).`,
      )
    }
    requisitar ??= criarRequisitar({ baseUrl, obterToken })
    Object.assign(cliente, { [PARTE_DO_GRUPO[grupo]]: fabrica(requisitar) })
  }
  return cliente
}

/** Cliente configurado pelas variáveis de ambiente do Vite (.env). */
export function criarClienteDoAmbiente(obterToken: () => string | null): ClienteApi {
  return criarCliente({
    config: lerConfigApi(import.meta.env.VITE_API),
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    atrasoMockMs: Number(import.meta.env.VITE_MOCK_ATRASO_MS ?? 400),
    obterToken,
  })
}
