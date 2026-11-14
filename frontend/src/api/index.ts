/*
 * Ponto de entrada do cliente da API. Monta o ClienteApi grupo a grupo:
 * cada grupo do contrato (A…G) vem do mock ou da API real, conforme VITE_API.
 * É o ÚNICO arquivo fora de src/api/mock que pode importar o mock.
 */
import { GRUPOS, PARTE_DO_GRUPO, type ClienteApi, type GrupoContrato } from './cliente'
import { lerConfigApi, type ConfigApi } from './config'
import { criarAcessoHttp } from './http/acesso'
import { criarConfiguracaoHttp } from './http/configuracao'
import { criarConsumidorHttp } from './http/consumidor'
import { criarGestorHttp } from './http/gestor'
import { criarLotesHttp } from './http/lotes'
import { criarOperacaoHttp } from './http/operacao'
import { criarProjecaoHttp } from './http/projecao'
import { criarRequisitar, type Requisitar } from './http/requisitar'
import { criarClienteMock } from './mock/cliente-mock'
import { CHAVE_MOCK, type Guarda } from './mock/persistencia'

export type { ClienteApi, GrupoContrato } from './cliente'
export { ErroApi, ehErroApi, SEM_CONEXAO } from './erros'
export * from './tipos'

type FabricaHttp<G extends GrupoContrato> = (requisitar: Requisitar) => ClienteApi[(typeof PARTE_DO_GRUPO)[G]]

/**
 * Implementações reais, por grupo. Cada uma entra quando o grupo vira ✅ no
 * docs/api/contrato.md (o Henrique avisa; `git merge main`; testar com o backend local).
 */
const FABRICAS_HTTP: { [G in GrupoContrato]?: FabricaHttp<G> } = {
  A: criarAcessoHttp,
  B: criarConsumidorHttp,
  C: criarOperacaoHttp,
  D: criarLotesHttp,
  E: criarConfiguracaoHttp,
  F: criarGestorHttp,
  G: criarProjecaoHttp,
}

export interface OpcoesCliente {
  config: ConfigApi
  /** Token da sessão; null = visitante. */
  obterToken: () => string | null
  /** Endereço da API real, ex.: "http://localhost:8000". */
  baseUrl: string
  atrasoMockMs?: number
  agora?: () => Date
  /** Onde o mock guarda o estado entre recargas (sessionStorage no app). */
  persistenciaMock?: Guarda | null
}

export function criarCliente({ config, obterToken, baseUrl, atrasoMockMs, agora, persistenciaMock }: OpcoesCliente): ClienteApi {
  const mock = criarClienteMock({ obterToken, agora, atrasoMs: atrasoMockMs, persistencia: persistenciaMock })
  // Começa com tudo no mock (sem os ganchos de teste dele) e troca os grupos marcados como http.
  const cliente: ClienteApi = {
    servidor: mock.servidor,
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
  // /health vai para a API real assim que algum grupo for real.
  if (requisitar) {
    const req = requisitar
    cliente.servidor = { saude: () => req<void>('GET', '/health') }
  }
  return cliente
}

/** Cliente configurado pelas variáveis de ambiente do Vite (.env). */
export function criarClienteDoAmbiente(obterToken: () => string | null): ClienteApi {
  return criarCliente({
    config: lerConfigApi(import.meta.env.VITE_API),
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    atrasoMockMs: Number(import.meta.env.VITE_MOCK_ATRASO_MS ?? 400),
    persistenciaMock: sessionStorageSeguro(),
    obterToken,
  })
}

/** Apaga o estado guardado do mock (botão "Reiniciar dados do mock"); vale a partir da recarga. */
export function apagarDadosDoMock(): void {
  sessionStorageSeguro()?.removeItem(CHAVE_MOCK)
}

function sessionStorageSeguro(): Guarda | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}
