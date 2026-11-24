import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pedido } from '../../api'
import { USUARIO } from '../../api/mock/semente'
import { CHAVE_VISITANTE, chaveDaConta, type ItemCarrinho } from '../../carrinho/carrinho'
import { abrir, ANA, JULIANA } from '../../test/abrir'
import { AGORA_TESTE, criarPecas } from '../../test/pecas'

afterEach(() => {
  vi.useRealTimers()
})

/** Só o Date fica falso (timers reais): "hoje" passa a ser 22/10/2026, 16:00. */
function relogioDoAparelho(em: Date) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(em)
}

// Ofertas da semente (loja 1 = Mercadinho Vila Nova; loja 2 = Empório Santa Cruz).
const IOGURTE: ItemCarrinho = { ofertaId: 1, lojaId: 1, lojaNome: 'Mercadinho Vila Nova', produto: 'Iogurte natural 170 g', preco: '3.14', pedido: 2 }
const PRESUNTO: ItemCarrinho = { ofertaId: 2, lojaId: 1, lojaNome: 'Mercadinho Vila Nova', produto: 'Presunto fatiado 200 g', preco: '4.74', pedido: 1 }
const QUEIJO: ItemCarrinho = { ofertaId: 5, lojaId: 1, lojaNome: 'Mercadinho Vila Nova', produto: 'Queijo minas frescal 250 g', preco: '8.39', pedido: 1 }
const BISCOITO: ItemCarrinho = { ofertaId: 3, lojaId: 2, lojaNome: 'Empório Santa Cruz', produto: 'Biscoito recheado 140 g', preco: '2.40', pedido: 3 }

const guardar = (chave: string, itens: ItemCarrinho[]) => window.localStorage.setItem(chave, JSON.stringify(itens))
const carrinhoDaAna = () => JSON.parse(window.localStorage.getItem(chaveDaConta(USUARIO.ana)) ?? '[]') as ItemCarrinho[]

describe('C4 · Quantidade: adicionar ao pedido ou reservar só este', () => {
  it('contador vai de 1 até o livre (6) e o botão mostra a prévia do total', async () => {
    const usuario = userEvent.setup()
    await abrir('/oferta/1', { email: ANA })
    const mais = await screen.findByRole('button', { name: 'Aumentar' })
    expect(screen.getByText('6 disponíveis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar ao pedido · R$ 3,14' })).toBeInTheDocument()
    for (let i = 0; i < 8; i++) await usuario.click(mais)
    expect(within(screen.getByRole('group', { name: 'Quantidade' })).getByRole('status')).toHaveTextContent('6')
    expect(mais).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Adicionar ao pedido · R$ 18,84' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reservar só este agora' })).toBeInTheDocument()
  })

  it('"Retire até hoje, 20:00": horário que veio da API (PEDIDO-API 1), não calculado na tela', async () => {
    relogioDoAparelho(AGORA_TESTE)
    await abrir('/oferta/1', { email: ANA })
    expect(await screen.findByText('hoje, 20:00')).toBeInTheDocument()
    expect(screen.getByText(/\(janela de 4 h\)/)).toBeInTheDocument()
  })

  it('sem o campo do pedido (API real antiga): mostra a janela e o fim da oferta', async () => {
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

  it('"Adicionar ao pedido": volta à vitrine com o aviso, a sacola conta o item e a C4 vira "Atualizar no pedido"', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual, roteador } = await abrir('/oferta/1', { email: ANA })
    await usuario.click(await screen.findByRole('button', { name: 'Aumentar' }))
    await usuario.click(screen.getByRole('button', { name: 'Adicionar ao pedido · R$ 6,28' }))

    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
    expect(screen.getByText('Iogurte ×2 adicionado')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Meu pedido, 1 item' })).toBeInTheDocument()
    expect(carrinhoDaAna()).toEqual([IOGURTE]) // nada reservado: só no aparelho

    await act(() => roteador.navigate('/oferta/1'))
    expect(await screen.findByRole('button', { name: 'Atualizar no pedido · R$ 6,28' })).toBeInTheDocument()
  })

  it('o aviso tem "Ver pedido", que abre a C10', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/oferta/2', { email: ANA })
    await usuario.click(await screen.findByRole('button', { name: /Adicionar ao pedido/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Ver pedido' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/pedido'))
    expect(await screen.findByRole('region', { name: 'Mercadinho Vila Nova' })).toHaveTextContent('Presunto fatiado 200 g')
  })

  it('"Reservar só este agora": pedido de 1 item, direto na C5', async () => {
    relogioDoAparelho(AGORA_TESTE)
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/oferta/1', { email: ANA })
    await usuario.click(await screen.findByRole('button', { name: 'Reservar só este agora' }))
    expect(await screen.findByRole('heading', { name: 'Pedido confirmado!' })).toBeInTheDocument()
    expect(caminhoAtual()).toMatch(/^\/pedidos\/\d+\/resultado$/)
    expect(screen.getByText('Retire até hoje, 20:00. Você paga R$ 3,14 na loja, com um código só.')).toBeInTheDocument()
  })

  it('"Reservar só este agora" sem nada livre → "Esgotou agora há pouco"', async () => {
    const usuario = userEvent.setup()
    const { mock, caminhoAtual } = await abrir('/oferta/4', { email: ANA })
    await screen.findByRole('button', { name: 'Reservar só este agora' })
    await act(() => mock.consumidor.reservar(4, 2)) // as duas últimas somem antes do clique
    await usuario.click(screen.getByRole('button', { name: 'Reservar só este agora' }))
    expect(await screen.findByRole('heading', { name: 'Esgotou agora há pouco' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Ver outras ofertas' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
  })

  it('visitante: "Reservar só este agora" leva ao login e volta para a oferta', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/oferta/1')
    await usuario.click(await screen.findByRole('button', { name: 'Reservar só este agora' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/entrar?voltar=%2Foferta%2F1'))
  })
})

describe('C10 · Meu pedido (carrinho no aparelho)', () => {
  it('vazio: "Seu pedido está vazio" e "Ver ofertas"', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/pedido', { email: ANA })
    expect(await screen.findByText('Seu pedido está vazio')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Ver ofertas' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
  })

  it('agrupa por loja, com total por loja; alterar e remover mudam o carrinho', async () => {
    const usuario = userEvent.setup()
    guardar(chaveDaConta(USUARIO.ana), [IOGURTE, BISCOITO, PRESUNTO])
    await abrir('/pedido', { email: ANA })

    const vila = await screen.findByRole('region', { name: 'Mercadinho Vila Nova' })
    expect(screen.getByText(/só ficam guardados para você quando você/)).toBeInTheDocument()
    const emporio = screen.getByRole('region', { name: 'Empório Santa Cruz' })
    expect(within(vila).getByText('Iogurte natural 170 g')).toBeInTheDocument()
    expect(within(vila).getByText('Presunto fatiado 200 g')).toBeInTheDocument()
    expect(vila).toHaveTextContent('Total na lojaR$ 11,02') // 2 × 3,14 + 4,74
    expect(emporio).toHaveTextContent('Total na lojaR$ 7,20')
    expect(await within(vila).findByText('R$ 3,14 cada · 6 disponíveis')).toBeInTheDocument()

    const iogurte = within(vila).getByRole('group', { name: 'Quantidade de Iogurte natural 170 g' })
    await usuario.click(within(iogurte).getByRole('button', { name: 'Aumentar' }))
    expect(vila).toHaveTextContent('Total na lojaR$ 14,16')
    await usuario.click(within(vila).getByRole('button', { name: 'Remover Presunto fatiado 200 g' }))
    expect(vila).toHaveTextContent('Total na lojaR$ 9,42')
    expect(carrinhoDaAna().map((i) => [i.ofertaId, i.pedido])).toEqual([[1, 3], [3, 3]])
  })

  it('item que esgotou desde que foi adicionado: apagado, "Esgotou…" e fora da confirmação', async () => {
    guardar(chaveDaConta(USUARIO.ana), [IOGURTE, { ...PRESUNTO, ofertaId: 6, produto: 'Requeijão cremoso 200 g' }])
    await abrir('/pedido', { email: ANA })
    const vila = await screen.findByRole('region', { name: 'Mercadinho Vila Nova' })
    expect(await within(vila).findByText('Esgotou depois que você adicionou')).toBeInTheDocument()
    expect(within(vila).queryByRole('group', { name: /Requeijão/ })).toBeNull()
    expect(vila).toHaveTextContent('Total na lojaR$ 6,28')
  })

  it('confirmar tudo → C5 "Pedido confirmado!"; os itens saem do carrinho; "Ver código" abre a C6', async () => {
    relogioDoAparelho(AGORA_TESTE)
    const usuario = userEvent.setup()
    guardar(chaveDaConta(USUARIO.ana), [IOGURTE, PRESUNTO, BISCOITO])
    const { caminhoAtual } = await abrir('/pedido', { email: ANA })
    const vila = await screen.findByRole('region', { name: 'Mercadinho Vila Nova' })
    await usuario.click(within(vila).getByRole('button', { name: 'Confirmar pedido nesta loja' }))

    expect(await screen.findByRole('heading', { name: 'Pedido confirmado!' })).toBeInTheDocument()
    expect(screen.getByText('2 itens · Mercadinho Vila Nova')).toBeInTheDocument()
    expect(screen.getByText('Iogurte natural 170 g ×2 · Presunto fatiado 200 g ×1')).toBeInTheDocument()
    expect(screen.getByText('Retire até hoje, 20:00. Você paga R$ 11,02 na loja, com um código só.')).toBeInTheDocument()
    expect(carrinhoDaAna()).toEqual([BISCOITO]) // a outra loja continua no carrinho

    await usuario.click(screen.getByRole('button', { name: 'Ver código de retirada' }))
    expect(await screen.findByRole('heading', { name: 'Código de retirada' })).toBeInTheDocument()
    expect(caminhoAtual()).toMatch(/^\/pedidos\/\d+$/)
    expect(screen.getByText(/o primeiro item vence às 20:00/)).toBeInTheDocument()
    const itens = screen.getByRole('region', { name: 'Itens do pedido' })
    expect(itens).toHaveTextContent('Iogurte natural 170 g · 2 un.R$ 6,28')
    expect(itens).toHaveTextContent('A pagar na lojaR$ 11,02')
  })

  it('algo mudou: resultado por item (✓, pediu N reservamos M, ×), total e "Manter o pedido"', async () => {
    const usuario = userEvent.setup()
    guardar(chaveDaConta(USUARIO.ana), [IOGURTE, PRESUNTO, { ...QUEIJO, pedido: 3 }])
    const { mock } = await abrir('/pedido', { email: ANA })
    const vila = await screen.findByRole('region', { name: 'Mercadinho Vila Nova' })
    await within(vila).findByText('R$ 8,39 cada · 3 disponíveis')
    // Antes do toque: alguém leva os 5 presuntos e 1 queijo.
    await act(() => mock.pedidos.confirmar({ loja_id: 1, itens: [{ oferta_id: 2, pedido: 5 }, { oferta_id: 5, pedido: 1 }] }))
    await usuario.click(within(vila).getByRole('button', { name: 'Confirmar pedido nesta loja' }))

    expect(await screen.findByRole('heading', { name: 'Pedido confirmado com mudanças' })).toBeInTheDocument()
    const linhas = within(screen.getByRole('list', { name: 'Resultado por item' })).getAllByRole('listitem')
    expect(linhas.map((l) => l.textContent)).toEqual([
      '✓Iogurte natural 170 g ×2 · confirmadoR$ 6,28',
      '×Presunto fatiado 200 g · esgotou—',
      '!Queijo minas frescal 250 g: pediu 3, reservamos 2R$ 16,78',
    ])
    expect(screen.getByText(/Total na loja:/)).toHaveTextContent('R$ 23,06')
    // O recusado fica no carrinho (marcado como esgotado na C10); os outros saem.
    expect(carrinhoDaAna().map((i) => i.ofertaId)).toEqual([2])

    await usuario.click(screen.getByRole('button', { name: 'Manter o pedido' }))
    expect(await screen.findByRole('heading', { name: 'Código de retirada' })).toBeInTheDocument()
  })

  it('algo mudou → "Cancelar o pedido": folha de confirmação e o desfecho', async () => {
    const usuario = userEvent.setup()
    guardar(chaveDaConta(USUARIO.ana), [{ ...QUEIJO, pedido: 5 }])
    await abrir('/pedido', { email: ANA })
    await usuario.click(await screen.findByRole('button', { name: 'Confirmar pedido nesta loja' }))
    expect(await screen.findByRole('heading', { name: 'Pedido confirmado com mudanças' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Cancelar o pedido' }))
    const folha = screen.getByRole('dialog', { name: 'Cancelar o pedido?' })
    await usuario.click(within(folha).getByRole('button', { name: 'Sim, cancelar o pedido' }))
    expect(await screen.findByText(/Você cancelou este pedido/)).toBeInTheDocument()
    expect(screen.getByText('Pedido cancelado. Os itens voltaram para a vitrine.')).toBeInTheDocument()
  })

  it('nada sobrou (409): "Esgotou tudo agora há pouco"; o carrinho volta com o item marcado', async () => {
    const usuario = userEvent.setup()
    guardar(chaveDaConta(USUARIO.ana), [QUEIJO])
    const { mock } = await abrir('/pedido', { email: ANA })
    const vila = await screen.findByRole('region', { name: 'Mercadinho Vila Nova' })
    await within(vila).findByText('R$ 8,39 cada · 3 disponíveis')
    await act(() => mock.pedidos.confirmar({ loja_id: 1, itens: [{ oferta_id: 5, pedido: 3 }] }))
    await usuario.click(within(vila).getByRole('button', { name: 'Confirmar pedido nesta loja' }))

    expect(await screen.findByRole('heading', { name: 'Esgotou tudo agora há pouco' })).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Voltar ao pedido' }))
    expect(await screen.findByText('Esgotou depois que você adicionou')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar pedido nesta loja' })).toBeDisabled()
    expect(carrinhoDaAna()).toEqual([QUEIJO])
  })

  it('visitante monta o carrinho; confirmar pede login e volta para a C10 com os itens na conta', async () => {
    const usuario = userEvent.setup()
    guardar(CHAVE_VISITANTE, [IOGURTE])
    guardar(chaveDaConta(USUARIO.ana), [{ ...IOGURTE, pedido: 1 }, PRESUNTO]) // montado antes, já logada
    const { caminhoAtual } = await abrir('/pedido')
    await usuario.click(await screen.findByRole('button', { name: 'Confirmar pedido nesta loja' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/entrar?voltar=%2Fpedido'))

    await usuario.type(await screen.findByLabelText('E-mail'), ANA)
    await usuario.type(screen.getByLabelText('Senha'), '12345678')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/pedido'))
    const vila = await screen.findByRole('region', { name: 'Mercadinho Vila Nova' })
    expect(within(vila).getByText('Presunto fatiado 200 g')).toBeInTheDocument()
    // A mesma oferta nos dois: fica a quantidade maior; o carrinho do visitante some.
    expect(carrinhoDaAna().map((i) => [i.ofertaId, i.pedido])).toEqual([[1, 2], [2, 1]])
    expect(window.localStorage.getItem(CHAVE_VISITANTE)).toBeNull()
  })

  it('o carrinho é da conta logada: outra conta neste aparelho não vê', async () => {
    guardar(chaveDaConta(USUARIO.ana), [IOGURTE])
    await abrir('/pedido', { email: JULIANA })
    expect(await screen.findByText('Seu pedido está vazio')).toBeInTheDocument()
  })
})

describe('C6 · Código do pedido e C7 · desfechos', () => {
  it('conta a partir do prazo recebido e vira C7 quando a recarga traz o pedido encerrado', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(AGORA_TESTE) // 16:00; o pedido 31 da Ana (1 item) vence 19:42
    await abrir('/pedidos/31', { email: ANA, agora: () => new Date() }) // mock segue o mesmo relógio
    await act(() => vi.advanceTimersByTimeAsync(50))

    expect(screen.getByText('Código: 4 8 2 9 1 7')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('3 h 41 min')
    expect(screen.queryByText(/o primeiro item vence/)).toBeNull() // 1 item só
    expect(screen.queryByRole('button', { name: 'Cancelar um item' })).toBeNull()

    vi.setSystemTime(new Date('2026-10-22T19:43:00-03:00'))
    await act(() => vi.advanceTimersByTimeAsync(30_000)) // recarga de 30 s
    expect(screen.getByText(/O prazo terminou/)).toBeInTheDocument()
    expect(screen.getByText('Código sem validade: 4 8 2 9 1 7')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver se ainda tem na vitrine' })).toBeInTheDocument()
  })

  it('não decide sozinha: relógio do aparelho passou, mas a API diz "ativo" → continua C6', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-22T19:50:00-03:00'))
    await abrir('/pedidos/31', { email: ANA }) // mock parado em 16:00
    await act(() => vi.advanceTimersByTimeAsync(31_000))
    expect(screen.getByRole('timer')).toHaveTextContent('Conferindo com a loja…')
    expect(screen.queryByText(/O prazo terminou/)).toBeNull()
  })

  it('menos de 30 min: contagem em destaque (urgent)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-22T19:20:00-03:00'))
    await abrir('/pedidos/31', { email: ANA })
    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(screen.getByRole('timer')).toHaveTextContent('21 min')
    expect(screen.getByRole('timer').className).toMatch(/urgente/)
  })

  it('"Cancelar um item": escolhe qual; só ele sai e o código continua', async () => {
    const usuario = userEvent.setup()
    const pecas = criarPecas()
    await pecas.entrarComo(ANA)
    const r = await pecas.mock.pedidos.confirmar({ loja_id: 1, itens: [{ oferta_id: 1, pedido: 2 }, { oferta_id: 2, pedido: 1 }] })
    const pedido = (r as { pedido: Pedido }).pedido
    await abrir(`/pedidos/${pedido.id}`, { pecas })

    await usuario.click(await screen.findByRole('button', { name: 'Cancelar um item' }))
    const folha = screen.getByRole('dialog', { name: 'Qual item cancelar?' })
    await usuario.click(within(folha).getByRole('button', { name: 'Cancelar Presunto fatiado 200 g (1 un.)' }))

    expect(await screen.findByText('Presunto fatiado 200 g foi cancelado.')).toBeInTheDocument()
    expect(screen.getByText(/^Item cancelado./)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Itens do pedido' })).toHaveTextContent('A pagar na lojaR$ 6,28')
    expect(screen.getByText(`Código: ${pedido.codigo.split('').join(' ')}`)).toBeInTheDocument()
  })

  it('item vencido some da lista com a nota; o código vale para o resto', async () => {
    const pecas = criarPecas()
    await pecas.entrarComo(ANA)
    const r = await pecas.mock.pedidos.confirmar({ loja_id: 1, itens: [{ oferta_id: 1, pedido: 2 }, { oferta_id: 2, pedido: 1 }] })
    const pedido = (r as { pedido: Pedido }).pedido
    // A tela mostra o que a API manda: aqui, o presunto já voltou expirado.
    const obter = pecas.mock.pedidos.obter
    pecas.mock.pedidos.obter = async (id) => {
      const p = await obter(id)
      return { ...p, itens: p.itens.map((i) => (i.oferta_id === 2 ? { ...i, estado: 'expirada' as const } : i)) }
    }
    await abrir(`/pedidos/${pedido.id}`, { pecas })
    expect(await screen.findByText('Presunto fatiado 200 g expirou e voltou para a vitrine.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Itens do pedido' })).not.toHaveTextContent('Presunto fatiado 200 g · ')
    expect(screen.getByText('✓ Pedido confirmado · 1 item')).toBeInTheDocument()
  })

  it('cancelar o pedido pela C6: folha e desfecho', async () => {
    const usuario = userEvent.setup()
    await abrir('/pedidos/31', { email: ANA })
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar o pedido' }))
    const folha = screen.getByRole('dialog', { name: 'Cancelar o pedido?' })
    expect(folha).toHaveTextContent('O item volta para a vitrine na hora')
    await usuario.click(within(folha).getByRole('button', { name: 'Sim, cancelar o pedido' }))
    expect(await screen.findByText(/Você cancelou este pedido/)).toBeInTheDocument()
  })

  it('retirado: o que foi retirado e o valor pago (vindos da API)', async () => {
    await abrir('/pedidos/36', { email: ANA })
    expect(await screen.findByText(/Obrigado por evitar desperdício/)).toBeInTheDocument()
    expect(screen.getByText('1 × Requeijão cremoso 200 g')).toBeInTheDocument()
    expect(screen.getByText(/Você pagou/)).toHaveTextContent('R$ 4,19')
  })

  it('pedido de outra pessoa → mensagem de não encontrado', async () => {
    await abrir('/pedidos/32', { email: ANA })
    expect(await screen.findByRole('alert')).toHaveTextContent('Pedido não encontrado.')
  })

  it('endereço antigo /reservas/:id leva ao pedido da reserva', async () => {
    const { caminhoAtual } = await abrir('/reservas/31', { email: ANA })
    await waitFor(() => expect(caminhoAtual()).toBe('/pedidos/31'))
    expect(await screen.findByRole('heading', { name: 'Código de retirada' })).toBeInTheDocument()
  })
})
