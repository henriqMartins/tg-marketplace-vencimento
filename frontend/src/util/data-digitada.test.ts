import { describe, expect, it } from 'vitest'
import { mascararData, paraDataIso } from './data-digitada'

describe('validade digitada', () => {
  it('máscara progressiva, só com dígitos', () => {
    expect(mascararData('2')).toBe('2')
    expect(mascararData('2210')).toBe('22/10')
    expect(mascararData('22102026')).toBe('22/10/2026')
    expect(mascararData('22/10/20261')).toBe('22/10/2026')
    expect(mascararData('ab22-1')).toBe('22/1')
  })

  it('só datas completas que existem viram ISO', () => {
    expect(paraDataIso('18/12/2026')).toBe('2026-12-18')
    expect(paraDataIso('29/02/2028')).toBe('2028-02-29')
    expect(paraDataIso('29/02/2027')).toBeNull()
    expect(paraDataIso('31/04/2027')).toBeNull()
    expect(paraDataIso('18/12/26')).toBeNull()
  })
})
