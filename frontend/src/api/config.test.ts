import { describe, expect, it } from 'vitest'
import { lerConfigApi } from './config'

describe('lerConfigApi (VITE_API)', () => {
  it('vazio ou "mock" → tudo no mock', () => {
    for (const valor of [undefined, '', 'mock', ' MOCK ']) {
      expect(Object.values(lerConfigApi(valor)).every((v) => v === 'mock')).toBe(true)
    }
  })

  it('"http" → todos os grupos ✅ (A–G e I) na API real', () => {
    expect(lerConfigApi('http')).toEqual({
      A: 'http', B: 'http', C: 'http', D: 'http', E: 'http', F: 'http', G: 'http', I: 'http',
    })
  })

  it('"A,b" → só A e B na API real', () => {
    expect(lerConfigApi('A, b')).toEqual({
      A: 'http', B: 'http', C: 'mock', D: 'mock', E: 'mock', F: 'mock', G: 'mock', I: 'mock',
    })
  })

  it('letra que não é grupo → erro claro', () => {
    expect(() => lerConfigApi('A,H')).toThrow('VITE_API inválida')
  })
})
