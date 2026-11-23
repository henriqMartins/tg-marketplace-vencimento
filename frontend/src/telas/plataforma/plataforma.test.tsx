import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CNPJ_ATIVA, CNPJ_FORA_DO_AR, CNPJ_INATIVA, CNPJ_NAO_ALIMENTAR } from '../../api/mock/grupo-i'
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

describe('P3 · Cadastrar loja', () => {
  async function consultar(usuario: ReturnType<typeof userEvent.setup>, cnpj: string) {
    const campo = await screen.findByLabelText('CNPJ')
    await usuario.clear(campo)
    await usuario.type(campo, cnpj)
    await usuario.click(screen.getByRole('button', { name: 'Consultar' }))
  }

  it('dígito errado: avisa no campo sem consultar a Receita', async () => {
    const usuario = userEvent.setup()
    const { mock } = await abrir('/plataforma/lojas/nova', { email: EQUIPE, largura: COMPUTADOR })
    const consultarCnpj = vi.spyOn(mock.parceria, 'consultarCnpj')
    await consultar(usuario, '11222333000182')
    expect(screen.getByLabelText('CNPJ')).toHaveValue('11.222.333/0001-82')
    expect(screen.getByLabelText('CNPJ')).toHaveAccessibleDescription('CNPJ inválido. Confira os números.')
    expect(consultarCnpj).not.toHaveBeenCalled()
  })

  it('Receita: inativa bloqueia o cadastro', async () => {
    const usuario = userEvent.setup()
    await abrir('/plataforma/lojas/nova', { email: EQUIPE, largura: COMPUTADOR })
    await consultar(usuario, CNPJ_INATIVA)
    const receita = await screen.findByRole('region', { name: 'Dados da Receita' })
    expect(within(receita).getByText('Inativa')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('A Receita mostra este CNPJ como BAIXADA.')
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull()
  })

  it('Receita: atividade fora do varejo de alimentos só alerta', async () => {
    const usuario = userEvent.setup()
    await abrir('/plataforma/lojas/nova', { email: EQUIPE, largura: COMPUTADOR })
    await consultar(usuario, CNPJ_NAO_ALIMENTAR)
    expect(await screen.findByText(/não é varejo de alimentos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled()
  })

  it('Receita fora do ar (503): segue à mão e a loja fica "não verificado"', async () => {
    const usuario = userEvent.setup()
    await abrir('/plataforma/lojas/nova', { email: EQUIPE, largura: COMPUTADOR })
    await consultar(usuario, CNPJ_FORA_DO_AR)
    expect(await screen.findByText('Não deu para consultar a Receita agora; preencha à mão.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Continuar sem a consulta' }))

    expect(screen.getByLabelText('Endereço')).toHaveValue('')
    await usuario.type(screen.getByLabelText('Nome de exibição'), 'Armazém Novo')
    await usuario.type(screen.getByLabelText('Endereço'), 'Rua Ipiranga, 500 · Centro')
    await usuario.type(screen.getByLabelText('E-mail do responsável'), 'dono@email.com')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar loja e gerar convite' }))
    await usuario.click(await screen.findByRole('button', { name: 'Cadastrar com esta localização' }))

    const loja = await screen.findByRole('region', { name: 'Loja cadastrada' })
    expect(within(loja).getByText('CNPJ não verificado')).toBeInTheDocument()
  })

  it('vindo da P1, ativa: preenche pelo pedido, confirma no mapa, e o link copiado tem o código recebido', async () => {
    const usuario = userEvent.setup()
    const copiar = areaDeTransferencia()
    const { mock } = await abrir('/plataforma/lojas/nova?interesse=3', { email: EQUIPE, largura: COMPUTADOR })
    expect(await screen.findByText(/Pedido de Marcos Lima/)).toBeInTheDocument()
    await consultar(usuario, CNPJ_ATIVA)
    const receita = await screen.findByRole('region', { name: 'Dados da Receita' })
    expect(within(receita).getByText('Ativa')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(screen.getByLabelText('Nome de exibição')).toHaveValue('Mercearia São Jorge')
    expect(screen.getByLabelText('Endereço')).toHaveValue('RUA BERNARDINO DE CAMPOS, 1500 · CENTRO · SAO JOSE DO RIO PRETO/SP')
    expect(screen.getByLabelText('E-mail do responsável')).toHaveValue('marcos@example.com')

    const cadastrar = vi.spyOn(mock.parceria, 'cadastrarLoja')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar loja e gerar convite' }))
    const confirmar = await screen.findByRole('region', { name: 'Confirmar localização' })
    expect(confirmar).toHaveTextContent('Localização encontrada:')
    await usuario.click(within(confirmar).getByRole('button', { name: 'Cadastrar com esta localização' }))

    expect(await screen.findByRole('heading', { name: /Loja cadastrada/ })).toBeInTheDocument()
    expect(cadastrar).toHaveBeenCalledWith(
      expect.objectContaining({ cnpj: CNPJ_ATIVA, interesse_id: 3, latitude: -20.8051, longitude: -49.3812 }),
    )
    const { convite } = await cadastrar.mock.results[0].value
    const link = screen.getByLabelText('Link do convite')
    expect(link).toHaveValue(`${window.location.origin}/convite/${convite.codigo}`)
    expect(screen.getByLabelText('Mensagem para o WhatsApp')).toHaveValue(
      `Olá! Sua loja Mercearia São Jorge está pronta na plataforma. Para ativar, abra: ${window.location.origin}/convite/${convite.codigo} (vale até 29/10). Entre ou crie a conta com marcos@example.com.`,
    )
    await usuario.click(screen.getByRole('button', { name: 'Copiar link' }))
    await waitFor(() => expect(copiar).toHaveBeenCalledWith(`${window.location.origin}/convite/${convite.codigo}`))
  })

  it('endereço não achado no mapa: cadastra sem localização', async () => {
    const usuario = userEvent.setup()
    const { mock } = await abrir('/plataforma/lojas/nova', { email: EQUIPE, largura: COMPUTADOR })
    await consultar(usuario, CNPJ_ATIVA)
    await usuario.click(await screen.findByRole('button', { name: 'Continuar' }))
    await usuario.clear(screen.getByLabelText('Endereço'))
    await usuario.type(screen.getByLabelText('Endereço'), 'Rua inexistente, 1')
    await usuario.type(screen.getByLabelText('E-mail do responsável'), 'dono@email.com')
    const cadastrar = vi.spyOn(mock.parceria, 'cadastrarLoja')
    await usuario.click(screen.getByRole('button', { name: 'Cadastrar loja e gerar convite' }))
    await usuario.click(await screen.findByRole('button', { name: 'Cadastrar sem localização' }))
    expect(await screen.findByRole('heading', { name: /Loja cadastrada/ })).toBeInTheDocument()
    expect(cadastrar).toHaveBeenCalledWith(expect.objectContaining({ latitude: null, longitude: null }))
  })
})
