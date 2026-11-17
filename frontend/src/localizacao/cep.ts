/*
 * CEP → coordenada, NO NAVEGADOR (decidido 05/11/2026). Serviço: AwesomeAPI (decidido 12/11/2026).
 * Testado em 12/11/2026 com CEPs de Rio Preto: coordenada no nível da rua, 404 para CEP
 * inexistente, CORS liberado, sem chave. (A BrasilAPI devolveu o centro da cidade para
 * CEPs diferentes; a ViaCEP não traz coordenada.)
 * Trocar de serviço = mexer só neste arquivo. O CEP vai para a AwesomeAPI, nunca ao nosso backend.
 */

export interface LocalDoCep {
  lat: number
  lng: number
  /** "15025-000" */
  cep: string
  bairro: string
  cidade: string
}

export type MotivoErroCep = 'invalido' | 'nao_encontrado' | 'sem_conexao'

export class ErroCep extends Error {
  readonly motivo: MotivoErroCep
  constructor(motivo: MotivoErroCep) {
    super(
      motivo === 'sem_conexao'
        ? 'Não foi possível buscar o CEP agora. Confira a internet.'
        : 'Não encontramos esse CEP. Confira os números',
    )
    this.name = 'ErroCep'
    this.motivo = motivo
  }
}

const URL_SERVICO = 'https://cep.awesomeapi.com.br/json/'

/** "15025-000", "15025000" ou " 15.025-000 " → "15025000"; null se não tiver 8 dígitos. */
export function limparCep(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '')
  return digitos.length === 8 ? digitos : null
}

export function formatarCep(digitos: string): string {
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`
}

export type BuscarCep = (cep: string) => Promise<LocalDoCep>

export async function buscarCep(texto: string, fetchFn: typeof fetch = fetch): Promise<LocalDoCep> {
  const cep = limparCep(texto)
  if (!cep) throw new ErroCep('invalido')

  let resposta: Response
  try {
    resposta = await fetchFn(URL_SERVICO + cep)
  } catch {
    throw new ErroCep('sem_conexao')
  }
  if (resposta.status === 404 || resposta.status === 400) throw new ErroCep('nao_encontrado')
  if (!resposta.ok) throw new ErroCep('sem_conexao')

  const dados = (await resposta.json()) as { lat?: string; lng?: string; district?: string; city?: string }
  const lat = Number.parseFloat(dados.lat ?? '')
  const lng = Number.parseFloat(dados.lng ?? '')
  // CEP existe mas sem coordenada: para a vitrine, é como não encontrar.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new ErroCep('nao_encontrado')

  return { lat, lng, cep: formatarCep(cep), bairro: dados.district ?? '', cidade: dados.city ?? '' }
}
