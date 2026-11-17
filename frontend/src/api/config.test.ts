import { describe, expect, it } from 'vitest'
import { lerConfigApi } from './config'

describe('lerConfigApi (VITE_API)', () => {
  it('vazio ou "mock" → tudo no mock', () => {
    for (const valor of [undefined, '', 'mock', ' MOCK ']) {
      expect(Object.values(lerConfigApi(valor)).every((v) => v === 'mock')).toBe(true)
    }
  })

  it('"http" → tudo na API real', () => {
    expect(Object.values(lerConfigApi('http')).every((v) => v === 'http')).toBe(true)
  })

  it('"A,b" → só A e B na API real', () => {
    expect(lerConfigApi('A, b')).toEqual({
      A: 'http', B: 'http', C: 'mock', D: 'mock', E: 'mock', F: 'mock', G: 'mock',
    })
  })

  it('letra que não é grupo → erro claro', () => {
    expect(() => lerConfigApi('A,H')).toThrow('VITE_API inválida')
  })
})
