import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { abrir, CARLOS, JULIANA } from '../../test/abrir'
import { AGORA_TESTE } from '../../test/pecas'

afterEach(() => {
  vi.useRealTimers()
})

const indicador = (rotulo: string) => screen.getByText(rotulo).closest('div')!

describe('L1 · Início da loja', () => {
  it('mostra os números do resumo do dia sem recalcular (4 · 2 · 3)', async () => {
    await abrir('/loja/1', { email: JULIANA })
    expect(await screen.findByRole('heading', { name: 'Mercadinho Vila Nova' })).toBeInTheDocument()
    await waitFor(() => expect(indicador('Aguardando retirada')).toHaveTextContent('4'))
    expect(indicador('Expiram em menos de 1 h')).toHaveTextContent('2')
    expect(indicador('Ofertas ativas')).toHaveTextContent('3')
    expect(screen.getByRole('link', { name: /Avisos de validade/ })).toHaveTextContent('4 para conferir')
  })

  it('funcionária: Configurações (só para consultar) e sem a faixa do painel', async () => {
    await abrir('/loja/1', { email: JULIANA })
    await screen.findByRole('heading', { name: 'Mercadinho Vila Nova' })
    expect(screen.getByText('Funcionário')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Configurações da loja' })).toHaveAttribute('href', '/loja/1/config')
    expect(screen.queryByRole('link', { name: /Painel e projeção/ })).toBeNull()
  })

  it('responsável: Configurações, faixa do painel e trocar perfil', async () => {
    await abrir('/loja/1', { email: CARLOS })
    await screen.findByRole('heading', { name: 'Mercadinho Vila Nova' })
    expect(screen.getByRole('link', { name: 'Configurações da loja' })).toHaveAttribute('href', '/loja/1/config')
    expect(screen.getByRole('link', { name: /Painel e projeção/ })).toHaveAttribute('href', '/loja/1/painel')
    expect(screen.getByRole('link', { name: 'Trocar perfil' })).toHaveAttribute('href', '/escolher')
    expect(screen.getByRole('link', { name: /Validar retirada/ })).toHaveAttribute('href', '/loja/1/retirada')
  })

  it('navegação da loja: contador de avisos vindo do resumo', async () => {
    await abrir('/loja/1', { email: JULIANA })
    const nav = await screen.findByRole('navigation', { name: 'Navegação da loja' })
    await waitFor(() => expect(within(nav).getByRole('link', { name: /Avisos/ })).toHaveTextContent('4 para conferir'))
  })
})

describe('L9 · Ofertas da loja', () => {
  it('ativas: barra + resumo em texto; fim de amanhã em destaque', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(AGORA_TESTE)
    await abrir('/loja/1/ofertas', { email: JULIANA })
    expect(await screen.findByRole('tab', { name: 'Ativas (3)' })).toHaveAttribute('aria-selected', 'true')
    const iogurte = await screen.findByRole('link', { name: /Iogurte natural 170 g/ })
    expect(iogurte).toHaveTextContent('6 livres · 4 reservadas · 2 retiradas')
    expect(iogurte).toHaveTextContent('Fita Branco · vence 28/10/2026')
    expect(iogurte).toHaveAttribute('href', '/loja/1/ofertas/1')

    const queijo = screen.getByRole('link', { name: /Queijo minas/ })
    expect(within(queijo).getByText('até amanhã, 23:59').className).toMatch(/urgente/)
    expect(screen.getByRole('list', { name: 'Legenda da barra de estoque' })).toBeInTheDocument()
  })

  it('encerradas: o requeijão com ajuste e perda', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/ofertas', { email: JULIANA })
    await usuario.click(await screen.findByRole('tab', { name: 'Encerradas' }))
    const requeijao = await screen.findByRole('link', { name: /Requeijão cremoso/ })
    expect(requeijao).toHaveTextContent('0 livres · 6 retiradas · 1 ajustada · 3 de perda')
  })
})

describe('L10 · Detalhe da oferta', () => {
  it('ativa: caixas, fórmula com os números da API, códigos mascarados e ações', async () => {
    await abrir('/loja/1/ofertas/1', { email: JULIANA })
    expect(await screen.findByRole('heading', { name: 'Iogurte natural 170 g' })).toBeInTheDocument()
    expect(screen.getByText('Oferta ativa')).toBeInTheDocument()
    expect(screen.getByText('12 = 6 + 4 + 2 + 0 + 0')).toBeInTheDocument()
    expect(screen.getByText('Livre').closest('div')).toHaveTextContent('6')

    const reservas = screen.getByRole('region', { name: 'Reservas aguardando retirada' })
    expect(within(reservas).getAllByRole('listitem')).toHaveLength(3)
    expect(reservas).toHaveTextContent('Código terminado em 917')
    expect(reservas).not.toHaveTextContent('482917') // a loja nunca vê o código inteiro

    expect(screen.getByRole('link', { name: 'Ajustar estoque' })).toHaveAttribute('href', '/loja/1/ofertas/1/ajuste')
    expect(screen.getByRole('link', { name: 'Validar retirada' })).toHaveAttribute('href', '/loja/1/retirada')
  })

  it('encerrada: perda explicada, estado final das reservas e sem ações', async () => {
    await abrir('/loja/1/ofertas/6', { email: JULIANA })
    expect(await screen.findByText(/3 unidades livres foram registradas como perda/)).toBeInTheDocument()
    expect(screen.getByText('10 = 0 + 0 + 6 + 1 + 3')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Reservas' })).getByText('Retirada')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ajustar estoque' })).toBeNull()
  })

  it('oferta de outra loja → não encontrada', async () => {
    await abrir('/loja/1/ofertas/3', { email: JULIANA }) // a 3 é do Empório Santa Cruz
    expect(await screen.findByRole('alert')).toHaveTextContent('Oferta não encontrada.')
  })
})
