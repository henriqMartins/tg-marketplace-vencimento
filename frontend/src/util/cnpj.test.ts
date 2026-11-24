import { describe, expect, it } from 'vitest'
import { cnpjValido, completarCnpj, mascararCnpj } from './cnpj'

describe('CNPJ', () => {
  it('máscara, inclusive enquanto digita', () => {
    expect(mascararCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(mascararCnpj('11222')).toBe('11.222')
    expect(mascararCnpj('11.222.333/0001-81 extra 99')).toBe('11.222.333/0001-81')
  })

  it('dígitos verificadores', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11222333000182')).toBe(false) // último dígito errado
    expect(cnpjValido('1122233300018')).toBe(false) // 13 dígitos
    expect(cnpjValido('00000000000000')).toBe(false)
  })

  it('completar gera um CNPJ válido', () => {
    expect(completarCnpj('112223330001')).toBe('11222333000181')
    expect(cnpjValido(completarCnpj('487310450001'))).toBe(true)
  })
})
