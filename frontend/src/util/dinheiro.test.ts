import { describe, expect, it } from 'vitest'
import { lerPrecoDigitado, previaDesconto, previaTotal } from './dinheiro'

describe('dinheiro na tela', () => {
  it('prévia do total', () => {
    expect(previaTotal('3.14', 2)).toBe('6.28')
  })

  it('preço digitado', () => {
    expect(lerPrecoDigitado('6,99')).toBe('6.99')
    expect(lerPrecoDigitado('R$ 12,5')).toBe('12.50')
    expect(lerPrecoDigitado('7')).toBe('7.00')
    expect(lerPrecoDigitado('0,00')).toBeNull()
    expect(lerPrecoDigitado('6,999')).toBeNull()
    expect(lerPrecoDigitado('')).toBeNull()
  })

  it('prévia do desconto: mesma conta do backend (meio centavo para cima)', () => {
    expect(previaDesconto('4.49', 30)).toBe('3.14') // 3,143
    expect(previaDesconto('2.25', 50)).toBe('1.13') // 1,125
    expect(previaDesconto('6.99', 20)).toBe('5.59') // 5,592
  })
})
