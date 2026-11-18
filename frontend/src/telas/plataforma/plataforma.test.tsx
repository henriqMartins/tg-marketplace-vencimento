import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CNPJ_ATIVA } from '../../api/mock/grupo-i'
import { abrir, ANA, CARLOS, EQUIPE, MARCOS } from '../../test/abrir'
import { criarPecas } from '../../test/pecas'

const COMPUTADOR = 1280

afterEach(() => vi.restoreAllMocks())

/** Área de transferência falsa: guarda o que foi copiado. */
function areaDeTransferencia() {
  const writeText = vi.fn(async (_texto: string) => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return writeText
}

describe('Plataforma · proteção e layout', () => {
  it.each([
    ['consumidora', ANA],
    ['responsável de loja', CARLOS],
  ])('%s não entra na área da plataforma', async (_nome, email) => {
    await abrir('/plataforma/interessados', { email, largura: COMPUTADOR })
    expect(await screen.findByText('Área da equipe da plataforma')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Interessados' })).toBeNull()
  })

  it('equipe no computador: menu lateral; /plataforma abre os Interessados', async () => {
    const { caminhoAtual } = await abrir('/plataforma', { email: EQUIPE, largura: COMPUTADOR })
    await waitFor(() => expect(caminhoAtual()).toBe('/plataforma/interessados'))
    const menu = await screen.findByRole('navigation', { name: 'Menu da plataforma' })
    expect(within(menu).getByRole('link', { name: 'Lojas' })).toHaveAttribute('href', '/plataforma/lojas')
  })

  it('equipe no celular: navegação inferior e lista empilhada', async () => {
    await abrir('/plataforma/interessados', { email: EQUIPE })
    expect(await screen.findByRole('navigation', { name: 'Navegação da plataforma' })).toBeInTheDocument()
    expect(await screen.findByText('Mercearia São Jorge')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('P1 · Interessados', () => {
  it('lista o pedido do Marcos nos Novos, com quem pediu e o telefone', async () => {
    await abrir('/plataforma/interessados', { email: EQUIPE, largura: COMPUTADOR })
    const linha = (await screen.findByText('Mercearia São Jorge')).closest('tr')!
    expect(linha).toHaveTextContent('São José do Rio Preto')
    expect(linha).toHaveTextContent('Marcos Lima')
    expect(linha).toHaveTextContent('marcos@example.com')
    expect(within(linha).getByRole('link', { name: '17999990000' })).toHaveAttribute('href', 'tel:17999990000')
  })

  it('"Marcar em conversa" move o pedido para a aba Em conversa', async () => {
    const usuario = userEvent.setup()
    await abrir('/plataforma/interessados', { email: EQUIPE, largura: COMPUTADOR })
    await usuario.click(await screen.findByRole('button', { name: 'Marcar em conversa' }))
    expect(await screen.findByText('Nenhum pedido novo.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('tab', { name: 'Em conversa' }))
    expect(await screen.findByText('Mercearia São Jorge')).toBeInTheDocument()
  })

  it('"Descartar" pede o motivo e mostra o pedido nos Descartados', async () => {
    const usuario = userEvent.setup()
    await abrir('/plataforma/interessados', { email: EQUIPE, largura: COMPUTADOR })
    await usuario.click(await screen.findByRole('button', { name: 'Descartar' }))
    const folha = await screen.findByRole('dialog')
    await usuario.click(within(folha).getByRole('button', { name: 'Descartar pedido' }))
    expect(within(folha).getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true')
    await usuario.type(within(folha).getByLabelText('Motivo'), 'Fora da região')
    await usuario.click(within(folha).getByRole('button', { name: 'Descartar pedido' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await usuario.click(screen.getByRole('tab', { name: 'Descartados' }))
    expect(await screen.findByText('Motivo: Fora da região')).toBeInTheDocument()
  })

  it('"Cadastrar loja" leva à P3 com o pedido', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/plataforma/interessados', { email: EQUIPE, largura: COMPUTADOR })
    await usuario.click(await screen.findByRole('button', { name: 'Cadastrar loja' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/plataforma/lojas/nova?interesse=3'))
  })
})

describe('P2 · Lojas', () => {
  /** Equipe cadastra a Mercearia São Jorge (direto no mock) e abre a P2. */
  async function abrirComLojaNova() {
    const pecas = criarPecas()
    await pecas.entrarComo(EQUIPE)
    const { convite, loja } = await pecas.mock.parceria.cadastrarLoja({
      cnpj: CNPJ_ATIVA,
      nome: 'Mercearia São Jorge',
      endereco: 'Rua Bernardino de Campos, 1500',
      latitude: null,
      longitude: null,
      telefone: '17999990000',
      email_responsavel: MARCOS,
    })
    const aberto = await abrir('/plataforma/lojas', { pecas, largura: COMPUTADOR })
    const linha = (await screen.findByText('Mercearia São Jorge')).closest('tr')!
    return { ...aberto, convite, loja, linha }
  }

  it('tabela: CNPJ com máscara, convite pendente com a validade; lojas antigas sem CNPJ', async () => {
    const { linha } = await abrirComLojaNova()
    expect(linha).toHaveTextContent('11.222.333/0001-81')
    expect(linha).toHaveTextContent('Convite pendente · vence 29/10')
    expect(within(linha).queryByText('não verificado')).toBeNull()
    const antiga = screen.getByText('Mercadinho Vila Nova').closest('tr')!
    expect(antiga).toHaveTextContent('Sem CNPJ')
    expect(antiga).toHaveTextContent('Carlos Lima')
  })

  it('"Copiar link do convite" copia o link com o código recebido', async () => {
    const copiar = areaDeTransferencia()
    const { linha, convite } = await abrirComLojaNova()
    await userEvent.click(within(linha).getByRole('button', { name: 'Copiar link do convite' }))
    await waitFor(() => expect(copiar).toHaveBeenCalledWith(`${window.location.origin}/convite/${convite.codigo}`))
    expect(await screen.findByText('Link copiado.')).toBeInTheDocument()
  })

  it('"Gerar novo convite": mostra o link novo e o antigo deixa de valer', async () => {
    const usuario = userEvent.setup()
    const { linha, convite, mock, entrarComo } = await abrirComLojaNova()
    await usuario.click(within(linha).getByRole('button', { name: 'Gerar novo convite' }))
    const folha = await screen.findByRole('dialog', { name: 'Novo convite gerado' })
    const link = within(folha).getByLabelText('Link do convite') as HTMLInputElement
    expect(link.value).toMatch(/\/convite\/[\w-]{20,}$/)
    expect(link.value).not.toContain(convite.codigo)

    await entrarComo(MARCOS)
    await expect(mock.parceria.obterConvite(convite.codigo)).rejects.toMatchObject({ status: 410 })
  })

  it('"+ Cadastrar loja" leva à P3 vazia', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/plataforma/lojas', { email: EQUIPE, largura: COMPUTADOR })
    await usuario.click(await screen.findByRole('button', { name: '+ Cadastrar loja' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/plataforma/lojas/nova'))
  })
})
