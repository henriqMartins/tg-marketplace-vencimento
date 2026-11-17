import { describe, expect, it } from 'vitest'
import type { Eu } from '../api'
import { caminhoInternoSeguro, destinoAposEntrar } from './destino'

const consumidora: Eu = { id: 7, nome: 'Ana Souza', email: 'ana@email.com', vinculos: [] }
const responsavel: Eu = {
  id: 1, nome: 'Carlos Lima', email: 'carlos@vilanova.com.br',
  vinculos: [{ loja: { id: 1, nome: 'Mercadinho Vila Nova' }, papel: 'responsavel' }],
}
const funcionaria: Eu = {
  id: 2, nome: 'Juliana Prado', email: 'juliana.prado@email.com',
  vinculos: [{ loja: { id: 1, nome: 'Mercadinho Vila Nova' }, papel: 'funcionario' }],
}
const duasLojas: Eu = {
  ...responsavel,
  vinculos: [...responsavel.vinculos, { loja: { id: 2, nome: 'Empório Santa Cruz' }, papel: 'funcionario' }],
}

describe('destino depois de entrar', () => {
  it.each([
    ['consumidora no celular', consumidora, false, '/vitrine'],
    ['consumidora no computador', consumidora, true, '/vitrine'],
    ['responsável no celular', responsavel, false, '/escolher'],
    ['responsável no computador', responsavel, true, '/loja/1/painel'],
    ['funcionária no celular', funcionaria, false, '/escolher'],
    ['funcionária no computador', funcionaria, true, '/loja/1'],
    ['duas lojas no computador', duasLojas, true, '/escolher'],
  ])('%s → %s', (_nome, eu, desktop, esperado) => {
    expect(destinoAposEntrar(eu, { desktop })).toBe(esperado)
  })

  it('volta para onde estava, se for caminho interno', () => {
    expect(destinoAposEntrar(responsavel, { desktop: false, voltar: '/reservas/31' })).toBe('/reservas/31')
  })

  it('escolha lembrada vale enquanto o vínculo existir', () => {
    expect(destinoAposEntrar(responsavel, { desktop: false, escolhaLembrada: { tipo: 'loja', lojaId: 1 } })).toBe('/loja/1')
    expect(destinoAposEntrar(responsavel, { desktop: false, escolhaLembrada: { tipo: 'comprar' } })).toBe('/vitrine')
    // perdeu o vínculo com a loja 9: ignora a escolha
    expect(destinoAposEntrar(responsavel, { desktop: false, escolhaLembrada: { tipo: 'loja', lojaId: 9 } })).toBe('/escolher')
  })

  it('nunca manda para fora do app (open redirect)', () => {
    for (const ruim of ['//site-falso.com', 'https://site-falso.com', '/\\site-falso.com', 'reservas', '', null]) {
      expect(caminhoInternoSeguro(ruim), String(ruim)).toBeNull()
    }
    expect(destinoAposEntrar(consumidora, { desktop: false, voltar: '//site-falso.com' })).toBe('/vitrine')
  })
})
