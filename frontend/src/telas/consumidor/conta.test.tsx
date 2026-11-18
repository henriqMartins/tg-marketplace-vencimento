import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lembrarEscolha, lerEscolha } from '../../app/escolha'
import { abrir, ANA, CARLOS } from '../../test/abrir'
import { AGORA_TESTE } from '../../test/pecas'

afterEach(() => {
  vi.useRealTimers()
})

describe('C8 · Minhas reservas', () => {
  it('Ativas (1): código e tempo restante; o card leva ao código (C6)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(AGORA_TESTE)
    await abrir('/reservas', { email: ANA })
    expect(await screen.findByRole('tab', { name: 'Ativas (1)' })).toHaveAttribute('aria-selected', 'true')
    const cartao = await screen.findByRole('link', { name: /Iogurte natural 170 g/ })
    expect(cartao).toHaveAttribute('href', '/reservas/31')
    expect(cartao).toHaveTextContent('Código 482 917')
    expect(cartao).toHaveTextContent('faltam 3 h 42 min')
    expect(cartao).toHaveTextContent('2 unidades · Mercadinho Vila Nova')
  })

  it('menos de 30 min: tempo em destaque (urgent)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-22T19:20:00-03:00'))
    await abrir('/reservas', { email: ANA })
    const tempo = await screen.findByText(/faltam 22 min/)
    expect(tempo.className).toMatch(/urgente/)
  })

  it('Histórico: encerradas da mais recente para a mais antiga, com o desfecho', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/reservas', { email: ANA })
    await usuario.click(await screen.findByRole('tab', { name: 'Histórico' }))
    expect(caminhoAtual()).toBe('/reservas?aba=historico')

    const painel = await screen.findByRole('tabpanel', { name: 'Histórico' })
    await waitFor(() => expect(within(painel).getAllByRole('link')).toHaveLength(3))
    const textos = within(painel).getAllByRole('link').map((l) => l.textContent)
    expect(textos[0]).toMatch(/Requeijão cremoso 200 g.*Retirada.*Retirada em/)
    expect(textos[1]).toMatch(/Biscoito recheado 140 g.*Expirada.*Expirou em/)
    expect(textos[2]).toMatch(/Queijo minas frescal 250 g.*Cancelada.*Cancelada em/)
  })

  it('setas do teclado trocam de aba', async () => {
    const usuario = userEvent.setup()
    await abrir('/reservas', { email: ANA })
    const ativas = await screen.findByRole('tab', { name: /Ativas/ })
    ativas.focus()
    await usuario.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Histórico' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Histórico' })).toHaveFocus()
  })

  it('sem ativas: estado vazio com "Ver ofertas"', async () => {
    const usuario = userEvent.setup()
    const primeira = await abrir('/vitrine', { email: ANA })
    await act(() => primeira.mock.consumidor.cancelarReserva(31))
    primeira.tela.unmount()
    const pecas = primeira.pecas
    const { caminhoAtual } = await abrir('/reservas', { pecas })
    expect(await screen.findByText('Nenhuma reserva ativa')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Ver ofertas' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
  })
})

describe('C9 · Perfil', () => {
  it('consumidora: iniciais, e-mail, avisos só desenhados e sem "Minhas lojas"', async () => {
    await abrir('/perfil', { email: ANA })
    expect(await screen.findByRole('heading', { name: 'Ana Souza' })).toBeInTheDocument()
    expect(screen.getByText('AS')).toBeInTheDocument()
    expect(screen.getByText('ana@email.com')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Avisos de oferta nova' })).toBeDisabled()
    expect(screen.getByRole('link', { name: /Localização/ })).toHaveTextContent('Não definida · não fica gravada')
    expect(screen.queryByRole('heading', { name: 'Minhas lojas' })).toBeNull()
  })

  it('sair da conta → /entrar, sem token', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual, armazem } = await abrir('/perfil', { email: ANA })
    await usuario.click(await screen.findByRole('button', { name: 'Sair da conta' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/entrar'))
    expect(armazem.obterToken()).toBeNull()
  })

  it('responsável: "Minhas lojas" com o papel e "Entrar como loja"', async () => {
    await abrir('/perfil', { email: CARLOS })
    const secao = await screen.findByRole('region', { name: 'Minhas lojas' })
    expect(within(secao).getByText('Responsável')).toBeInTheDocument()
    expect(within(secao).getByRole('link', { name: 'Entrar como loja' })).toHaveAttribute('href', '/loja/1')
    expect(secao).toHaveTextContent('Ao abrir o app: Perguntar sempre')
  })

  it('consumidora também troca a escolha lembrada (a A4 vale para todos)', async () => {
    const usuario = userEvent.setup()
    lembrarEscolha(7, { tipo: 'comprar' })
    const { caminhoAtual } = await abrir('/perfil', { email: ANA })
    const preferencias = await screen.findByRole('region', { name: 'Preferências' })
    expect(preferencias).toHaveTextContent('Ao abrir o app: Comprar com desconto')
    await usuario.click(within(preferencias).getByRole('button', { name: 'Escolher de novo' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/escolher'))
    expect(lerEscolha(7)).toBeNull()
  })

  it('"Escolher de novo" desfaz a escolha lembrada (A4) e abre a A4', async () => {
    const usuario = userEvent.setup()
    lembrarEscolha(1, { tipo: 'loja', lojaId: 1 }) // Carlos tinha marcado "lembrar"
    const { caminhoAtual } = await abrir('/perfil', { email: CARLOS })
    const secao = await screen.findByRole('region', { name: 'Minhas lojas' })
    expect(secao).toHaveTextContent('Ao abrir o app: Mercadinho Vila Nova')
    await usuario.click(within(secao).getByRole('button', { name: 'Escolher de novo' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/escolher'))
    expect(lerEscolha(1)).toBeNull()
  })
})
