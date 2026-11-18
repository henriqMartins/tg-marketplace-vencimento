import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CNPJ_ATIVA } from '../../api/mock/grupo-i'
import { abrir, ANA, EQUIPE, MARCOS } from '../../test/abrir'
import { criarPecas } from '../../test/pecas'

/** A equipe cadastra a Mercearia São Jorge com convite para o Marcos (direto no mock). */
async function prepararConvite(pecas = criarPecas()) {
  await pecas.entrarComo(EQUIPE)
  const { loja, convite } = await pecas.mock.parceria.cadastrarLoja({
    cnpj: CNPJ_ATIVA,
    nome: 'Mercearia São Jorge',
    endereco: 'Rua Bernardino de Campos, 1500 · Centro',
    latitude: null,
    longitude: null,
    telefone: '17999990000',
    email_responsavel: MARCOS,
    interesse_id: 3,
  })
  return { pecas, loja, convite }
}

describe('A6 · Quero ser parceiro', () => {
  it('envia o pedido, mostra "Recebemos seu pedido" e a A4 passa a mostrar o pedido recebido', async () => {
    const usuario = userEvent.setup()
    const { roteador } = await abrir('/parceiro', { email: ANA })
    expect(await screen.findByRole('heading', { name: 'Seu mercado na plataforma' })).toBeInTheDocument()
    await usuario.type(screen.getByLabelText('Nome do mercado'), 'Empório da Ana')
    await usuario.type(screen.getByLabelText('Cidade'), 'Mirassol')
    await usuario.type(screen.getByLabelText('Telefone (WhatsApp)'), '17988887777')
    await usuario.click(screen.getByRole('button', { name: 'Enviar pedido' }))

    expect(await screen.findByRole('heading', { name: 'Recebemos seu pedido' })).toBeInTheDocument()
    const dados = screen.getByRole('region', { name: 'Dados enviados' })
    expect(dados).toHaveTextContent('Empório da Ana')
    expect(dados).not.toHaveTextContent('Mensagem') // opcional, não enviada
    expect(screen.getByRole('region', { name: 'O que acontece agora' })).toBeInTheDocument()

    await roteador.navigate('/escolher')
    expect(await screen.findByRole('link', { name: /Pedido de parceria recebido/ })).toBeInTheDocument()
  })

  it('campos obrigatórios avisam embaixo de cada campo, sem chamar a API', async () => {
    const usuario = userEvent.setup()
    await abrir('/parceiro', { email: ANA })
    await usuario.click(await screen.findByRole('button', { name: 'Enviar pedido' }))
    expect(screen.getByLabelText('Nome do mercado')).toHaveAccessibleDescription('Informe o nome do mercado.')
    expect(screen.getByLabelText('Cidade')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Telefone (WhatsApp)')).toHaveAttribute('aria-invalid', 'true')
  })

  it('com pedido em aberto: modo leitura, sem formulário', async () => {
    await abrir('/parceiro', { email: MARCOS })
    const pedido = await screen.findByRole('region', { name: 'Seu pedido' })
    expect(within(pedido).getByText('Recebido')).toBeInTheDocument()
    expect(pedido).toHaveTextContent(/Enviado em \d{2}\/\d{2}/)
    expect(screen.queryByRole('button', { name: 'Enviar pedido' })).toBeNull()
  })

  it('sem login → /entrar com volta para a A6', async () => {
    const { caminhoAtual } = await abrir('/parceiro')
    await waitFor(() => expect(caminhoAtual()).toBe('/entrar?voltar=%2Fparceiro'))
  })
})

describe('A7 · Convite para ativar a loja', () => {
  it('aceito: vira responsável e abre a L14 da loja', async () => {
    const usuario = userEvent.setup()
    const { pecas, loja, convite } = await prepararConvite()
    await pecas.entrarComo(MARCOS)
    const { caminhoAtual } = await abrir(`/convite/${convite.codigo}`, { pecas })

    const cartao = await screen.findByRole('region', { name: 'Loja do convite' })
    expect(cartao).toHaveTextContent('Mercearia São Jorge')
    expect(cartao).toHaveTextContent('Convite para marcos@example.com')
    expect(cartao).toHaveTextContent('Vale até 29/10') // 22/10 + 7 dias
    await usuario.click(screen.getByRole('button', { name: 'Aceitar e ativar a loja' }))

    await waitFor(() => expect(caminhoAtual()).toBe(`/loja/${loja.id}/config`))
    expect(await screen.findByRole('heading', { name: 'Configurações da loja' })).toBeInTheDocument()
  })

  it('403 e-mail diferente: diz com qual conta entrar e oferece trocar', async () => {
    const usuario = userEvent.setup()
    const { pecas, convite } = await prepararConvite()
    await pecas.entrarComo(ANA)
    const { caminhoAtual } = await abrir(`/convite/${convite.codigo}`, { pecas })
    await usuario.click(await screen.findByRole('button', { name: 'Aceitar e ativar a loja' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este convite é para outro e-mail. Entre com a conta de m…@example.com.',
    )
    await usuario.click(screen.getByRole('button', { name: 'Entrar com outra conta' }))
    await waitFor(() => expect(caminhoAtual()).toBe(`/entrar?voltar=${encodeURIComponent(`/convite/${convite.codigo}`)}`))
  })

  it('410 vencido (ou trocado por um novo)', async () => {
    const { pecas, loja, convite } = await prepararConvite()
    await pecas.mock.parceria.novoConvite(loja.id) // o antigo deixa de valer
    await pecas.entrarComo(MARCOS)
    await abrir(`/convite/${convite.codigo}`, { pecas })
    expect(await screen.findByRole('alert')).toHaveTextContent('Este convite venceu. Peça um novo à equipe da plataforma.')
    expect(screen.queryByRole('button', { name: 'Aceitar e ativar a loja' })).toBeNull()
  })

  it('409 já usado', async () => {
    const { pecas, convite } = await prepararConvite()
    await pecas.entrarComo(MARCOS)
    await pecas.mock.parceria.aceitarConvite(convite.codigo)
    await abrir(`/convite/${convite.codigo}`, { pecas })
    expect(await screen.findByRole('alert')).toHaveTextContent('Este convite já foi usado.')
  })

  it('404 não encontrado', async () => {
    await abrir('/convite/codigo-que-nao-existe', { email: MARCOS })
    expect(await screen.findByRole('alert')).toHaveTextContent('Convite não encontrado.')
  })

  it('sem login: entra e volta para o convite', async () => {
    const usuario = userEvent.setup()
    const { pecas, convite } = await prepararConvite()
    pecas.armazem.limpar()
    const { caminhoAtual } = await abrir(`/convite/${convite.codigo}`, { pecas })
    await waitFor(() => expect(caminhoAtual()).toMatch(/^\/entrar\?voltar=/))
    await usuario.type(await screen.findByLabelText('E-mail'), MARCOS)
    await usuario.type(screen.getByLabelText('Senha'), '12345678')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(caminhoAtual()).toBe(`/convite/${convite.codigo}`))
    expect(await screen.findByRole('button', { name: 'Aceitar e ativar a loja' })).toBeInTheDocument()
  })

  it('conta criada pelo link do convite volta direto para ele (sem a C1)', async () => {
    const usuario = userEvent.setup()
    const { pecas, convite } = await prepararConvite()
    pecas.armazem.limpar()
    const voltar = encodeURIComponent(`/convite/${convite.codigo}`)
    const { caminhoAtual } = await abrir(`/criar-conta?voltar=${voltar}`, { pecas })
    await usuario.type(await screen.findByLabelText('Nome'), 'Rita Alves')
    await usuario.type(screen.getByLabelText('E-mail'), 'rita@email.com')
    await usuario.type(screen.getByLabelText('Senha'), '12345678')
    await usuario.click(screen.getByRole('checkbox', { name: /Li e aceito os termos/ }))
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() => expect(caminhoAtual()).toBe(`/convite/${convite.codigo}`))
  })
})
