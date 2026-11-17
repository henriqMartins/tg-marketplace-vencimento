import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'
import { criarPecas, memoria } from '../../test/pecas'
import { useSessao } from '../contextos'
import { criarArmazemSessao } from './armazem'

function QuemSou() {
  const { eu, token, papelNaLoja } = useSessao()
  if (!token) return <p>visitante</p>
  if (!eu) return <p>carregando</p>
  return (
    <p>
      {eu.nome} · loja 1: {papelNaLoja(1) ?? 'sem vínculo'} · loja 2: {papelNaLoja(2) ?? 'sem vínculo'}
    </p>
  )
}

describe('armazém da sessão', () => {
  it('lembrar → localStorage; não lembrar → sessionStorage; limpar apaga os dois', () => {
    const local = memoria()
    const sessao = memoria()
    const armazem = criarArmazemSessao(local, sessao)
    let avisos = 0
    armazem.assinar(() => avisos++)

    armazem.definir('abc', true)
    expect(local.getItem('tg.token')).toBe('abc')
    armazem.definir('def', false)
    expect([local.getItem('tg.token'), sessao.getItem('tg.token')]).toEqual([null, 'def'])
    expect(armazem.obterToken()).toBe('def')

    armazem.limpar()
    expect(armazem.obterToken()).toBeNull()
    expect(avisos).toBe(3)
  })

  it('navegador que não deixa gravar: guarda em memória', () => {
    const bloqueado = { getItem: () => null, setItem: () => { throw new Error('bloqueado') }, removeItem: () => {} }
    const armazem = criarArmazemSessao(bloqueado, bloqueado)
    armazem.definir('abc', true)
    expect(armazem.obterToken()).toBe('abc')
  })
})

describe('ProvedorSessao', () => {
  it('busca quem sou e o papel por loja', async () => {
    const { Provedor, entrarComo } = criarPecas()
    await entrarComo('carlos@vilanova.com.br')
    render(
      <Provedor>
        <QuemSou />
      </Provedor>,
    )
    expect(await screen.findByText('Carlos Lima · loja 1: responsavel · loja 2: sem vínculo')).toBeInTheDocument()
  })

  it('401 em qualquer consulta encerra a sessão neste aparelho', async () => {
    const { Provedor, entrarComo, mock, consultas, armazem } = criarPecas()
    await entrarComo('ana@email.com')
    render(
      <Provedor>
        <QuemSou />
      </Provedor>,
    )
    await screen.findByText(/Ana Souza/)

    await act(() => mock.acesso.sair()) // o token deixa de valer no servidor
    await act(() => consultas.invalidateQueries({ queryKey: ['eu'] })) // próxima leitura → 401

    expect(await screen.findByText('visitante')).toBeInTheDocument()
    expect(armazem.obterToken()).toBeNull()
  })

  it('entrar e sair pelo useSessao', async () => {
    const { Provedor } = criarPecas()
    const capturada: { sessao?: ReturnType<typeof useSessao> } = {}
    function Captura() {
      const sessao = useSessao()
      useEffect(() => {
        capturada.sessao = sessao
      })
      return <QuemSou />
    }
    render(
      <Provedor>
        <Captura />
      </Provedor>,
    )
    await act(() => capturada.sessao!.entrar({ email: 'juliana.prado@email.com', senha: '12345678' }))
    expect(await screen.findByText(/Juliana Prado · loja 1: funcionario/)).toBeInTheDocument()

    await act(() => capturada.sessao!.sair())
    expect(screen.getByText('visitante')).toBeInTheDocument()
  })
})
