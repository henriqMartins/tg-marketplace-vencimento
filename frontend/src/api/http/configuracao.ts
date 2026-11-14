/* Grupo E na API real (backend/ofertas/urls.py). */
import type { ApiConfiguracao } from '../cliente'
import type { LojaConfig, VinculoLoja } from '../tipos'
import type { Requisitar } from './requisitar'

export function criarConfiguracaoHttp(requisitar: Requisitar): ApiConfiguracao {
  const loja = (id: number) => `/api/lojas/${id}`
  return {
    obterLoja: (lojaId) => requisitar<LojaConfig>('GET', loja(lojaId)),
    atualizarLoja: (lojaId, campos) => requisitar<LojaConfig>('PATCH', loja(lojaId), { corpo: campos }),
    listarVinculos: (lojaId) => requisitar<VinculoLoja[]>('GET', `${loja(lojaId)}/vinculos`),
    criarVinculo: (lojaId, entrada) => requisitar<VinculoLoja>('POST', `${loja(lojaId)}/vinculos`, { corpo: entrada }),
    alterarPapel: (lojaId, vinculoId, papel) =>
      requisitar<VinculoLoja>('PATCH', `${loja(lojaId)}/vinculos/${vinculoId}`, { corpo: { papel } }),
    removerVinculo: (lojaId, vinculoId) => requisitar<void>('DELETE', `${loja(lojaId)}/vinculos/${vinculoId}`),
  }
}
