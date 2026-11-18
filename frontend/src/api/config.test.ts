import { describe, expect, it } from 'vitest'
import { lerConfigApi } from './config'

describe('lerConfigApi (VITE_API)', () => {
  it('vazio ou "mock" → tudo no mock', () => {
    for (const valor of [undefined, '', 'mock', ' MOCK ']) {
      expect(Object.values(lerConfigApi(valor)).every((v) => v === 'mock')).toBe(true)
    }
  })

  it('"http" → os grupos ✅ na API real; o I (parceria, ainda 📝) fica no mock', () => {
    expect(lerConfigApi('http')).toEqual({
      A: 'http', B: 'http', C: 'http', D: 'http', E: 'http', F: 'http', G: 'http', I: 'mock',
    })
  })

  it('"A,b" → só A e B na API real', () => {
    expect(lerConfigApi('A, b')).toEqual({
      A: 'http', B: 'http', C: 'mock', D: 'mock', E: 'mock', F: 'mock', G: 'mock', I: 'mock',
    })
  })

  it('"I" pedido à mão, sem implementação http, é recusado ao montar o cliente (não aqui)', () => {
    expect(lerConfigApi('I').I).toBe('http')
  })

  it('letra que não é grupo → erro claro', () => {
    expect(() => lerConfigApi('A,H')).toThrow('VITE_API inválida')
  })
})
