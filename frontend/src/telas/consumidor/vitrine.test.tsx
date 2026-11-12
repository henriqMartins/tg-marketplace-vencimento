import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErroPosicao } from '../../localizacao/posicao'
import { abrir, ANA } from '../../test/abrir'

describe('C2 · Vitrine', () => {
  it('lista as ofertas com o que veio da API (preço, desconto, livre, validade)', async () => {
    await abrir('/vitrine')
    expect(await screen.findByText('5 ofertas · ordenadas pelo fim mais próximo')).toBeInTheDocument()
    const iogurte = screen.getByRole('link', { name: /Iogurte natural 170 g/ })
    expect(iogurte).toHaveAttribute('href', '/oferta/1')
    expect(iogurte).toHaveTextContent('R$ 3,14')
    expect(iogurte).toHaveTextContent('antes R$ 4,49')
    expect(iogurte).toHaveTextContent('30% de desconto')
    expect(iogurte).toHaveTextContent('Vence 28/10 · 6 disponíveis')
  })

  it('chips viram filtros da API e ficam no endereço', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual, mock } = await abrir('/vitrine')
    const listar = vi.spyOn(mock.consumidor, 'listarOfertas')
    await screen.findByText(/5 ofertas/)

    await usuario.click(screen.getByRole('button', { name: 'Laticínios' }))
    expect(await screen.findByText(/2 ofertas/)).toBeInTheDocument()
    expect(caminhoAtual()).toBe('/vitrine?categoria=laticinios')
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ categoria: 'laticinios' }))

    await usuario.click(screen.getByRole('button', { name: '50%+' }))
    expect(caminhoAtual()).toBe('/vitrine?categoria=laticinios&desconto=50mais')
  })

  it('vazio (Frios + 50%+): "Nenhuma oferta com esses filtros" e "Limpar filtros" volta tudo', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/vitrine?categoria=frios&desconto=50mais')
    expect(await screen.findByText('Nenhuma oferta com esses filtros')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    expect(await screen.findByText(/5 ofertas/)).toBeInTheDocument()
    expect(caminhoAtual()).toBe('/vitrine')
  })

  it('busca pelo nome (sem acento, depois de uma pausa na digitação)', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/vitrine')
    await screen.findByText(/5 ofertas/)
    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar ofertas' }), 'requeijao')
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine?q=requeijao'))
    expect(await screen.findByText('Nenhuma oferta com esses filtros')).toBeInTheDocument() // requeijão está encerrado

    await usuario.clear(screen.getByRole('searchbox', { name: 'Buscar ofertas' }))
    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar ofertas' }), 'queijo')
    expect(await screen.findByText(/1 oferta ·/)).toBeInTheDocument()
  })

  it('carregando: esqueletos com "Carregando ofertas…"', async () => {
    await abrir('/vitrine', { atrasoMs: 60_000 })
    expect(await screen.findByText('Carregando ofertas…')).toBeInTheDocument()
  })
})

describe('C1 · Localização', () => {
  it('CEP encontrado: vitrine ordenada por distância, com lat/lng na consulta e o bairro no botão', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual, mock } = await abrir('/boas-vindas')
    const listar = vi.spyOn(mock.consumidor, 'listarOfertas')
    await usuario.type(await screen.findByLabelText('CEP'), '15025-000')
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
    expect(await screen.findByText('5 ofertas · ordenadas por distância')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Boa Vista · CEP 15025-000/ })).toBeInTheDocument()
    expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ lat: -20.810642, lng: -49.3855984 }))
    expect(screen.getByRole('link', { name: /Iogurte/ })).toHaveTextContent('Mercadinho Vila Nova · 0,4 km')
  })

  it('CEP não encontrado (C3): campo em erro, "Buscar de novo" e a nota da vitrine sem ordem', async () => {
    const usuario = userEvent.setup()
    await abrir('/boas-vindas')
    await usuario.type(await screen.findByLabelText('CEP'), '99999-999')
    await usuario.click(screen.getByRole('button', { name: 'Buscar' }))

    const campo = await screen.findByLabelText('CEP')
    await waitFor(() => expect(campo).toHaveAttribute('aria-invalid', 'true'))
    expect(campo).toHaveAccessibleDescription('Não encontramos esse CEP. Confira os números')
    expect(screen.getByRole('button', { name: 'Buscar de novo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar minha localização' })).toBeInTheDocument()
    expect(screen.getByText('Sem local, a vitrine aparece sem ordem de distância.')).toBeInTheDocument()
  })

  it('localização do navegador liberada → "Sua localização"', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/boas-vindas?voltar=%2Fvitrine%3Fcategoria%3Dfrios')
    await usuario.click(await screen.findByRole('button', { name: 'Usar minha localização' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine?categoria=frios')) // volta para onde estava
    expect(await screen.findByRole('link', { name: /Sua localização/ })).toBeInTheDocument()
  })

  it('localização negada: avisa e sugere o CEP', async () => {
    const usuario = userEvent.setup()
    await abrir('/boas-vindas', {
      obterPosicao: async () => {
        throw new ErroPosicao('negada')
      },
    })
    await usuario.click(await screen.findByRole('button', { name: 'Usar minha localização' }))
    expect(await screen.findByText('O navegador não liberou sua localização. Use o CEP.')).toBeInTheDocument()
  })

  it('"Ver todas sem ordenar por distância"', async () => {
    const usuario = userEvent.setup()
    const { caminhoAtual } = await abrir('/boas-vindas')
    await usuario.click(await screen.findByRole('button', { name: 'Ver todas sem ordenar por distância' }))
    await waitFor(() => expect(caminhoAtual()).toBe('/vitrine'))
    expect(await screen.findByRole('link', { name: /Escolher local/ })).toBeInTheDocument()
  })

  it('logada, na primeira escolha: a vitrine oferece os avisos (só desenhado, "em breve")', async () => {
    const usuario = userEvent.setup()
    await abrir('/boas-vindas', { email: ANA })
    await usuario.click(await screen.findByRole('button', { name: 'Ver todas sem ordenar por distância' }))
    const folha = await screen.findByRole('dialog', { name: 'Quer saber das ofertas novas?' })
    expect(within(folha).getByRole('button', { name: /Ativar avisos/ })).toBeDisabled()
    await usuario.click(within(folha).getByRole('button', { name: 'Agora não' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('visitante não recebe a oferta de avisos', async () => {
    const usuario = userEvent.setup()
    await abrir('/boas-vindas')
    await usuario.click(await screen.findByRole('button', { name: 'Ver todas sem ordenar por distância' }))
    await screen.findByText(/5 ofertas/)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
