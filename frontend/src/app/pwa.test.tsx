import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { abrir, ANA } from '../test/abrir'
import { ouvirInstalacao, reiniciarInstalacao } from './instalacao'
import { NOME_DO_APP } from './marca'
import { FORA_DO_APP, MANIFESTO } from './pwa'
import { avisarVersaoNova } from './servico'

describe('PWA · manifesto', () => {
  it('nome, idioma, cores do tema e ícones (192, 512 e maskable)', () => {
    expect(MANIFESTO).toMatchObject({
      name: NOME_DO_APP,
      lang: 'pt-BR',
      display: 'standalone',
      start_url: '/',
      theme_color: '#1E6A48',
      background_color: '#F6F5F1',
    })
    const icones = MANIFESTO.icons!.map((i) => `${i.sizes} ${i.purpose}`)
    expect(icones).toEqual(['192x192 any', '512x512 any', '512x512 maskable'])
  })

  it('o service worker nunca responde a API com o app', () => {
    const fora = (caminho: string) => FORA_DO_APP.some((r) => r.test(caminho))
    expect(fora('/api/ofertas')).toBe(true)
    expect(fora('/health')).toBe(true)
    expect(fora('/vitrine')).toBe(false)
    expect(fora('/loja/1/avisos')).toBe(false)
  })
})

/** O `beforeinstallprompt` do Chrome, com `prompt` falso. */
function pedidoDoNavegador() {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: string }>
  }
  evento.prompt = vi.fn(async () => {})
  evento.userChoice = Promise.resolve({ outcome: 'accepted' })
  return evento
}

describe('C9 · Instalar na tela inicial', () => {
  let desligar = () => {}
  afterEach(() => {
    desligar()
    reiniciarInstalacao()
  })

  it('sem o pedido do navegador (iPhone): mostra o caminho pelo Compartilhar', async () => {
    desligar = ouvirInstalacao()
    await abrir('/perfil', { email: ANA })
    expect(await screen.findByText('Instalar na tela inicial')).toBeInTheDocument()
    expect(screen.getByText(/No iPhone: toque em Compartilhar/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Instalar na tela inicial/ })).not.toBeInTheDocument()
  })

  it('com o pedido: o botão abre o pedido do navegador; depois de instalado, só informa', async () => {
    const usuario = userEvent.setup()
    desligar = ouvirInstalacao()
    await abrir('/perfil', { email: ANA })
    const evento = pedidoDoNavegador()
    act(() => void window.dispatchEvent(evento))
    expect(evento.defaultPrevented).toBe(true) // o navegador não mostra a faixa dele

    await usuario.click(await screen.findByRole('button', { name: /Instalar na tela inicial/ }))
    expect(evento.prompt).toHaveBeenCalledTimes(1)

    act(() => void window.dispatchEvent(new Event('appinstalled')))
    expect(await screen.findByText('App instalado neste aparelho')).toBeInTheDocument()
  })
})

describe('Versão nova do app', () => {
  it('avisa com o toast e só atualiza quando a pessoa toca em "Atualizar"', async () => {
    const usuario = userEvent.setup()
    await abrir('/vitrine')
    const atualizar = vi.fn(async () => {})
    act(() => avisarVersaoNova(atualizar))

    expect(await screen.findByText('Nova versão disponível.')).toBeInTheDocument()
    expect(atualizar).not.toHaveBeenCalled()
    await usuario.click(screen.getByRole('button', { name: 'Atualizar' }))
    await waitFor(() => expect(atualizar).toHaveBeenCalledTimes(1))
  })
})
