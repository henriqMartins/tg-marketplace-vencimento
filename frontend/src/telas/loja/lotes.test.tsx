import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { abrir, JULIANA } from '../../test/abrir'

// Semente relativa a 22/10/2026: feijão (vermelho 2027, ref. 15/02/2027), milho sem grupo.
type Usuario = ReturnType<typeof userEvent.setup>

async function escolherProduto(usuario: Usuario, busca: string, nome: string) {
  await usuario.type(await screen.findByRole('searchbox', { name: 'Buscar produto no catálogo' }), busca)
  await usuario.click(await screen.findByRole('button', { name: nome }))
}

async function salvarLote(usuario: Usuario, validade: string) {
  await usuario.type(screen.getByLabelText('Validade impressa'), validade)
  await usuario.click(screen.getByRole('button', { name: 'Salvar lote e agendar aviso' }))
}

describe('L3 · Cadastro do lote — os 3 resultados vêm da API', () => {
  it('agrupado: entra no grupo ativo e a referência passa a ser a mais próxima', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/lotes/novo', { email: JULIANA })
    await escolherProduto(usuario, 'feijão', 'Feijão carioca 1 kg')
    await salvarLote(usuario, '10022027')

    expect(
      await screen.findByText('Agrupado ao grupo Vermelho ativo. Data de referência do grupo: 10/02/2027 (a mais próxima).'),
    ).toBeInTheDocument()
    expect(screen.getByText('Bimestre de vencimento: jan–fev · vence 10/02/2027')).toBeInTheDocument()
    expect(screen.getByText('Cole a fita vermelha na caixa e posicione a divisória na zona Vermelho da gôndola.')).toBeInTheDocument()
    expect(screen.getByText('1 un. de Feijão carioca 1 kg · aviso em 31/01/2027')).toBeInTheDocument()
  })

  it('colisão: grupo novo e o alerta com a validade do outro ano', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/lotes/novo', { email: JULIANA })
    await escolherProduto(usuario, 'feijão', 'Feijão carioca 1 kg')
    await salvarLote(usuario, '15022028')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Atenção: ainda há lote Vermelho do ano anterior ativo para este produto (validade 15/02/2027). Separe as zonas antes de colar a fita.',
    )
  })

  it('novo: primeiro grupo da cor para o produto', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/lotes/novo', { email: JULIANA })
    await escolherProduto(usuario, 'milho', 'Milho verde em lata 200 g')
    await usuario.click(within(screen.getByRole('group', { name: 'Quantidade recebida' })).getByRole('button', { name: 'Aumentar' }))
    await salvarLote(usuario, '18122026')

    expect(await screen.findByText('Novo grupo Preto criado para este produto. Data de referência: 18/12/2026.')).toBeInTheDocument()
    expect(screen.getByText('2 un. de Milho verde em lata 200 g · aviso em 08/12/2026')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('validade: data que não existe trava o botão; data vencida vem da API embaixo do campo', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/lotes/novo', { email: JULIANA })
    await escolherProduto(usuario, 'feijão', 'Feijão carioca 1 kg')
    const validade = screen.getByLabelText('Validade impressa')
    await usuario.type(validade, '31022027')
    expect(validade).toHaveValue('31/02/2027')
    expect(validade).toHaveAccessibleDescription('Essa data não existe no calendário.')
    expect(screen.getByRole('button', { name: 'Salvar lote e agendar aviso' })).toBeDisabled()

    await usuario.clear(validade)
    await salvarLote(usuario, '21102026')
    await waitFor(() => expect(validade).toHaveAccessibleDescription('Este lote já venceu.'))
  })

  it('"+ Novo produto" → L2 → volta para a L3 com o produto escolhido', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/loja/1/lotes/novo', { email: JULIANA })
    await usuario.type(await screen.findByRole('searchbox', { name: 'Buscar produto no catálogo' }), 'Atum')
    await usuario.click(screen.getByRole('button', { name: '+ Novo produto' }))
    expect(caminhoAtual()).toBe('/loja/1/produtos/novo?nome=Atum')

    const nome = await screen.findByLabelText('Nome do produto')
    expect(nome).toHaveValue('Atum')
    expect(screen.getByRole('button', { name: 'Escolha a categoria' })).toBeDisabled()
    expect(screen.getByText(/Só produtos embalados e fechados/)).toBeInTheDocument()
    expect(await screen.findByLabelText('Usar a margem da loja (1 dia)')).toBeChecked()

    await usuario.type(nome, ' em lata 170 g')
    await usuario.click(screen.getByRole('button', { name: 'Enlatados' }))
    await usuario.click(screen.getByRole('button', { name: 'Salvar e cadastrar o lote' }))

    await waitFor(() => expect(caminhoAtual()).toMatch(/^\/loja\/1\/lotes\/novo\?produto=\d+$/))
    expect(await screen.findByText('Atum em lata 170 g')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trocar' })).toBeInTheDocument()
  })
})

describe('L4 · Lotes e fitas', () => {
  it('grupos ativos com selo, fita e situação; colisão em destaque', async () => {
    await abrir('/loja/1/lotes', { email: JULIANA })
    const leite = (await screen.findByText('Leite condensado 395 g')).closest('a')!
    expect(leite).toHaveAttribute('href', '/loja/1/avisos/301')
    expect(leite).toHaveTextContent('Conferir')
    expect(leite).toHaveTextContent('2 lotes · 36 un. recebidas')

    const achocolatado = screen.getByText('Achocolatado em pó 400 g').closest('a')!
    expect(achocolatado).toHaveTextContent('Aviso adiado para 23/10')
    expect(achocolatado).toHaveTextContent('Colisão de ciclo')

    expect(screen.getByText('Iogurte natural 170 g').closest('a')).toHaveAttribute('href', '/loja/1/ofertas/1')
    expect(screen.queryByText('Requeijão cremoso 200 g')).not.toBeInTheDocument() // oferta encerrada
    expect(screen.getByRole('link', { name: 'Cadastrar lote' })).toHaveAttribute('href', '/loja/1/lotes/novo')
  })

  it('filtro de cor vai à API e fica na URL', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/loja/1/lotes', { email: JULIANA })
    await screen.findByText('Leite condensado 395 g')
    await usuario.click(screen.getByRole('button', { name: 'Vermelho' }))
    expect(caminhoAtual()).toBe('/loja/1/lotes?cor=vermelho')
    await waitFor(() => expect(screen.queryByText('Leite condensado 395 g')).not.toBeInTheDocument())
    expect(screen.getByText('Feijão carioca 1 kg')).toBeInTheDocument()
  })
})
