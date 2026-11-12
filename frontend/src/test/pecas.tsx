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
import { ErroCep, limparCep, type BuscarCep } from '../localizacao/cep'
import type { ObterPosicao } from '../localizacao/posicao'

/** CEP falso: só 15025-000 (Boa Vista, Rio Preto) existe. */
export const buscarCepFalso: BuscarCep = async (texto) => {
  const cep = limparCep(texto)
  if (!cep) throw new ErroCep('invalido')
  if (cep !== '15025000') throw new ErroCep('nao_encontrado')
  return { lat: -20.810642, lng: -49.3855984, cep: '15025-000', bairro: 'Boa Vista', cidade: 'São José do Rio Preto' }
}

/** GPS falso: libera a posição. */
export const posicaoFalsa: ObterPosicao = async () => ({ lat: -20.8113, lng: -49.3758 })

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
  buscarCep?: BuscarCep
  obterPosicao?: ObterPosicao
}

export function criarPecas({
  atrasoMs = 0,
  agora = () => AGORA_TESTE,
  tentarDeNovo = false,
  buscarCep = buscarCepFalso,
  obterPosicao = posicaoFalsa,
}: OpcoesPecas = {}) {
  const local = memoria()
  const sessao = memoria()
  const armazem = criarArmazemSessao(local, sessao)
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
      <ProvedorApp armazem={armazem} cliente={mock} consultas={consultas} buscarCep={buscarCep} obterPosicao={obterPosicao}>
        {children}
      </ProvedorApp>
    )
  }

  return { armazem, local, sessao, mock, consultas, entrarComo, Provedor }
}
