/*
 * PATCH /lojas/{id} no mock: as mesmas validações do backend (backend/ofertas/api_config.py),
 * com as mesmas frases e códigos. Valida TUDO antes de gravar: um campo errado → nada muda.
 */
import type { LojaConfig } from '../tipos'
import type { LojaMock } from './semente'

export const JANELAS_LOJA = [1, 2, 4, 8, 12, 24] as const
const NOME_MAXIMO = 120
const ENDERECO_MAXIMO = 255

export class ErroDeCampo extends Error {
  readonly codigo: string

  constructor(mensagem: string, codigo: string) {
    super(mensagem)
    this.codigo = codigo
  }
}

const inteiro = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null)

function texto(valor: unknown, maximo: number, codigoVazio: string, codigoLongo: string, rotulo: string) {
  const t = typeof valor === 'string' ? valor.trim() : ''
  if (!t) throw new ErroDeCampo(`Informe ${rotulo}.`, codigoVazio)
  if (t.length > maximo) {
    throw new ErroDeCampo(`${rotulo[0].toUpperCase()}${rotulo.slice(1)} pode ter até ${maximo} caracteres.`, codigoLongo)
  }
  return t
}

/** Campos do pedido → mudanças. Campo ausente não muda; `id` e desconhecidos são ignorados. */
export function mudancasDaLoja(corpo: Partial<Record<keyof LojaConfig, unknown>>): Partial<LojaMock> {
  const m: Partial<LojaMock> = {}
  if ('nome' in corpo) m.nome = texto(corpo.nome, NOME_MAXIMO, 'sem_nome', 'nome_longo', 'o nome')
  if ('endereco' in corpo) {
    m.endereco = texto(corpo.endereco, ENDERECO_MAXIMO, 'sem_endereco', 'endereco_longo', 'o endereço')
  }
  if ('latitude' in corpo || 'longitude' in corpo) {
    // Andam JUNTAS: as duas preenchidas ou as duas null (apaga).
    const { latitude: lat, longitude: lng } = corpo
    if (!('latitude' in corpo) || !('longitude' in corpo) || (lat === null) !== (lng === null)) {
      throw new ErroDeCampo('Envie latitude e longitude juntas.', 'coordenadas_incompletas')
    }
    if (lat === null) {
      m.latitude = null
      m.longitude = null
    } else {
      if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new ErroDeCampo('Coordenadas fora dos limites.', 'coordenadas_invalidas')
      }
      m.latitude = Math.round(lat * 1e6) / 1e6
      m.longitude = Math.round(lng * 1e6) / 1e6
    }
  }
  if ('janela_padrao_horas' in corpo) {
    const janela = inteiro(corpo.janela_padrao_horas)
    if (!JANELAS_LOJA.includes(janela as (typeof JANELAS_LOJA)[number])) {
      throw new ErroDeCampo('Janela padrão: 1, 2, 4, 8, 12 ou 24 horas.', 'janela_invalida')
    }
    m.janela_padrao_horas = janela!
  }
  if ('margem_fim_dias' in corpo) {
    const margem = inteiro(corpo.margem_fim_dias)
    if (margem === null || margem < 0 || margem > 7) throw new ErroDeCampo('A margem vai de 0 a 7 dias.', 'margem_invalida')
    m.margem_fim_dias = margem
  }
  if ('antecedencia_aviso_dias' in corpo) {
    const antecedencia = inteiro(corpo.antecedencia_aviso_dias)
    if (antecedencia === null || antecedencia < 1 || antecedencia > 30) {
      throw new ErroDeCampo('A antecedência do aviso vai de 1 a 30 dias.', 'antecedencia_invalida')
    }
    m.antecedencia_aviso_dias = antecedencia
  }
  return m
}

/** Regra que junta dois campos: conferida no par FINAL (o que veio + o que já estava gravado). */
export function conferirParFinal(loja: Pick<LojaMock, 'antecedencia_aviso_dias' | 'margem_fim_dias'>) {
  if (loja.antecedencia_aviso_dias <= loja.margem_fim_dias) {
    throw new ErroDeCampo(
      'A antecedência do aviso precisa ser maior que a margem: senão o aviso chega depois do último dia da oferta.',
      'antecedencia_menor_que_margem',
    )
  }
}

export function paraLojaConfig(l: LojaMock): LojaConfig {
  const { id, nome, endereco, latitude, longitude, janela_padrao_horas, margem_fim_dias, antecedencia_aviso_dias } = l
  return { id, nome, endereco, latitude, longitude, janela_padrao_horas, margem_fim_dias, antecedencia_aviso_dias }
}
