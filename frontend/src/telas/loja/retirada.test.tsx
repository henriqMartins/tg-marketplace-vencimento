import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { abrir, ANA, JULIANA } from '../../test/abrir'
import { criarPecas } from '../../test/pecas'


const tecla = (nome: string) => screen.getByRole('button', { name: nome })
const digitado = () => screen.getByText(/Código digitado|Nenhum dígito/)

async function digitar(usuario: ReturnType<typeof userEvent.setup>, codigo: string) {
  for (const d of codigo) await usuario.click(tecla(d))
}

describe('L12 · Validar retirada (teclado próprio)', () => {
  it('teclas preenchem, ⌫ apaga, Limpar zera; "Faltam N dígitos" até o sexto', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/retirada', { email: JULIANA })
    expect(await screen.findByRole('heading', { name: 'Validar retirada · 4 aguardando' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Faltam 6 dígitos' })).toBeDisabled()

    await digitar(usuario, '482')
    expect(digitado()).toHaveTextContent('Código digitado: 4 8 2')
    expect(screen.getByRole('button', { name: 'Faltam 3 dígitos' })).toBeDisabled()

    await usuario.click(tecla('Apagar'))
    expect(digitado()).toHaveTextContent('Código digitado: 4 8')
    await usuario.click(tecla('Limpar'))
    expect(digitado()).toHaveTextContent('Nenhum dígito digitado')

    await digitar(usuario, '4829170') // o sétimo dígito é ignorado (teclas travam)
    expect(digitado()).toHaveTextContent('Código digitado: 4 8 2 9 1 7')
    expect(screen.getByRole('button', { name: 'Buscar reserva' })).toBeEnabled()
  })

  it('não tem campo de texto: o teclado do celular nunca abre', async () => {
    const { tela } = await abrir('/loja/1/retirada', { email: JULIANA })
    await screen.findByRole('group', { name: 'Teclado numérico' })
    expect(tela.container.querySelector('input, textarea, [contenteditable]')).toBeNull()
  })

  it('no computador, o teclado físico também digita (e Enter busca)', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/retirada', { email: JULIANA })
    await screen.findByRole('group', { name: 'Teclado numérico' })
    await usuario.keyboard('482917')
    expect(digitado()).toHaveTextContent('Código digitado: 4 8 2 9 1 7')
    await usuario.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Pedido encontrado' })).toBeInTheDocument()
  })
})

describe('L13 · Retirada — os 3 estados', () => {
  it('encontrada → confirmada, com os números que a API devolveu', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/retirada', { email: JULIANA })
    await screen.findByRole('group', { name: 'Teclado numérico' })
    await digitar(usuario, '482917')
    await usuario.click(screen.getByRole('button', { name: 'Buscar reserva' }))

    expect(await screen.findByRole('heading', { name: 'Pedido encontrado' })).toBeInTheDocument()
    expect(screen.getByText('Código 482 917')).toBeInTheDocument()
    expect(screen.getByText(/Cliente:/)).toHaveTextContent('Ana S.')
    expect(screen.getByText(/Cobrar no caixa/)).toHaveTextContent('R$ 6,28')
    expect(screen.getByRole('list', { name: 'Itens a entregar' })).toHaveTextContent('Fita Branco · vence 28/10/2026')
    expect(screen.getByText('Zona Branco · área de reservas')).toBeInTheDocument()
    expect(screen.getByText(/entregue as 2 unidades/)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Entreguei e cobrei · confirmar' }))
    expect(await screen.findByRole('heading', { name: 'Retirada registrada' })).toBeInTheDocument()
    expect(screen.getByText(/Registrada por Juliana Prado/)).toBeInTheDocument()
    expect(screen.getByText('A oferta agora tem 6 livres e 2 reservadas.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Validar outro código' }))
    expect(await screen.findByRole('button', { name: 'Faltam 6 dígitos' })).toBeInTheDocument()
  })

  it('pedido de 2 itens: lista os dois, cobra a soma e retira o pedido inteiro', async () => {
    const usuario = userEvent.setup()
    const pecas = criarPecas()
    await pecas.entrarComo(ANA)
    const r = await pecas.mock.pedidos.confirmar({ loja_id: 1, itens: [{ oferta_id: 1, pedido: 2 }, { oferta_id: 2, pedido: 1 }] })
    if (r.status !== 'criado') throw new Error('esperava pedido')
    await pecas.entrarComo(JULIANA)
    await abrir('/loja/1/retirada', { pecas })
    await screen.findByRole('group', { name: 'Teclado numérico' })
    await digitar(usuario, r.pedido.codigo)
    await usuario.click(screen.getByRole('button', { name: 'Buscar reserva' }))

    expect(await screen.findByRole('heading', { name: 'Pedido encontrado' })).toBeInTheDocument()
    expect(screen.getByText(/Cliente:/)).toHaveTextContent('Ana S. · Pedido · 2 itens')
    const itens = within(screen.getByRole('list', { name: 'Itens a entregar' })).getAllByRole('listitem')
    expect(itens.map((i) => i.querySelector('strong')?.textContent)).toEqual(['2 × Iogurte natural 170 g', '1 × Presunto fatiado 200 g'])
    expect(screen.getByText(/Cobrar no caixa/)).toHaveTextContent('R$ 11,02')
    expect(screen.getByText(/entregue os 2 itens/)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Entreguei e cobrei · confirmar' }))
    expect(await screen.findByRole('heading', { name: 'Retirada registrada' })).toBeInTheDocument()
    expect(screen.getByText('2 itens (Iogurte natural 170 g ×2, Presunto fatiado 200 g ×1)')).toBeInTheDocument()
    expect(screen.getByText('Os estoques das 2 ofertas já foram atualizados.')).toBeInTheDocument()
  })

  it('não encontrada → causas, aviso e "Digitar de novo"', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/retirada', { email: JULIANA })
    await screen.findByRole('group', { name: 'Teclado numérico' })
    await digitar(usuario, '000000')
    await usuario.click(screen.getByRole('button', { name: 'Buscar reserva' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Nenhum pedido ativo com esse código nesta loja.')
    expect(screen.getByText('pedido de outra loja.')).toBeInTheDocument()
    expect(screen.getByText('Não entregue o produto sem validar.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Digitar de novo' }))
    expect(digitado()).toHaveTextContent('Nenhum dígito digitado')
  })

  it('código de reserva de outra loja também é "não encontrada"', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/retirada', { email: JULIANA })
    await screen.findByRole('group', { name: 'Teclado numérico' })
    await digitar(usuario, '208455') // reserva do Mercado Bom Preço
    await usuario.click(screen.getByRole('button', { name: 'Buscar reserva' }))
    expect(await screen.findByRole('heading', { name: 'Código não encontrado' })).toBeInTheDocument()
  })

  it('venceu entre a busca e a confirmação (409) → mensagem da API e "Digitar outro código"', async () => {
    const usuario = userEvent.setup()
    // A semente nasce relativa ao relógio: começando às 16:00, a reserva 31 vence às 19:42.
    let relogio = new Date('2026-10-22T16:00:00-03:00')
    await abrir('/loja/1/retirada', { email: JULIANA, agora: () => relogio })
    await screen.findByRole('group', { name: 'Teclado numérico' })
    await digitar(usuario, '482917')
    await usuario.click(screen.getByRole('button', { name: 'Buscar reserva' }))
    await screen.findByRole('heading', { name: 'Pedido encontrado' })

    relogio = new Date('2026-10-22T19:45:00-03:00')
    await usuario.click(screen.getByRole('button', { name: 'Entreguei e cobrei · confirmar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta reserva venceu: o prazo de retirada acabou.')
    expect(screen.getByRole('button', { name: 'Digitar outro código' })).toBeInTheDocument()
  })

  it('código que venceu há pouco (409 na prévia) → a frase da API, sem "não encontrada"', async () => {
    const usuario = userEvent.setup()
    // A semente nasce às 16:00 (a 31 vence às 19:42); o relógio anda antes da busca.
    let relogio = new Date('2026-10-22T16:00:00-03:00')
    await abrir('/loja/1/retirada', { email: JULIANA, agora: () => relogio })
    await screen.findByRole('group', { name: 'Teclado numérico' })
    relogio = new Date('2026-10-22T19:45:00-03:00')
    await digitar(usuario, '482917')
    await usuario.click(screen.getByRole('button', { name: 'Buscar reserva' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta reserva venceu: o prazo de retirada acabou.')
    expect(screen.queryByRole('heading', { name: 'Código não encontrado' })).not.toBeInTheDocument()
  })
})

describe('L11 · Ajuste de estoque', () => {
  it('motivo obrigatório; prévia; registra e volta para a oferta com o estoque novo', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/loja/1/ofertas/1/ajuste', { email: JULIANA })
    expect(await screen.findByText(/Só dá para tirar do estoque livre \(6 un\.\)/)).toHaveTextContent(
      'As 4 unidades reservadas estão prometidas a clientes',
    )
    const registrar = () => screen.getByRole('button', { name: /Registrar ajuste/ })
    expect(registrar()).toBeDisabled()

    await usuario.click(screen.getByRole('button', { name: 'Aumentar' }))
    await usuario.click(screen.getByRole('radio', { name: 'Danificada' }))
    expect(screen.getByText('Depois do ajuste: livre 4 · ajustado 2')).toBeInTheDocument()
    await usuario.click(registrar())

    await waitFor(() => expect(caminhoAtual()).toBe('/loja/1/ofertas/1'))
    expect(await screen.findByText('12 = 4 + 4 + 2 + 2 + 0')).toBeInTheDocument()
    expect(screen.getByText('Ajuste registrado: 2 un. (Danificada).')).toBeInTheDocument()
  })

  it('"Outro" exige o texto do motivo', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/ofertas/1/ajuste', { email: JULIANA })
    await usuario.click(await screen.findByRole('radio', { name: 'Outro' }))
    expect(screen.getByRole('button', { name: /Registrar ajuste/ })).toBeDisabled()
    await usuario.type(screen.getByLabelText('Qual o motivo?'), 'Embalagem estufada')
    expect(screen.getByRole('button', { name: /Registrar ajuste/ })).toBeEnabled()
  })

  it('409 acima_do_livre vira mensagem na L11 e o máximo cai para o livre de agora', async () => {
    const usuario = userEvent.setup()
    const { mock } = await abrir('/loja/1/ofertas/1/ajuste', { email: JULIANA })
    const mais = await screen.findByRole('button', { name: 'Aumentar' })
    for (let i = 0; i < 5; i++) await usuario.click(mais)
    expect(screen.getByText('Máximo: 6, o estoque livre agora.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('radio', { name: 'Extraviada' }))

    await act(() => mock.consumidor.reservar(1, 1)) // um cliente reserva enquanto a funcionária contava
    await usuario.click(screen.getByRole('button', { name: 'Registrar ajuste de 6 un.' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Só dá para ajustar unidades livres; as reservadas não entram.')
    await waitFor(() => expect(within(screen.getByRole('group', { name: 'Unidades a tirar' })).getByRole('status')).toHaveTextContent('5'))
    expect(screen.getByRole('button', { name: 'Aumentar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Registrar ajuste de 5 un.' })).toBeInTheDocument()
  })
})

