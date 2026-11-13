import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
    expect(await within(ofertas).findByRole('link', { name: 'Iogurte natural 170 g' })).toHaveAttribute('href', '/loja/1/ofertas?oferta=1')
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

describe('G4 · Ofertas (desktop)', () => {
  const painel = () => screen.getByRole('region', { name: 'Detalhe da oferta' })
  const botaoOferta = (nome: string) => screen.getByRole('button', { name: nome })

  it('cartões: 3 somados da lista de ativas, perda do mês vinda dos indicadores', async () => {
    const pecas = criarPecas()
    vi.spyOn(pecas.mock.gestor, 'indicadores').mockResolvedValue(ESTRANHOS)
    await abrir('/loja/1/ofertas', { email: CARLOS, largura: DESKTOP, pecas })

    expect(await screen.findByRole('button', { name: 'Ativas (3)' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(cartao('Perda no mês')).toHaveTextContent('9 un.'))
    expect(cartao('Livres agora')).toHaveTextContent('14 un.') // 6 + 5 + 3
    expect(cartao('Reservadas aguardando')).toHaveTextContent('6 un.') // 4 + 2 + 0
    expect(cartao('Encerram em 48 h')).toHaveTextContent('1') // o queijo, que sai amanhã
    expect(screen.queryByRole('button', { name: /nova oferta/i })).not.toBeInTheDocument()
  })

  it('a linha escolhida fica marcada e o painel acompanha (primeira por padrão)', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/loja/1/ofertas', { email: CARLOS, largura: DESKTOP })

    await screen.findByRole('table')
    const primeira = screen.getAllByRole('button', { pressed: true }).find((b) => b.closest('tbody'))!
    expect(await within(painel()).findByRole('heading', { name: primeira.textContent! })).toBeInTheDocument()

    await usuario.click(botaoOferta('Presunto fatiado 200 g'))
    expect(caminhoAtual()).toBe('/loja/1/ofertas?oferta=2')
    expect(botaoOferta('Presunto fatiado 200 g')).toHaveAttribute('aria-pressed', 'true')
    expect(botaoOferta('Presunto fatiado 200 g').closest('tr')!.className).toMatch(/linhaEscolhida/)
    expect(primeira).toHaveAttribute('aria-pressed', 'false')
    expect(await within(painel()).findByRole('heading', { name: 'Presunto fatiado 200 g' })).toBeInTheDocument()
    expect(within(painel()).getByText('8 = 5 + 2 + 1 + 0 + 0')).toBeInTheDocument()
    expect(within(painel()).getByRole('link', { name: 'Ver reservas' })).toHaveAttribute(
      'href',
      '/loja/1/reservas?q=Presunto%20fatiado%20200%20g',
    )
  })

  it('encerradas: selo, perda explicada e ajuste desabilitado', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/loja/1/ofertas?oferta=1', { email: CARLOS, largura: DESKTOP })

    await usuario.click(await screen.findByRole('button', { name: /^Encerradas/ }))
    expect(caminhoAtual()).toBe('/loja/1/ofertas?aba=encerradas')
    // O painel é remontado ao trocar de aba: busca a seção de novo a cada tentativa.
    await waitFor(() => expect(within(painel()).getByText('Oferta encerrada')).toBeInTheDocument())
    expect(within(painel()).getByText(/como perda\./)).toBeInTheDocument()
    expect(within(painel()).getByRole('button', { name: 'Ajustar estoque' })).toBeDisabled()
  })

  it('"Ajustar estoque" abre a L11 num modal; o 409 é tratado igual e o painel se atualiza', async () => {
    const usuario = userEvent.setup()
    const { mock } = await abrir('/loja/1/ofertas?oferta=1', { email: CARLOS, largura: DESKTOP })

    const detalhe = await screen.findByRole('region', { name: 'Detalhe da oferta' })
    await usuario.click(await within(detalhe).findByRole('button', { name: 'Ajustar estoque' }))
    const modal = screen.getByRole('dialog', { name: 'Ajustar estoque' })
    const mais = await within(modal).findByRole('button', { name: 'Aumentar' })
    for (let i = 0; i < 5; i++) await usuario.click(mais)
    await usuario.click(within(modal).getByRole('radio', { name: 'Extraviada' }))

    await act(() => mock.consumidor.reservar(1, 1)) // um cliente reserva enquanto o gestor contava
    await usuario.click(within(modal).getByRole('button', { name: 'Registrar ajuste de 6 un.' }))
    expect(await within(modal).findByRole('alert')).toHaveTextContent('Só há 5 unidades livres agora.')
    await waitFor(() => expect(within(modal).getByRole('button', { name: 'Registrar ajuste de 5 un.' })).toBeInTheDocument())

    await usuario.click(within(modal).getByRole('button', { name: 'Registrar ajuste de 5 un.' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await within(painel()).findByText('12 = 0 + 5 + 2 + 5 + 0')).toBeInTheDocument()
    expect(screen.getByText('Ajuste registrado: 5 un. (Extraviada).')).toBeInTheDocument()
  })

  it('no celular o responsável continua vendo a L9', async () => {
    await abrir('/loja/1/ofertas', { email: CARLOS, largura: 390 })
    expect(await screen.findByRole('tablist', { name: 'Ofertas da loja' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Estado das ofertas' })).not.toBeInTheDocument()
  })
})

describe('G2 · Projeção da janela de reserva', () => {
  const cartaoValor = (rotulo: string) => screen.getByText(rotulo).closest('div')!

  it('sem filtro = Tabela 5, "Baseado em 5.000 rodadas simuladas"', async () => {
    await abrir('/loja/1/projecao', { email: CARLOS, largura: DESKTOP })

    expect(await screen.findByText(/Baseado em 5\.000 rodadas simuladas/)).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Tamanho do lote' })).toHaveAttribute('aria-valuetext', 'Todos')
    // Janela inicial 4 h
    expect(cartaoValor('Perda projetada')).toHaveTextContent('31,3%')
    expect(cartaoValor('Compradores bloqueados')).toHaveTextContent('13,8%')
    expect(cartaoValor('Taxa de retirada')).toHaveTextContent('53,3%')

    const tabela = screen.getByRole('table', { name: 'Projeção por janela de reserva' })
    const linhas = within(tabela).getAllByRole('row').slice(1).map((l) => l.textContent)
    expect(linhas).toEqual([
      '30 min92,60,64,6',
      '1 h74,21,316,1',
      '2 h48,45,434,7',
      '4 h31,313,853,3',
      '8 h24,919,564,5',
      '12 h23,721,267,4',
      '24 h24,421,867,4',
    ])
  })

  it('escolher outra janela (barra ou seletor) troca os cartões', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/projecao', { email: CARLOS, largura: DESKTOP })
    await usuario.click(await screen.findByRole('button', { name: 'Janela 1 h: perda 74,2%, bloqueados 1,3%' }))
    expect(cartaoValor('Perda projetada')).toHaveTextContent('74,2%')
    await usuario.click(within(screen.getByRole('group', { name: 'Janela de reserva' })).getByRole('button', { name: '24 h' }))
    expect(cartaoValor('Taxa de retirada')).toHaveTextContent('67,4%')
  })

  it('com filtro: só vale ao atualizar, vai à API e mostra o N menor que ela devolveu', async () => {
    const usuario = userEvent.setup()
    const pecas = criarPecas()
    const projecao = vi.spyOn(pecas.mock.projecao, 'projecao')
    const { caminhoAtual } = await abrir('/loja/1/projecao', { email: CARLOS, largura: DESKTOP, pecas })
    await screen.findByText(/Baseado em 5\.000/)
    expect(screen.getByRole('button', { name: 'Atualizar projeção' })).toBeDisabled()

    const lote = screen.getByRole('slider', { name: 'Tamanho do lote' })
    fireEvent.change(lote, { target: { value: '1' } })
    expect(lote).toHaveAttribute('aria-valuetext', '5–14 un.')
    expect(screen.getByText(/Baseado em 5\.000/)).toBeInTheDocument() // ainda não aplicou

    await usuario.click(screen.getByRole('button', { name: 'Atualizar projeção' }))
    expect(caminhoAtual()).toBe('/loja/1/projecao?lote=5-14')
    await waitFor(() => expect(projecao).toHaveBeenLastCalledWith(1, { lote: '5-14', procura: undefined, chegada: 2 }))
    const { rodadas } = await projecao.mock.results.at(-1)!.value
    expect(rodadas).toBeLessThan(5000)
    expect(
      await screen.findByText(new RegExp(`Baseado em ${rodadas.toLocaleString('pt-BR')} rodadas simuladas`)),
    ).toBeInTheDocument()
  })

  it('chegada de 4 h no mock: mensagem "só com a API real"', async () => {
    await abrir('/loja/1/projecao?chegada=4', { email: CARLOS, largura: DESKTOP })
    expect(await screen.findByRole('alert')).toHaveTextContent('Projeção com chegada de 4 h disponível só com a API real.')
  })

  it('nenhum texto recomenda janela', async () => {
    const { tela } = await abrir('/loja/1/projecao', { email: CARLOS, largura: DESKTOP })
    await screen.findByText(/Baseado em/)
    expect(tela.container.textContent).not.toMatch(/recomend|melhor janela|equilibra|ideal|sugerid/i)
  })
})
