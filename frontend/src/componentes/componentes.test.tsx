/* Testes dos componentes pequenos (sem estado próprio). */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AmostraFita } from './AmostraFita'
import { Botao, BotaoIcone } from './Botao'
import { Chip } from './Chip'
import { EsqueletoLista } from './Esqueleto'
import { EstadoVazio } from './EstadoVazio'
import { IconeSacola, IconeVoltar } from './icones'
import { SeloGrupo, SeloOferta, SeloReserva } from './Selo'
import { formatarData, formatarDataCurta, formatarDinheiro, formatarDistancia, formatarHorario, formatarTempoRestante } from '../util/formatar'
import { previaTotal } from '../util/dinheiro'
import { ErroApi } from '../api'
import { MensagemErro } from './Mensagem'

describe('Botao', () => {
  it('é type="button" por padrão (não envia formulário sem querer)', () => {
    render(<Botao>Reservar</Botao>)
    expect(screen.getByRole('button', { name: 'Reservar' })).toHaveAttribute('type', 'button')
  })

  it('carregando: trava, avisa ocupado e mostra o texto de envio', async () => {
    const aoClicar = vi.fn()
    render(<Botao carregando onClick={aoClicar}>Reservar</Botao>)
    const botao = screen.getByRole('button', { name: 'Enviando…' })
    expect(botao).toBeDisabled()
    expect(botao).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(botao)
    expect(aoClicar).not.toHaveBeenCalled()
  })

  it('botão de ícone tem nome acessível', () => {
    render(
      <BotaoIcone rotulo="Voltar">
        <IconeVoltar />
      </BotaoIcone>,
    )
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument()
  })
})

describe('Chip', () => {
  it('informa se está ativo (aria-pressed)', () => {
    render(
      <>
        <Chip ativo>Laticínios</Chip>
        <Chip ativo={false}>Frios</Chip>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Laticínios' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Frios' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('AmostraFita', () => {
  it('sempre mostra o nome da cor e a data exata; o quadrado de cor é decorativo', () => {
    const { container } = render(
      <AmostraFita fita={{ cor: 'branco', bimestre: 'set–out', ano: 2026 }} data="2026-10-28" />,
    )
    expect(container).toHaveTextContent('Fita Branco · vence 28/10/2026')
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })

  it('aceita outro rótulo para a data (referência do grupo)', () => {
    const { container } = render(
      <AmostraFita fita={{ cor: 'preto', bimestre: 'nov–dez', ano: 2026 }} data="2026-12-09" rotuloData="ref." tamanho="linha" />,
    )
    expect(container).toHaveTextContent('Fita Preto · ref. 09/12/2026')
  })
})

describe('Selos', () => {
  it('texto e não só cor, para reserva, oferta e grupo', () => {
    render(
      <>
        <SeloReserva estado="expirada" />
        <SeloOferta estado="ativa" />
        <SeloGrupo situacao="adiado" />
      </>,
    )
    expect(screen.getByText('Expirada')).toBeInTheDocument()
    expect(screen.getByText('Oferta ativa')).toBeInTheDocument()
    expect(screen.getByText('Aviso adiado')).toBeInTheDocument()
  })
})

describe('EsqueletoLista', () => {
  it('anuncia "Carregando…" uma vez só', () => {
    render(<EsqueletoLista quantidade={3} />)
    expect(screen.getByRole('status')).toHaveTextContent(/^Carregando…$/)
  })
})

describe('EstadoVazio', () => {
  it('ícone + frase + uma ação', async () => {
    const verOfertas = vi.fn()
    render(
      <EstadoVazio icone={<IconeSacola />} frase="Nenhuma reserva ativa" acao={{ rotulo: 'Ver ofertas', aoClicar: verOfertas }} />,
    )
    expect(screen.getByText('Nenhuma reserva ativa')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver ofertas' }))
    expect(verOfertas).toHaveBeenCalledTimes(1)
  })
})

describe('formatar', () => {
  it('data da API → dd/mm/aaaa e dd/mm', () => {
    expect(formatarData('2026-10-28')).toBe('28/10/2026')
    expect(formatarData('2026-10-27T23:59:00-03:00')).toBe('27/10/2026')
    expect(formatarDataCurta('2026-10-28')).toBe('28/10')
  })
})

describe('Mensagem', () => {
  it('erro da API vira a frase do contrato, anunciada com role="alert"', () => {
    render(<MensagemErro erro={new ErroApi(409, 'acima_do_livre', 'Só há 6 unidades livres.')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Só há 6 unidades livres.')
    expect(screen.getByRole('alert')).not.toHaveTextContent('409')
  })
})

describe('formatar dinheiro e distância', () => {
  it('texto da API → R$ com vírgula e milhar, sem conta decimal', () => {
    expect(formatarDinheiro('3.14')).toBe('R$ 3,14')
    expect(formatarDinheiro('1234.50')).toBe('R$ 1.234,50')
    expect(formatarDinheiro('0.10')).toBe('R$ 0,10')
    expect(formatarDistancia(0.4)).toBe('0,4 km')
    expect(formatarDistancia(12.25)).toBe('12,3 km')
  })
})

describe('formatar horário e tempo restante', () => {
  const agora = new Date('2026-10-22T16:00:00-03:00')
  it('hoje / amanhã / data, sempre no horário de Brasília', () => {
    expect(formatarHorario('2026-10-22T20:00:00-03:00', agora)).toBe('hoje, 20:00')
    expect(formatarHorario('2026-10-23T23:00:00Z', agora)).toBe('amanhã, 20:00') // UTC → Brasília
    expect(formatarHorario('2026-10-27T23:59:00-03:00', agora)).toBe('27/10, 23:59')
  })
  it('tempo restante', () => {
    expect(formatarTempoRestante((3 * 60 + 42) * 60_000)).toBe('3 h 42 min')
    expect(formatarTempoRestante(52 * 60_000 + 30_000)).toBe('52 min')
    expect(formatarTempoRestante(20_000)).toBe('menos de 1 min')
  })
  it('prévia do total em centavos (sem erro de arredondamento)', () => {
    expect(previaTotal('3.14', 2)).toBe('6.28')
    expect(previaTotal('0.10', 3)).toBe('0.30') // 0.1 * 3 em número daria 0.30000000000000004
    expect(previaTotal('13.99', 1)).toBe('13.99')
  })
})
