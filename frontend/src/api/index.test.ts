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

  it('os grupos ✅ (A–G e I) têm implementação http: VITE_API=http monta o cliente', () => {
    const api = criarCliente({ ...base, config: lerConfigApi('http') })
    const mock = criarCliente({ ...base, config: lerConfigApi('mock') })
    for (const parte of ['acesso', 'consumidor', 'operacao', 'lotes', 'configuracao', 'gestor', 'projecao', 'parceria'] as const) {
      expect(api[parte]).not.toBe(mock[parte])
    }
  })
})
