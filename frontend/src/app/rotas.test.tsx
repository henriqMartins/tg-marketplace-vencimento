import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { abrir, ANA, CARLOS, JULIANA } from '../test/abrir'
import { LIMITE_SERVIDOR_MS } from './espera'

afterEach(() => {
  vi.useRealTimers()
})

describe('A1 · Abertura decide o destino depois da checagem do servidor (/api/saude)', () => {
  it('sem token → /entrar', async () => {
    const { caminhoAtual } = await abrir('/')
    await waitFor(() => expect(caminhoAtual()).toBe('/entrar'))
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('consumidora → /escolher (A4 vale para todos)', async () => {
    const { caminhoAtual } = await abrir('/', { email: ANA })
    await waitFor(() => expect(caminhoAtual()).toBe('/escolher'))
  })

  it('quem tem vínculo → /escolher (A4)', async () => {
    const { caminhoAtual } = await abrir('/', { email: CARLOS })
    await waitFor(() => expect(caminhoAtual()).toBe('/escolher'))
  })

  it('90 s sem resposta → "O servidor não respondeu" e Tentar de novo', async () => {
    vi.useFakeTimers()
    await abrir('/', { atrasoMs: 10 * 60_000 }) // servidor dormindo
    await act(() => vi.advanceTimersByTimeAsync(LIMITE_SERVIDOR_MS - 1))
    expect(screen.getByText('Conectando ao servidor…')).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(screen.getByRole('alert')).toHaveTextContent('O servidor não respondeu.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pular para o login' })).toHaveAttribute('href', '/entrar')
  })
})

describe('proteção por login e papel', () => {
  it('visitante em rota de conta → /entrar?voltar=<onde estava>', async () => {
    const { caminhoAtual } = await abrir('/reservas')
    await waitFor(() => expect(caminhoAtual()).toBe('/entrar?voltar=%2Freservas'))
  })

  it('visitante vê a vitrine (sem login)', async () => {
    await abrir('/vitrine')
    expect(await screen.findByRole('heading', { name: 'Ofertas perto de você' })).toBeInTheDocument()
  })

  it('consumidora numa loja → "Sem acesso"', async () => {
    await abrir('/loja/1', { email: ANA })
    expect(await screen.findByText('Sem acesso a esta loja')).toBeInTheDocument()
  })

  it('funcionária: opera a loja, mas não vê o painel', async () => {
    await abrir('/loja/1', { email: JULIANA })
    expect(await screen.findByRole('heading', { name: 'Mercadinho Vila Nova' })).toBeInTheDocument()
    screen.getByRole('link', { name: 'Retirada' }).click()
    expect(await screen.findByRole('heading', { name: /^Validar retirada/ })).toBeInTheDocument()
  })

  it('funcionária no painel → "Sem acesso"', async () => {
    await abrir('/loja/1/painel', { email: JULIANA })
    expect(await screen.findByText('Sem acesso a esta loja')).toBeInTheDocument()
  })

  it('responsável de outra loja não entra nesta', async () => {
    await abrir('/loja/2', { email: CARLOS })
    expect(await screen.findByText('Sem acesso a esta loja')).toBeInTheDocument()
  })

  it('401 no meio do uso → sessão encerrada e volta para /entrar', async () => {
    const { caminhoAtual, mock, consultas } = await abrir('/reservas', { email: ANA })
    expect(await screen.findByRole('heading', { name: 'Minhas reservas' })).toBeInTheDocument()

    await act(() => mock.acesso.sair()) // token deixou de valer no servidor
    await act(() => consultas.invalidateQueries({ queryKey: ['eu'] }))

    await waitFor(() => expect(caminhoAtual()).toBe('/entrar?voltar=%2Freservas'))
  })
})

describe('layouts', () => {
  it('responsável com tela de 1280 px: menu lateral do gestor, item ativo marcado', async () => {
    await abrir('/loja/1/painel', { email: CARLOS, largura: 1280 })
    const menu = await screen.findByRole('navigation', { name: 'Menu do gestor' })
    expect(within(menu).getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page')
    expect(within(menu).getByRole('link', { name: 'Operação da loja' })).toHaveAttribute('href', '/loja/1')
    expect(screen.queryByRole('navigation', { name: 'Navegação da loja' })).toBeNull()
  })

  it('responsável no celular: navegação inferior da loja', async () => {
    await abrir('/loja/1/painel', { email: CARLOS, largura: 390 })
    const nav = await screen.findByRole('navigation', { name: 'Navegação da loja' })
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Início', 'Lotes', 'Avisos', 'Retirada'])
    expect(screen.queryByRole('navigation', { name: 'Menu do gestor' })).toBeNull()
  })

  it('funcionária no computador continua com a navegação da loja', async () => {
    await abrir('/loja/1', { email: JULIANA, largura: 1280 })
    expect(await screen.findByRole('navigation', { name: 'Navegação da loja' })).toBeInTheDocument()
  })

  it('consumidora: Vitrine · Reservas · Perfil, com a página atual marcada', async () => {
    await abrir('/vitrine', { email: ANA })
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' })
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Vitrine', 'Reservas', 'Perfil'])
    expect(within(nav).getByRole('link', { name: 'Vitrine' })).toHaveAttribute('aria-current', 'page')
  })

  it('visitante: Vitrine · Entrar (o Entrar volta para onde estava)', async () => {
    await abrir('/vitrine')
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' })
    expect(within(nav).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar?voltar=%2Fvitrine')
  })

  it('endereço desconhecido → "Página não encontrada"', async () => {
    await abrir('/nao-existe')
    expect(await screen.findByText('Página não encontrada')).toBeInTheDocument()
  })
})
