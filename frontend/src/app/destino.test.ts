import { describe, expect, it } from 'vitest'
import type { Eu } from '../api'
import { caminhoInternoSeguro, destinoAposEntrar } from './destino'

const consumidora: Eu = { id: 7, nome: 'Ana Souza', email: 'ana@email.com', vinculos: [], plataforma: false, interesse: null }
const responsavel: Eu = {
  id: 1, nome: 'Carlos Lima', email: 'carlos@vilanova.com.br',
  vinculos: [{ loja: { id: 1, nome: 'Mercadinho Vila Nova' }, papel: 'responsavel' }],
  plataforma: false, interesse: null,
}
const funcionaria: Eu = {
  id: 2, nome: 'Juliana Prado', email: 'juliana.prado@email.com',
  vinculos: [{ loja: { id: 1, nome: 'Mercadinho Vila Nova' }, papel: 'funcionario' }],
  plataforma: false, interesse: null,
}
const equipe: Eu = { id: 20, nome: 'Equipe', email: 'equipe@example.com', vinculos: [], plataforma: true, interesse: null }

describe('destino depois de entrar: sempre a A4, salvo ?voltar= ou escolha lembrada', () => {
  it.each([
    ['consumidora no celular', consumidora, false],
    ['consumidora no computador', consumidora, true],
    ['responsável no celular', responsavel, false],
    ['responsável no computador', responsavel, true],
    ['funcionária no computador', funcionaria, true],
    ['equipe da plataforma', equipe, true],
  ])('%s → /escolher', (_nome, eu, desktop) => {
    expect(destinoAposEntrar(eu, { desktop })).toBe('/escolher')
  })

  it('volta para onde estava, se for caminho interno', () => {
    expect(destinoAposEntrar(responsavel, { desktop: false, voltar: '/reservas/31' })).toBe('/reservas/31')
    expect(destinoAposEntrar(consumidora, { desktop: true, voltar: '/convite/abc' })).toBe('/convite/abc')
  })

  it('escolha lembrada vale enquanto o vínculo existir', () => {
    expect(destinoAposEntrar(responsavel, { desktop: false, escolhaLembrada: { tipo: 'loja', lojaId: 1 } })).toBe('/loja/1')
    expect(destinoAposEntrar(responsavel, { desktop: true, escolhaLembrada: { tipo: 'loja', lojaId: 1 } })).toBe('/loja/1/painel')
    expect(destinoAposEntrar(consumidora, { desktop: false, escolhaLembrada: { tipo: 'comprar' } })).toBe('/vitrine')
    // perdeu o vínculo com a loja 9: ignora a escolha
    expect(destinoAposEntrar(responsavel, { desktop: false, escolhaLembrada: { tipo: 'loja', lojaId: 9 } })).toBe('/escolher')
  })

  it('"plataforma" lembrada só vale para quem ainda é da equipe', () => {
    expect(destinoAposEntrar(equipe, { desktop: true, escolhaLembrada: { tipo: 'plataforma' } })).toBe('/plataforma')
    expect(destinoAposEntrar(consumidora, { desktop: true, escolhaLembrada: { tipo: 'plataforma' } })).toBe('/escolher')
  })

  it('nunca manda para fora do app (open redirect)', () => {
    for (const ruim of ['//site-falso.com', 'https://site-falso.com', '/\\site-falso.com', 'reservas', '', null]) {
      expect(caminhoInternoSeguro(ruim), String(ruim)).toBeNull()
    }
    expect(destinoAposEntrar(consumidora, { desktop: false, voltar: '//site-falso.com' })).toBe('/escolher')
  })
})
