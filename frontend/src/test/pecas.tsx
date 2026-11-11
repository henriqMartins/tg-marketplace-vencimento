/*
 * Peças controladas para testes: armazenamento em memória, mock com relógio fixo e
 * sem atraso, consultas sem nova tentativa (a não ser que o teste peça).
 */
import type { ReactNode } from 'react'
import { ProvedorApp } from '../app/ProvedorApp'
import { criarClienteConsultas } from '../app/consultas'
import { criarArmazemSessao } from '../app/sessao/armazem'
import { criarClienteMock } from '../api/mock/cliente-mock'
import { SENHA_MOCK } from '../api/mock/semente'

/** "Hoje" do protótipo: 22/10/2026, 16:00 em Brasília. */
export const AGORA_TESTE = new Date('2026-10-22T16:00:00-03:00')

export function memoria(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const dados = new Map<string, string>()
  return {
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => void dados.set(chave, String(valor)),
    removeItem: (chave) => void dados.delete(chave),
  }
}

export interface OpcoesPecas {
  atrasoMs?: number
  agora?: () => Date
  /** Liga a nova tentativa automática (padrão: desligada, para o teste não esperar). */
  tentarDeNovo?: boolean
}

export function criarPecas({ atrasoMs = 0, agora = () => AGORA_TESTE, tentarDeNovo = false }: OpcoesPecas = {}) {
  const armazem = criarArmazemSessao(memoria(), memoria())
  const mock = criarClienteMock({ obterToken: armazem.obterToken, agora, atrasoMs })
  const consultas = criarClienteConsultas(() => armazem.limpar())
  if (!tentarDeNovo) {
    consultas.setDefaultOptions({ queries: { ...consultas.getDefaultOptions().queries, retry: false } })
  }

  async function entrarComo(email: string) {
    const { token } = await mock.acesso.entrar({ email, senha: SENHA_MOCK })
    armazem.definir(token, true)
  }

  function Provedor({ children }: { children: ReactNode }) {
    return (
      <ProvedorApp armazem={armazem} cliente={mock} consultas={consultas}>
        {children}
      </ProvedorApp>
    )
  }

  return { armazem, mock, consultas, entrarComo, Provedor }
}
