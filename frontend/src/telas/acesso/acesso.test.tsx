import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { abrir, ANA, CARLOS, JULIANA } from '../../test/abrir'

async function entrarPelaTela(email: string, senha = '12345678') {
  const usuario = userEvent.setup()
  await usuario.type(await screen.findByLabelText('E-mail'), email)
  await usuario.type(screen.getByLabelText('Senha'), senha)
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }))
  return usuario
}

describe('A2 · Entrar (celular) — redirecionamento por papel', () => {
  it('consumidora → vitrine', async () => {
    const { caminhoAtual } = await abrir('/entrar')
    await entrarPelaTela(ANA)
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
  })

  it('responsável no celular → escolher (A4)', async () => {
    const { caminhoAtual } = await abrir('/entrar')
    await entrarPelaTela(CARLOS)
    await waitFor(() => expect(caminhoAtual()).toBe('/escolher'))
  })

  it('senha errada → mensagem da API com role="alert" e continua em /entrar', async () => {
    const { caminhoAtual } = await abrir('/entrar')
    await entrarPelaTela(ANA, 'errada123')
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos. Confira e tente de novo.')
    expect(caminhoAtual()).toBe('/entrar')
  })

  it('campos vazios: avisa embaixo de cada campo, sem chamar a API', async () => {
    await abrir('/entrar')
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }))
    expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription('Informe seu e-mail.')
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true')
  })

  it('?voltar=/reservas: volta para lá depois de entrar', async () => {
    const { caminhoAtual } = await abrir('/entrar?voltar=%2Freservas')
    await entrarPelaTela(ANA)
    await waitFor(() => expect(caminhoAtual()).toBe('/reservas'))
  })

  it('?voltar=//site-falso.com é ignorado', async () => {
    const { caminhoAtual } = await abrir('/entrar?voltar=%2F%2Fsite-falso.com')
    await entrarPelaTela(ANA)
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
  })

  it('mostrar senha troca o campo entre senha e texto', async () => {
    await abrir('/entrar')
    const senha = await screen.findByLabelText('Senha')
    const olho = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(senha).toHaveAttribute('type', 'password')
    await userEvent.click(olho)
    expect(senha).toHaveAttribute('type', 'text')
    expect(olho).toHaveAttribute('aria-pressed', 'true')
  })

  it('não mostra "Esqueci minha senha" enquanto a recuperação não existe', async () => {
    await abrir('/entrar')
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(screen.queryByText(/Esqueci minha senha/)).toBeNull()
  })

  it('quem já está logado e abre /entrar vai direto para o destino', async () => {
    const { caminhoAtual } = await abrir('/entrar', { email: ANA })
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
  })
})

describe('A5 · Entrar no computador', () => {
  it('responsável → painel (G1); funcionária → L1', async () => {
    const carlos = await abrir('/entrar', { largura: 1280 })
    await entrarPelaTela(CARLOS)
    await waitFor(() => expect(carlos.caminhoAtual()).toBe('/loja/1/painel'))
    carlos.tela.unmount()

    const juliana = await abrir('/entrar', { largura: 1280 })
    await entrarPelaTela(JULIANA)
    await waitFor(() => expect(juliana.caminhoAtual()).toBe('/loja/1'))
  })

  it('sem "Manter conectado": token só no sessionStorage', async () => {
    const { local, sessao, caminhoAtual } = await abrir('/entrar', { largura: 1280 })
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Manter conectado neste computador' }))
    await entrarPelaTela(ANA)
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
    expect(sessao.getItem('tg.token')).not.toBeNull()
    expect(local.getItem('tg.token')).toBeNull()
  })
})

describe('A3 · Criar conta', () => {
  it('botão travado sem aceitar os termos', async () => {
    await abrir('/criar-conta')
    expect(await screen.findByRole('button', { name: 'Criar conta' })).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: /Li e aceito os termos/ }))
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeEnabled()
  })

  it('senha curta: avisa embaixo do campo ao sair dele', async () => {
    const usuario = userEvent.setup()
    await abrir('/criar-conta')
    await usuario.type(await screen.findByLabelText('Senha'), '123')
    await usuario.tab()
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription(
      'Pelo menos 8 caracteres. A senha precisa ter pelo menos 8 caracteres.',
    )
  })

  it('e-mail já usado (400 email_em_uso) aparece embaixo do e-mail', async () => {
    const usuario = userEvent.setup()
    await abrir('/criar-conta')
    await usuario.type(await screen.findByLabelText('Nome'), 'Outra Ana')
    await usuario.type(screen.getByLabelText('E-mail'), ANA)
    await usuario.type(screen.getByLabelText('Senha'), '12345678')
    await usuario.click(screen.getByRole('checkbox', { name: /Li e aceito os termos/ }))
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() =>
      expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription('Já existe uma conta com este e-mail.'),
    )
  })

  it('conta criada → C1 (/boas-vindas), já logada, mantendo o ?voltar', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual, armazem } = await abrir('/criar-conta?voltar=%2Foferta%2F1')
    await usuario.type(await screen.findByLabelText('Nome'), 'Rita Alves')
    await usuario.type(screen.getByLabelText('E-mail'), 'rita@email.com')
    await usuario.type(screen.getByLabelText('Senha'), '12345678')
    await usuario.click(screen.getByRole('checkbox', { name: /Li e aceito os termos/ }))
    await usuario.click(screen.getByRole('button', { name: 'Criar conta' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/boas-vindas?voltar=%2Foferta%2F1'))
    expect(armazem.obterToken()).not.toBeNull()
  })
})

describe('A4 · Escolher como entrar', () => {
  it('mostra "Comprar com desconto" e as lojas com o papel', async () => {
    await abrir('/escolher', { email: CARLOS })
    expect(await screen.findByText('Olá, Carlos')).toBeInTheDocument()
    const loja = screen.getByRole('link', { name: /Mercadinho Vila Nova/ })
    expect(within(loja).getByText('Responsável')).toBeInTheDocument()
    expect(loja).toHaveAttribute('href', '/loja/1')
    expect(screen.getByRole('link', { name: /Comprar com desconto/ })).toHaveAttribute('href', '/vitrine')
  })

  it('consumidora sem vínculo não fica na A4', async () => {
    const { caminhoAtual } = await abrir('/escolher', { email: ANA })
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
  })

  it('"Lembrar minha escolha": na próxima abertura (A1) pula a A4', async () => {
    const primeira = await abrir('/escolher', { email: CARLOS })
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Lembrar minha escolha neste aparelho' }))
    await userEvent.click(screen.getByRole('link', { name: /Mercadinho Vila Nova/ }))
    await waitFor(() => expect(primeira.caminhoAtual()).toBe('/loja/1'))
    primeira.tela.unmount()

    const reaberto = await abrir('/', { pecas: primeira.pecas }) // mesmo aparelho, app aberto de novo
    await waitFor(() => expect(reaberto.caminhoAtual()).toBe('/loja/1'))
  })

  it('sem marcar "Lembrar", a próxima abertura volta à A4', async () => {
    const primeira = await abrir('/escolher', { email: CARLOS })
    await userEvent.click(await screen.findByRole('link', { name: /Mercadinho Vila Nova/ }))
    await waitFor(() => expect(primeira.caminhoAtual()).toBe('/loja/1'))
    primeira.tela.unmount()

    const reaberto = await abrir('/', { pecas: primeira.pecas })
    await waitFor(() => expect(reaberto.caminhoAtual()).toBe('/escolher'))
  })
})
