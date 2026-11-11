/* Abre o app inteiro (rotas reais) numa rota, com as peças de teste. */
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { rotas } from '../app/rotas'
import { criarPecas, type OpcoesPecas } from './pecas'
import { definirLarguraTela } from './tela'

export const ANA = 'ana@email.com' // consumidora
export const CARLOS = 'carlos@vilanova.com.br' // responsável da loja 1
export const JULIANA = 'juliana.prado@email.com' // funcionária da loja 1

export interface OpcoesAbrir extends OpcoesPecas {
  /** Já entra logado com este e-mail. */
  email?: string
  largura?: number
  /** Reaproveita peças de uma abertura anterior (ex.: "reabrir o app"). */
  pecas?: ReturnType<typeof criarPecas>
}

export async function abrir(caminho: string, { email, largura, pecas: existentes, ...opcoes }: OpcoesAbrir = {}) {
  const pecas = existentes ?? criarPecas(opcoes)
  if (email) await pecas.entrarComo(email)
  if (largura) definirLarguraTela(largura)
  const roteador = createMemoryRouter(rotas, { initialEntries: [caminho] })
  const tela = render(
    <pecas.Provedor>
      <RouterProvider router={roteador} />
    </pecas.Provedor>,
  )
  const caminhoAtual = () => roteador.state.location.pathname + roteador.state.location.search
  return { ...pecas, pecas, roteador, caminhoAtual, tela }
}
