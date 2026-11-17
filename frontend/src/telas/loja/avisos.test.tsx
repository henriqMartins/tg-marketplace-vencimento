import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrir, JULIANA } from '../../test/abrir'
import { AGORA_TESTE } from '../../test/pecas'

// O mock nasce em 22/10/2026 (leite condensado: validade 28/10, fim 27/10 23:59, adiar até 26/10).
// O "hoje" das telas vem do relógio do aparelho: fixa só a data.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA_TESTE)
})
afterEach(() => vi.useRealTimers())

describe('L5 · Avisos', () => {
  it('cabeçalho com a antecedência; prazos urgente, normal e adiado', async () => {
    await abrir('/loja/1/avisos', { email: JULIANA })
    expect(await screen.findByText('5 avisos · antecedência da loja: 10 dias')).toBeInTheDocument()
    const leite = screen.getByText('Leite condensado 395 g').closest('a')!
    expect(leite).toHaveAttribute('href', '/loja/1/avisos/301')
    expect(within(leite).getByText('Vence em 6 dias').className).toMatch(/prazoUrgente/)
    expect(within(screen.getByText('Creme de leite 200 g').closest('a')!).getByText('Vence em 8 dias').className).not.toMatch(
      /prazoUrgente/,
    )
    expect(screen.getByText('Achocolatado em pó 400 g').closest('a')).toHaveTextContent('Adiado · volta amanhã')
  })
})

describe('L6 · Conferência na gôndola', () => {
  it('só conta (sem preço), até o recebido, e leva a contagem para a L7', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/loja/1/avisos/301', { email: JULIANA })
    expect(await screen.findByText('Vá à zona Branco da gôndola e conte as unidades que vão para a oferta.')).toBeInTheDocument()
    expect(screen.queryByText(/Desconto/)).not.toBeInTheDocument()

    const contador = within(screen.getByRole('group', { name: 'Unidades separadas' }))
    for (let i = 0; i < 3; i++) await usuario.click(contador.getByRole('button', { name: 'Aumentar' }))
    await usuario.click(screen.getByRole('button', { name: 'Continuar para publicar' }))
    expect(caminhoAtual()).toBe('/loja/1/avisos/301/publicar?separado=4')
  })

  it('"Não vai para oferta": escolhe o motivo e encerra o aviso sem oferta', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/loja/1/avisos/301', { email: JULIANA })
    await usuario.click(await screen.findByRole('button', { name: 'Não vai para oferta' }))
    const folha = screen.getByRole('dialog', { name: 'Não vai para oferta' })
    expect(within(folha).getByText('O aviso é encerrado sem criar oferta. Isso não conta como perda no painel.')).toBeInTheDocument()
    const encerrar = within(folha).getByRole('button', { name: 'Encerrar aviso' })
    expect(encerrar).toBeDisabled()

    await usuario.click(within(folha).getByLabelText('Não sobrou nenhuma unidade'))
    await usuario.click(encerrar)
    await waitFor(() => expect(caminhoAtual()).toBe('/loja/1/avisos'))
    expect(screen.getByText('Aviso encerrado sem oferta.')).toBeInTheDocument()
    expect(await screen.findByText('4 avisos · antecedência da loja: 10 dias')).toBeInTheDocument()
    expect(screen.queryByText('Leite condensado 395 g')).not.toBeInTheDocument()
  })
})

describe('L8 · Adiar aviso', () => {
  it('opções depois do limite da API ficam desabilitadas; adiar volta para a lista', async () => {
    vi.setSystemTime(new Date('2026-10-24T10:00:00-03:00')) // na tela, "hoje" é 24/10; o limite é 26/10
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/loja/1/avisos/301', { email: JULIANA })
    await usuario.click(await screen.findByRole('button', { name: 'Adiar aviso' }))
    const folha = screen.getByRole('dialog', { name: 'Lembrar de novo quando?' })
    expect(within(folha).getByRole('button', { name: 'Em 3 dias' })).toBeDisabled() // 27/10
    expect(within(folha).getByText(/Depois disso não dá tempo de ofertar/)).toHaveTextContent('Até 26/10.')

    await usuario.click(within(folha).getByRole('button', { name: 'Em 2 dias' })) // 26/10
    await usuario.click(within(folha).getByRole('button', { name: 'Adiar aviso' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/loja/1/avisos'))
    expect(screen.getByText('Aviso adiado para 26/10.')).toBeInTheDocument()
  })
})

describe('L7 · Revisar e publicar', () => {
  it('sem confirmar a separação o botão fica bloqueado com "Confirme a separação"', async () => {
    const usuario = userEvent.setup()
    await abrir('/loja/1/avisos/301/publicar?separado=12', { email: JULIANA })
    expect(await screen.findByLabelText('Preço normal')).toHaveValue('6,99') // preço sugerido da API
    const bloqueado = screen.getByRole('button', { name: 'Confirme a separação' })
    expect(bloqueado).toBeDisabled()

    await usuario.click(screen.getByRole('checkbox', { name: /Separei as 12 unidades/ }))
    expect(screen.getByRole('button', { name: 'Publicar oferta' })).toBeEnabled()
    await usuario.click(screen.getByRole('checkbox', { name: /Separei as 12 unidades/ }))
    expect(screen.getByRole('button', { name: 'Confirme a separação' })).toBeDisabled()
  })

  it('prévia do preço, janela padrão da loja e publicação com os números da API', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/loja/1/avisos/301/publicar?separado=12', { email: JULIANA })
    await screen.findByLabelText('Preço normal')
    expect(screen.getByText(/Sai da vitrine/)).toHaveTextContent('Sai da vitrine em 27/10, 23:59')
    expect(within(screen.getByRole('group', { name: 'Janela de reserva' })).getByRole('button', { name: '4 h' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await usuario.click(within(screen.getByRole('group', { name: 'Desconto' })).getByRole('button', { name: '20%' }))
    expect(screen.getByText(/O valor final é o que o sistema grava/)).toHaveTextContent(/De R\$\s6,99 por R\$\s5,59/) // 5,592

    await usuario.click(screen.getByRole('checkbox', { name: /Separei as 12 unidades/ }))
    await usuario.click(screen.getByRole('button', { name: 'Publicar oferta' }))
    expect(await screen.findByRole('heading', { name: 'Oferta na vitrine' })).toBeInTheDocument()
    const resumo = screen.getByRole('region', { name: 'Oferta publicada' })
    expect(resumo).toHaveTextContent('12 un.')
    expect(resumo).toHaveTextContent(/R\$\s5,59/)
    expect(resumo).toHaveTextContent('27/10, 23:59')

    await usuario.click(screen.getByRole('button', { name: 'Ver a oferta' }))
    expect(caminhoAtual()).toMatch(/^\/loja\/1\/ofertas\/\d+$/)
    expect(await screen.findByText('12 = 12 + 0 + 0 + 0 + 0')).toBeInTheDocument()
  })

  it('409 fim_ja_passou vira a frase da especificação', async () => {
    const usuario = userEvent.setup()
    let relogio = AGORA_TESTE
    await abrir('/loja/1/avisos/301/publicar?separado=2', { email: JULIANA, agora: () => relogio })
    await screen.findByLabelText('Preço normal')
    relogio = new Date('2026-10-28T00:30:00-03:00') // o último dia (27/10) acabou enquanto a pessoa revisava
    await usuario.click(screen.getByRole('checkbox', { name: /Separei as 2 unidades/ }))
    await usuario.click(screen.getByRole('button', { name: 'Publicar oferta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Essa validade está perto demais: a oferta acabaria antes de começar.')
  })

  it('sem a contagem (?separado) volta para a L6', async () => {
    const { caminhoAtual } = await abrir('/loja/1/avisos/301/publicar', { email: JULIANA })
    await waitFor(() => expect(caminhoAtual()).toBe('/loja/1/avisos/301'))
  })
})
