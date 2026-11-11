import { describe, expect, it } from 'vitest'
import { lerConfigApi } from './config'
import { criarCliente } from './index'

const base = { obterToken: () => null, baseUrl: 'http://localhost:8000' }

describe('criarCliente', () => {
  it('tudo no mock: a vitrine responde', async () => {
    const api = criarCliente({ ...base, config: lerConfigApi('mock') })
    expect((await api.consumidor.listarOfertas()).length).toBeGreaterThan(0)
  })

  it('não expõe os ganchos de teste do mock', () => {
    const api = criarCliente({ ...base, config: lerConfigApi('mock') })
    expect(api).not.toHaveProperty('reiniciar')
  })

  it('grupo marcado como http sem implementação → erro claro (nada de cair no mock em silêncio)', () => {
    expect(() => criarCliente({ ...base, config: lerConfigApi('B') })).toThrow('grupo B ainda não tem implementação http')
  })
})
