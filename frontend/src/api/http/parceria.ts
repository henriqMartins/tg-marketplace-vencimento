/* Grupo I na API real (backend/parceria/urls.py). */
import type { ApiParceria } from '../cliente'
import type { ConsultaCnpj, Convite, ConviteAberto, ConviteAceito, Interesse, LojaCadastrada, LojaPlataforma } from '../tipos'
import type { Requisitar } from './requisitar'

/** O código vem de um link: escapa para não virar outro caminho. */
const convite = (codigo: string) => `/api/convites/${encodeURIComponent(codigo)}`

export function criarParceriaHttp(requisitar: Requisitar): ApiParceria {
  return {
    registrarInteresse: (entrada) => requisitar<Interesse>('POST', '/api/interesses', { corpo: entrada }),
    listarInteresses: (estado) => requisitar<Interesse[]>('GET', '/api/plataforma/interesses', { query: { estado } }),
    atualizarInteresse: (id, entrada) =>
      requisitar<Interesse>('PATCH', `/api/plataforma/interesses/${id}`, { corpo: entrada }),
    consultarCnpj: (cnpj) => requisitar<ConsultaCnpj>('GET', `/api/plataforma/cnpj/${encodeURIComponent(cnpj)}`),
    cadastrarLoja: (entrada) => requisitar<LojaCadastrada>('POST', '/api/plataforma/lojas', { corpo: entrada }),
    listarLojas: () => requisitar<LojaPlataforma[]>('GET', '/api/plataforma/lojas'),
    novoConvite: (lojaId) => requisitar<Convite>('POST', `/api/plataforma/lojas/${lojaId}/convite`),
    obterConvite: (codigo) => requisitar<ConviteAberto>('GET', convite(codigo)),
    aceitarConvite: (codigo) => requisitar<ConviteAceito>('POST', `${convite(codigo)}/aceitar`),
  }
}
