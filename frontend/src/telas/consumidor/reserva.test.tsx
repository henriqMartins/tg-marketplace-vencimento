import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { abrir, ANA } from '../../test/abrir'
import { AGORA_TESTE, criarPecas } from '../../test/pecas'

afterEach(() => {
  vi.useRealTimers()
})

/** Só o Date fica falso (timers reais): "hoje" passa a ser 22/10/2026, 16:00. */
function relogioDoAparelho(em: Date) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(em)
}

describe('C4 · Reserva da quantidade', () => {
  it('contador vai de 1 até o livre (6) e o botão mostra a prévia do total', async () => {
    const usuario = userEvent.setup()
    await abrir('/oferta/1', { email: ANA })
    const mais = await screen.findByRole('button', { name: 'Aumentar' })
    expect(screen.getByText('6 disponíveis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reservar 1 · R$ 3,14' })).toBeInTheDocument()
    for (let i = 0; i < 8; i++) await usuario.click(mais)
    expect(within(screen.getByRole('group', { name: 'Quantidade' })).getByRole('status')).toHaveTextContent('6')
    expect(mais).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reservar 6 · R$ 18,84' })).toBeInTheDocument()
  })

  it('"Retire até hoje, 20:00": horário que veio da API (PEDIDO-API 1), não calculado na tela', async () => {
    relogioDoAparelho(AGORA_TESTE)
    await abrir('/oferta/1', { email: ANA })
    expect(await screen.findByText('hoje, 20:00')).toBeInTheDocument()
    expect(screen.getByText(/\(janela de 4 h\)/)).toBeInTheDocument()
  })

  it('sem o campo do pedido (API real atual): mostra a janela e o fim da oferta', async () => {
    const pecas = criarPecas()
    const original = pecas.mock.consumidor.obterOferta
    pecas.mock.consumidor.obterOferta = async (id) => ({ ...(await original(id)), retirar_ate: undefined })
    await abrir('/oferta/1', { pecas, email: ANA })
    expect(await screen.findByText(/Janela de 4 h para retirar, até o fim da oferta \(27\/10, 23:59\)/)).toBeInTheDocument()
  })

  it('poucas unidades (livre ≤ 2): aviso de atenção', async () => {
    await abrir('/oferta/4', { email: ANA })
    expect(await screen.findByText(/Restam só 2 unidades\./)).toBeInTheDocument()
  })

  it('oferta encerrada: sem contador e botão "Indisponível"', async () => {
    await abrir('/oferta/6', { email: ANA })
    expect(await screen.findByText('Esta oferta já terminou.')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Quantidade' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Indisponível' })).toBeDisabled()
  })

  it('visitante: Reservar leva ao login e volta para a oferta', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/oferta/1')
    await usuario.click(await screen.findByRole('button', { name: /Reservar 1/ }))
    await waitFor(() => expect(caminhoAtual()).toBe('/entrar?voltar=%2Foferta%2F1'))
  })
})

describe('C5 · Resultado da reserva nos 3 estados, conforme a resposta da API', () => {
  it('confirmada → "Reservado!", horário e total que vieram da API', async () => {
    relogioDoAparelho(AGORA_TESTE)
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/oferta/1', { email: ANA })
    await usuario.click(await screen.findByRole('button', { name: 'Aumentar' }))
    await usuario.click(screen.getByRole('button', { name: 'Reservar 2 · R$ 6,28' }))

    expect(await screen.findByRole('heading', { name: 'Reservado!' })).toBeInTheDocument()
    expect(caminhoAtual()).toMatch(/^\/reserva\/\d+\/resultado$/)
    expect(screen.getByText('2 × Iogurte natural 170 g · Mercadinho Vila Nova')).toBeInTheDocument()
    expect(screen.getByText('Retire até hoje, 20:00. Você paga R$ 6,28 na loja.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Ver código de retirada' }))
    expect(await screen.findByRole('heading', { name: 'Código de retirada' })).toBeInTheDocument()
  })

  it('parcial → "Reservamos 1 de 2", manter ou cancelar', async () => {
    const usuario = userEvent.setup()
    const { mock } = await abrir('/oferta/4', { email: ANA }) // molho: livre 2
    await usuario.click(await screen.findByRole('button', { name: 'Aumentar' })) // quer 2
    await act(() => mock.consumidor.reservar(4, 1)) // alguém leva 1 antes do clique
    await usuario.click(screen.getByRole('button', { name: 'Reservar 2 · R$ 2,98' }))

    expect(await screen.findByRole('heading', { name: 'Reservamos 1 de 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Manter a unidade' })).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cancelar a reserva' }))
    const folha = screen.getByRole('dialog', { name: 'Cancelar esta reserva?' })
    await usuario.click(within(folha).getByRole('button', { name: 'Sim, cancelar' }))
    expect(await screen.findByText(/Você cancelou esta reserva/)).toBeInTheDocument()
    expect(screen.getByText('Reserva cancelada. As unidades voltaram para a vitrine.')).toBeInTheDocument()
  })

  it('recusada (409) → "Esgotou agora há pouco" e "Ver outras ofertas"', async () => {
    const usuario = userEvent.setup()
    const { mock, caminhoAtual } = await abrir('/oferta/4', { email: ANA })
    await screen.findByRole('button', { name: /Reservar 1/ })
    await act(() => mock.consumidor.reservar(4, 2)) // as duas últimas somem antes do clique
    await usuario.click(screen.getByRole('button', { name: /Reservar 1/ }))

    expect(await screen.findByRole('heading', { name: 'Esgotou agora há pouco' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Ver outras ofertas' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
  })
})

describe('C6 · Código de retirada e C7 · desfechos', () => {
  it('conta a partir do expira_em recebido e vira C7 quando a recarga traz "expirada"', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(AGORA_TESTE) // 16:00; a reserva 31 da Ana expira 19:42
    await abrir('/reservas/31', { email: ANA, agora: () => new Date() }) // mock segue o mesmo relógio
    await act(() => vi.advanceTimersByTimeAsync(50)) // carrega /eu e a reserva

    expect(screen.getByText('Código: 4 8 2 9 1 7')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('3 h 41 min') // faltam 3 h 41 min 59 s
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(screen.getByRole('timer')).toHaveTextContent('3 h 40 min')

    vi.setSystemTime(new Date('2026-10-22T19:43:00-03:00')) // passou do prazo
    await act(() => vi.advanceTimersByTimeAsync(30_000)) // recarga de 30 s
    expect(screen.getByText(/O prazo terminou/)).toBeInTheDocument()
    expect(screen.getByText('Código sem validade: 4 8 2 9 1 7')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver se ainda tem na vitrine' })).toBeInTheDocument()
  })

  it('não decide sozinha: relógio do aparelho passou, mas a API diz "reservada" → continua C6', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-22T19:50:00-03:00')) // aparelho adiantado
    await abrir('/reservas/31', { email: ANA }) // mock parado em 16:00: para o servidor ainda vale
    await act(() => vi.advanceTimersByTimeAsync(31_000))

    expect(screen.getByRole('timer')).toHaveTextContent('Conferindo com a loja…')
    expect(screen.getByText('Código: 4 8 2 9 1 7')).toBeInTheDocument()
    expect(screen.queryByText(/O prazo terminou/)).toBeNull()
  })

  it('menos de 30 min: contagem em destaque (urgent)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-22T19:20:00-03:00'))
    await abrir('/reservas/31', { email: ANA })
    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(screen.getByRole('timer')).toHaveTextContent('21 min') // faltam 21 min 59 s
    expect(screen.getByRole('timer').className).toMatch(/urgente/)
  })

  it('cancelar pela C6: folha de confirmação e depois o desfecho', async () => {
    const usuario = userEvent.setup()
    await abrir('/reservas/31', { email: ANA })
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar reserva' }))
    const folha = screen.getByRole('dialog', { name: 'Cancelar esta reserva?' })
    expect(folha).toHaveTextContent('As 2 unidades voltam para a vitrine na hora')
    await usuario.click(within(folha).getByRole('button', { name: 'Sim, cancelar' }))
    expect(await screen.findByText(/Você cancelou esta reserva/)).toBeInTheDocument()
  })

  it('retirada: valor pago e quanto economizou (vindos da API)', async () => {
    await abrir('/reservas/36', { email: ANA })
    expect(await screen.findByText('Você economizou R$ 2,80')).toBeInTheDocument()
    expect(screen.getByText(/Você pagou/)).toHaveTextContent('R$ 4,19')
  })

  it('reserva de outra pessoa → mensagem de não encontrada', async () => {
    await abrir('/reservas/32', { email: ANA })
    expect(await screen.findByRole('alert')).toHaveTextContent('Reserva não encontrada.')
  })
})

