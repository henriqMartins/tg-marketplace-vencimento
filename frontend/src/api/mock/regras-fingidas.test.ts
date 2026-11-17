import { describe, expect, it } from 'vitest'
import { fimDaOferta, fitaDe, novoCodigo } from './regras-fingidas'
import { isoBrasilia } from './datas'

describe('regras fingidas do mock', () => {
  it('fita pelo bimestre da validade (data absoluta), com o ano', () => {
    expect(fitaDe('2026-01-15')).toEqual({ cor: 'vermelho', bimestre: 'jan–fev', ano: 2026 })
    expect(fitaDe('2026-10-28')).toEqual({ cor: 'branco', bimestre: 'set–out', ano: 2026 })
    expect(fitaDe('2025-12-22')).toEqual({ cor: 'preto', bimestre: 'nov–dez', ano: 2025 })
  })

  it('fim = 23:59 do dia (validade − margem), virando o mês', () => {
    expect(isoBrasilia(fimDaOferta('2026-11-05', 1))).toBe('2026-11-04T23:59:00-03:00')
    expect(isoBrasilia(fimDaOferta('2026-11-01', 1))).toBe('2026-10-31T23:59:00-03:00')
  })

  it('código de 6 dígitos que não repete um ativo da loja', () => {
    const sorteios = [0.3829, 0.3829, 0.5]
    const codigo = novoCodigo(new Set(['444610']), () => sorteios.shift()!)
    expect(codigo).toBe('550000')
  })
})
