import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Indicadores } from '../../api'
import { abrir, CARLOS } from '../../test/abrir'
import { AGORA_TESTE, criarPecas } from '../../test/pecas'

const DESKTOP = 1280

// O período ("mês atual") sai do relógio do aparelho: fixa só a data, não os timers.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA_TESTE)
})
afterEach(() => vi.useRealTimers())

/** Números de propósito INCOERENTES: 80 ÷ 120 daria 66,7%, mas a API manda 0,5. */
const ESTRANHOS: Indicadores = {
  de: '2026-10-01',
  ate: '2026-10-22',
  reservas_criadas: 148,
  encerradas: { total: 120, retiradas: 80, expiradas: 25, canceladas: 15 },
  taxa_retirada: 0.5,
  taxa_expiracao: 0.208,
  bloqueados: { total: 23, recusas: 17, parciais: 6 },
  perda_unidades: 9,
  semanas: [{ inicio: '2026-09-28', retiradas: 12, expiradas: 4, canceladas: 2 }],
}

const cartao = (rotulo: string) => screen.getByText(rotulo).closest('div')!

describe('G1 · Painel de acompanhamento', () => {
  it('exibe os números recebidos SEM recalcular (taxa da API, não a conta da tela)', async () => {
    const pecas = criarPecas()
    const indicadores = vi.spyOn(pecas.mock.gestor, 'indicadores').mockResolvedValue(ESTRANHOS)
    await abrir('/loja/1/painel', { email: CARLOS, largura: DESKTOP, pecas })

    await waitFor(() => expect(cartao('Taxa de retirada')).toHaveTextContent('50%'))
    expect(cartao('Taxa de retirada')).not.toHaveTextContent('66,7%')
    expect(cartao('Taxa de retirada')).toHaveTextContent('das reservas encerradas · 80 de 120')
    expect(cartao('Taxa de expiração')).toHaveTextContent('20,8%')
    expect(cartao('Reservas criadas')).toHaveTextContent('148')
    expect(cartao('Perda no encerramento')).toHaveTextContent('9 un.')
    expect(indicadores).toHaveBeenCalledWith(1, '2026-10-01', '2026-10-22') // mês atual
    expect(screen.getByText('Indicadores lidos do banco · 01/10/2026 a 22/10/2026')).toBeInTheDocument()
  })

  it('compradores bloqueados: total grande e a divisão embaixo', async () => {
    const pecas = criarPecas()
    vi.spyOn(pecas.mock.gestor, 'indicadores').mockResolvedValue(ESTRANHOS)
    await abrir('/loja/1/painel', { email: CARLOS, largura: DESKTOP, pecas })

    await waitFor(() => expect(cartao('Compradores bloqueados')).toHaveTextContent('23'))
    expect(cartao('Compradores bloqueados')).toHaveTextContent('17 sem nada · 6 levaram menos do que pediram')
  })

  it('taxa null (nenhuma reserva encerrada) aparece como "—", não como 0%', async () => {
    const pecas = criarPecas()
    vi.spyOn(pecas.mock.gestor, 'indicadores').mockResolvedValue({
      ...ESTRANHOS,
      encerradas: { total: 0, retiradas: 0, expiradas: 0, canceladas: 0 },
      taxa_retirada: null,
      taxa_expiracao: null,
    })
    await abrir('/loja/1/painel', { email: CARLOS, largura: DESKTOP, pecas })

    await waitFor(() => expect(cartao('Taxa de retirada')).toHaveTextContent('—'))
    expect(cartao('Taxa de expiração')).toHaveTextContent('—')
    expect(cartao('Taxa de retirada')).not.toHaveTextContent('0%')
  })

  it('trocar o período pede outro intervalo à API e fica na URL', async () => {
    const usuario = userEvent.setup()
    const pecas = criarPecas()
    const indicadores = vi.spyOn(pecas.mock.gestor, 'indicadores')
    const { caminhoAtual } = await abrir('/loja/1/painel', { email: CARLOS, largura: DESKTOP, pecas })

    await usuario.click(await screen.findByRole('button', { name: '7 dias' }))
    await waitFor(() => expect(indicadores).toHaveBeenLastCalledWith(1, '2026-10-16', '2026-10-22'))
    expect(caminhoAtual()).toBe('/loja/1/painel?periodo=7d')
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('gráfico semanal: cada barra tem descrição em texto e há a tabela equivalente', async () => {
    const pecas = criarPecas()
    vi.spyOn(pecas.mock.gestor, 'indicadores').mockResolvedValue(ESTRANHOS)
    await abrir('/loja/1/painel', { email: CARLOS, largura: DESKTOP, pecas })

    expect(await screen.findByRole('img', { name: 'Semana de 28/09: 12 retiradas, 4 expiradas, 2 canceladas' })).toBeInTheDocument()
    const tabela = screen.getByRole('table', { name: 'Desfecho das reservas por semana' })
    expect(within(tabela).getByRole('row', { name: '28/09 12 4 2' })).toBeInTheDocument()
  })

  it('tabelas do grupo C: ofertas ativas e reservas em andamento (a que vence antes primeiro)', async () => {
    await abrir('/loja/1/painel', { email: CARLOS, largura: DESKTOP })

    const ofertas = await screen.findByRole('region', { name: 'Ofertas ativas' })
    expect(await within(ofertas).findByRole('link', { name: 'Iogurte natural 170 g' })).toHaveAttribute('href', '/loja/1/ofertas/1')
    expect(within(ofertas).getByRole('link', { name: 'Queijo minas frescal 250 g' })).toBeInTheDocument()

    const andamento = screen.getByRole('region', { name: 'Reservas em andamento' })
    const linhas = await within(andamento).findAllByRole('row')
    // cabeçalho + 4 reservas da loja 1 (a 35 é de outra loja)
    expect(linhas).toHaveLength(5)
    expect(linhas[1]).toHaveTextContent('••• 033Presunto fatiado 200 g222 min')
    expect(linhas[4]).toHaveTextContent('••• 204')
  })
})

describe('G3 · Histórico de reservas', () => {
  it('cabeçalho com o período e os totais que a API devolveu', async () => {
    const { mock } = await abrir('/loja/1/reservas', { email: CARLOS, largura: DESKTOP })
    const h = await mock.gestor.historico(1, { de: '2026-10-01', ate: '2026-10-22' })
    expect(
      await screen.findByText(`01/10/2026 a 22/10/2026 · ${h.total_reservas} reservas · ${h.total_recusas} recusas`),
    ).toBeInTheDocument()
    expect(screen.getByText(/Recusa = tentativa de reservar com estoque livre zero/)).toBeInTheDocument()
  })

  it('chip "Recusas" filtra pela API: "0 / n", sem código, selo Recusa', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/loja/1/reservas', { email: CARLOS, largura: DESKTOP })
    await screen.findAllByRole('row')

    await usuario.click(screen.getByRole('button', { name: 'Recusas' }))
    expect(caminhoAtual()).toBe('/loja/1/reservas?estado=recusa')
    await waitFor(() => {
      const linhas = within(screen.getByRole('region', { name: 'Histórico de reservas' })).getAllByRole('row').slice(1)
      expect(linhas.length).toBeGreaterThan(0)
      for (const linha of linhas) {
        const celulas = within(linha).getAllByRole('cell')
        expect(celulas[1]).toHaveTextContent('—')
        expect(celulas[3].textContent).toMatch(/^0 \/ \d$/)
        expect(celulas[5]).toHaveTextContent('Recusa')
      }
    })
  })

  it('reserva parcial aparece como "reservado / pedido" (ex.: 2 / 3)', async () => {
    await abrir('/loja/1/reservas', { email: CARLOS, largura: DESKTOP })
    const linhas = (await screen.findAllByRole('row')).slice(1)
    const parciais = linhas.filter((l) => {
      const [q, p] = (within(l).getAllByRole('cell')[3].textContent ?? '').split(' / ').map(Number)
      return q > 0 && q < p
    })
    expect(parciais.length).toBeGreaterThan(0)
  })

  it('busca pelo final do código (vem da URL) e mostra só o que a API achou', async () => {
    await abrir('/loja/1/reservas?q=917', { email: CARLOS, largura: DESKTOP })
    expect(await screen.findByRole('searchbox', { name: 'Buscar por produto ou código' })).toHaveValue('917')
    const linhas = await screen.findAllByRole('row')
    expect(linhas[1]).toHaveTextContent('••• 917Iogurte natural 170 g2 / 2Ana S.Reservada')
  })
})
