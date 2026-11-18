import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { abrir, ANA, MARCOS } from '../../test/abrir'

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
