import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { abrir, CARLOS } from '../../test/abrir'
import { criarPecas, geocodificarFalso } from '../../test/pecas'

const DESKTOP = 1280
const barra = () => screen.queryByRole('region', { name: 'Alterações não salvas' })
const grupo = (nome: string) => screen.getByRole('group', { name: nome })

describe('G6 / L14 · Configurações da loja', () => {
  it('mostra o que a API devolveu; a barra só aparece com mudança e "Descartar" volta tudo', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/config', { email: CARLOS, largura: DESKTOP })

    const nome = await screen.findByLabelText('Nome')
    expect(nome).toHaveValue('Mercadinho Vila Nova')
    expect(within(grupo('Janela de reserva padrão')).getByRole('button', { name: '4 h' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Localização encontrada/)).toBeInTheDocument()
    expect(barra()).not.toBeInTheDocument()

    await usuario.type(nome, ' 2')
    expect(barra()).toBeInTheDocument()
    await usuario.click(within(barra()!).getByRole('button', { name: 'Descartar' }))
    expect(barra()).not.toBeInTheDocument()
    expect(nome).toHaveValue('Mercadinho Vila Nova')
  })

  it('salvar manda só o que mudou (PATCH parcial) e a barra some', async () => {
    const usuario = userEvent.setup()
    const pecas = criarPecas()
    const atualizar = vi.spyOn(pecas.mock.configuracao, 'atualizarLoja')
    await abrir('/loja/1/config', { email: CARLOS, largura: DESKTOP, pecas })

    await usuario.click(within(await screen.findByRole('group', { name: 'Janela de reserva padrão' })).getByRole('button', { name: '8 h' }))
    await usuario.click(within(grupo('Margem antes da validade, em dias')).getByRole('button', { name: 'Aumentar' }))
    await usuario.click(within(barra()!).getByRole('button', { name: 'Salvar alterações' }))

    expect(atualizar).toHaveBeenCalledWith(1, { janela_padrao_horas: 8, margem_fim_dias: 2 })
    await waitFor(() => expect(barra()).not.toBeInTheDocument())
    expect(screen.getByText('Configurações salvas.')).toBeInTheDocument()
    expect(within(grupo('Janela de reserva padrão')).getByRole('button', { name: '8 h' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('o 400 da API (antecedência ≤ margem) aparece na barra, que continua aberta', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/config', { email: CARLOS, largura: DESKTOP })
    const margem = within(await screen.findByRole('group', { name: 'Margem antes da validade, em dias' }))
    for (let i = 0; i < 6; i++) await usuario.click(margem.getByRole('button', { name: 'Aumentar' })) // 1 → 7
    const antecedencia = within(grupo('Antecedência do aviso, em dias'))
    for (let i = 0; i < 3; i++) await usuario.click(antecedencia.getByRole('button', { name: 'Diminuir' })) // 10 → 7
    await usuario.click(within(barra()!).getByRole('button', { name: 'Salvar alterações' }))

    expect(await within(barra()!).findByRole('alert')).toHaveTextContent('A antecedência do aviso precisa ser maior que a margem')
  })

  it('mudar o nome atualiza o nome da loja no menu', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/config', { email: CARLOS, largura: DESKTOP })
    const nome = await screen.findByLabelText('Nome')
    await usuario.clear(nome)
    await usuario.type(nome, 'Vila Nova Express')
    await usuario.click(within(barra()!).getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Vila Nova Express', { selector: 'nav *, aside *' })).toBeInTheDocument()
  })

  it('equipe: "você" sem Remover; adicionar pelo e-mail (erro no campo) e remover com confirmação', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/config', { email: CARLOS, largura: DESKTOP })
    const tabela = await screen.findByRole('table', { name: 'Equipe da loja' })
    const carlos = within(tabela).getByText('Carlos Lima').closest('tr')!
    expect(carlos).toHaveTextContent('Responsável · você')
    expect(within(carlos).queryByRole('button', { name: /Remover/ })).not.toBeInTheDocument()

    const email = screen.getByLabelText('E-mail da conta')
    await usuario.type(email, 'ninguem@email.com')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar à equipe' }))
    expect(await screen.findByText('Não existe conta com esse e-mail. Peça para a pessoa se cadastrar.')).toBeInTheDocument()
    expect(email).toHaveAttribute('aria-invalid', 'true')

    await usuario.clear(email)
    await usuario.type(email, 'ana@email.com')
    await usuario.click(screen.getByRole('button', { name: 'Adicionar à equipe' }))
    expect(await within(tabela).findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('Ana Souza entrou na equipe (Funcionário).')).toBeInTheDocument()

    await usuario.click(within(tabela).getByRole('button', { name: 'Remover Juliana Prado' }))
    const dialogo = screen.getByRole('dialog', { name: 'Remover Juliana Prado da equipe?' })
    await usuario.click(within(dialogo).getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(within(tabela).queryByText('Juliana Prado')).not.toBeInTheDocument())
    expect(screen.getByText('Juliana Prado saiu da equipe.')).toBeInTheDocument()
  })

  it('no celular (L14): mesma tela, e-mail embaixo do nome', async () => {
    await abrir('/loja/1/config', { email: CARLOS, largura: 390 })
    const tabela = await screen.findByRole('table', { name: 'Equipe da loja' })
    expect(within(tabela).getByText('Carlos Lima').closest('td')).toHaveTextContent('carlos@vilanova.com.br')
    expect(within(tabela).queryByRole('columnheader', { name: 'E-mail da conta' })).not.toBeInTheDocument()
  })
})

describe('G2 · janela inicial', () => {
  it('começa pela janela padrão da loja (grupo E)', async () => {
    const pecas = criarPecas()
    vi.spyOn(pecas.mock.configuracao, 'obterLoja').mockResolvedValue({
      id: 1,
      nome: 'Mercadinho Vila Nova',
      endereco: 'Rua das Palmeiras, 410 · Boa Vista',
      latitude: -20.8113,
      longitude: -49.3758,
      janela_padrao_horas: 2,
      margem_fim_dias: 1,
      antecedencia_aviso_dias: 10,
    })
    await abrir('/loja/1/projecao', { email: CARLOS, largura: DESKTOP, pecas })
    await waitFor(() =>
      expect(within(screen.getByRole('group', { name: 'Janela de reserva' })).getByRole('button', { name: '2 h' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
  })
})

describe('L14 / G6 · endereço → coordenada (mapa falso, sem internet)', () => {
  async function trocarEndereco(usuario: ReturnType<typeof userEvent.setup>, endereco: string) {
    const campo = await screen.findByLabelText('Endereço')
    await usuario.clear(campo)
    await usuario.type(campo, endereco)
    await usuario.click(within(barra()!).getByRole('button', { name: 'Salvar alterações' }))
  }

  it('achou: mostra onde achou e só salva depois de confirmar, com a coordenada junto', async () => {
    const usuario = userEvent.setup()
    const geocodificar = vi.fn(geocodificarFalso)
    const pecas = criarPecas({ geocodificarEndereco: geocodificar })
    const atualizar = vi.spyOn(pecas.mock.configuracao, 'atualizarLoja')
    await abrir('/loja/1/config', { email: CARLOS, largura: DESKTOP, pecas })
    await trocarEndereco(usuario, 'Rua Bahia, 50, Centro')

    expect(geocodificar).toHaveBeenCalledTimes(1) // uma busca por clique, nada de autocompletar
    expect(await within(barra()!).findByText(/São José do Rio Preto - SP\. É aqui\?/)).toBeInTheDocument()
    expect(atualizar).not.toHaveBeenCalled()

    await usuario.click(within(barra()!).getByRole('button', { name: 'Salvar com esta localização' }))
    expect(atualizar).toHaveBeenCalledWith(1, { endereco: 'Rua Bahia, 50, Centro', latitude: -20.8051, longitude: -49.3812 })
    await waitFor(() => expect(barra()).not.toBeInTheDocument())
    expect(screen.getByText(/Localização encontrada · usada para calcular a distância/)).toBeInTheDocument()
  })

  it('não achou: "Salvar sem localização" apaga a coordenada (latitude e longitude null)', async () => {
    const usuario = userEvent.setup()
    const pecas = criarPecas()
    const atualizar = vi.spyOn(pecas.mock.configuracao, 'atualizarLoja')
    await abrir('/loja/1/config', { email: CARLOS, largura: DESKTOP, pecas })
    await trocarEndereco(usuario, 'Rua Inexistente, 1')

    expect(await within(barra()!).findByText('Não encontramos esse endereço no mapa.')).toBeInTheDocument()
    await usuario.click(within(barra()!).getByRole('button', { name: 'Salvar sem localização' }))
    expect(atualizar).toHaveBeenCalledWith(1, { endereco: 'Rua Inexistente, 1', latitude: null, longitude: null })
    expect(await screen.findByText(/Sem localização: a loja aparece no fim da lista/)).toBeInTheDocument()
  })

  it('"Corrigir endereço" volta ao campo; sem internet, a frase aparece e dá para tentar de novo', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/config', { email: CARLOS, largura: DESKTOP })
    await trocarEndereco(usuario, 'Rua Inexistente, 1')
    await usuario.click(await within(barra()!).findByRole('button', { name: 'Corrigir endereço' }))
    expect(screen.getByLabelText('Endereço')).toHaveFocus()
    expect(within(barra()!).getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument()

    await trocarEndereco(usuario, 'Rua sem rede, 1')
    expect(await within(barra()!).findByRole('alert')).toHaveTextContent('Não foi possível buscar o endereço no mapa agora.')
    expect(within(barra()!).getByRole('button', { name: 'Salvar alterações' })).toBeEnabled()
  })

  it('sem mudar o endereço, o mapa não é consultado', async () => {
    const usuario = userEvent.setup()
    const geocodificar = vi.fn(geocodificarFalso)
    await abrir('/loja/1/config', { email: CARLOS, largura: DESKTOP, pecas: criarPecas({ geocodificarEndereco: geocodificar }) })
    await usuario.type(await screen.findByLabelText('Nome'), ' 2')
    await usuario.click(within(barra()!).getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(barra()).not.toBeInTheDocument())
    expect(geocodificar).not.toHaveBeenCalled()
  })
})
