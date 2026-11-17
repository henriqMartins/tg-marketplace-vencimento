import { describe, expect, it } from 'vitest'
import { hojeEmBrasilia, intervaloDo, lerPeriodo } from './periodo'

describe('períodos do gestor', () => {
  const agora = new Date('2026-10-22T16:00:00-03:00')

  it('7 dias, 30 dias e mês atual terminam hoje (inclusive)', () => {
    expect(intervaloDo('7d', agora)).toEqual({ de: '2026-10-16', ate: '2026-10-22' })
    expect(intervaloDo('30d', agora)).toEqual({ de: '2026-09-23', ate: '2026-10-22' })
    expect(intervaloDo('mes', agora)).toEqual({ de: '2026-10-01', ate: '2026-10-22' })
  })

  it('"hoje" é o dia em Brasília, não em UTC', () => {
    expect(hojeEmBrasilia(new Date('2026-10-23T01:30:00Z'))).toBe('2026-10-22') // 22:30 em Brasília
  })

  it('valor desconhecido na URL vira o padrão (mês atual)', () => {
    expect(lerPeriodo('xyz')).toBe('mes')
    expect(lerPeriodo(null)).toBe('mes')
    expect(lerPeriodo('7d')).toBe('7d')
  })
})
