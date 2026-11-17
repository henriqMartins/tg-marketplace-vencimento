/*
 * Endereço da loja → coordenada, NO NAVEGADOR (contrato, grupo E: "conversão no navegador").
 * Serviço: Nominatim (OpenStreetMap), decidido na F8 (14/11/2026). Política de uso respeitada:
 * uma busca por ação de salvar (nada de autocompletar), restrita ao Brasil, com o Referer do
 * navegador identificando o app. O endereço da loja já é público (aparece na vitrine).
 * Trocar de serviço = mexer só neste arquivo.
 */

export interface LocalDoEndereco {
  latitude: number
  longitude: number
  /** Como o serviço entendeu o endereço ("Rua das Palmeiras, Boa Vista, São José do Rio Preto…"). */
  descricao: string
}

export class ErroEndereco extends Error {
  constructor() {
    super('Não foi possível buscar o endereço no mapa agora. Confira a internet e tente de novo.')
    this.name = 'ErroEndereco'
  }
}

/** null = o serviço não achou o endereço. */
export type GeocodificarEndereco = (endereco: string) => Promise<LocalDoEndereco | null>

const URL_SERVICO = 'https://nominatim.openstreetmap.org/search'

export async function geocodificarEndereco(endereco: string, fetchFn: typeof fetch = fetch): Promise<LocalDoEndereco | null> {
  const parametros = new URLSearchParams({
    q: endereco.replaceAll('·', ','), // "Rua X, 410 · Bairro" → "Rua X, 410 , Bairro"
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'br',
    'accept-language': 'pt-BR',
  })
  let resposta: Response
  try {
    resposta = await fetchFn(`${URL_SERVICO}?${parametros}`)
  } catch {
    throw new ErroEndereco()
  }
  if (!resposta.ok) throw new ErroEndereco()

  const lista = (await resposta.json()) as { lat?: string; lon?: string; display_name?: string }[]
  const primeiro = lista[0]
  const latitude = Number.parseFloat(primeiro?.lat ?? '')
  const longitude = Number.parseFloat(primeiro?.lon ?? '')
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  // 6 casas, como o backend guarda.
  return {
    latitude: Math.round(latitude * 1e6) / 1e6,
    longitude: Math.round(longitude * 1e6) / 1e6,
    descricao: primeiro.display_name ?? endereco,
  }
}
