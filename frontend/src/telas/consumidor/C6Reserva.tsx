import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { Reserva } from '../../api'
import { RECARGA_30S } from '../../app/consultas'
import { useApi } from '../../app/contextos'
import { useAgora } from '../../app/tempo'
import { Botao } from '../../componentes/Botao'
import { CodigoRetirada } from '../../componentes/CodigoRetirada'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { MensagemErro } from '../../componentes/Mensagem'
import { Selo, SeloReserva } from '../../componentes/Selo'
import { useToast } from '../../componentes/toast/contexto'
import { classes } from '../../util/classes'
import { formatarDinheiro, formatarHorario, formatarTempoRestante } from '../../util/formatar'
import { FolhaCancelar } from './FolhaCancelar'
import styles from './Consumidor.module.css'

const URGENTE_MS = 30 * 60_000 // especificação, C8: menos de 30 min em `urgent`

/**
 * C6 (código de retirada) e C7 (desfechos), na mesma rota /reservas/:id.
 * O QUE MOSTRAR é decidido pelo `estado` que a API devolve — revalidado a cada 30 s.
 */
export function C6Reserva() {
  const id = Number(useParams().id)
  const api = useApi()
  const consulta = useQuery({ queryKey: ['reserva', id], queryFn: () => api.consumidor.obterReserva(id), ...RECARGA_30S })

  if (consulta.isPending) return <EsqueletoLista quantidade={1} rotulo="Carregando reserva…" />
  if (consulta.isError) return <MensagemErro erro={consulta.error} />

  const r = consulta.data
  return (
    <div className={styles.reserva}>
      <h1 className={styles.tituloTela}>Sua reserva</h1>
      {r.estado === 'reservada' && <Codigo reserva={r} conferirAgora={consulta.refetch} />}
      {r.estado === 'expirada' && <Expirada reserva={r} />}
      {r.estado === 'retirada' && <Retirada reserva={r} />}
      {r.estado === 'cancelada' && <Cancelada reserva={r} />}
    </div>
  )
}

function Codigo({ reserva: r, conferirAgora }: { reserva: Reserva; conferirAgora: () => unknown }) {
  const agora = useAgora(1000)
  const mostrarToast = useToast()
  const [cancelando, setCancelando] = useState(false)

  // A contagem é LOCAL e só para exibir. Chegou a zero: pergunta à API (não marca nada sozinha).
  const restanteMs = new Date(r.expira_em).getTime() - agora.getTime()
  const acabou = restanteMs <= 0
  useEffect(() => {
    if (acabou) void conferirAgora()
  }, [acabou, conferirAgora])

  return (
    <>
      <section className={styles.cartaoCodigo} aria-labelledby="titulo-codigo">
        <Selo variante="success">✓ Reserva confirmada</Selo>
        <h2 id="titulo-codigo" className={styles.sobrelinha}>
          Código de retirada
        </h2>
        <CodigoRetirada codigo={r.codigo} />
        <p role="timer" className={classes(styles.contagemRegressiva, restanteMs < URGENTE_MS && styles.urgente)}>
          {acabou ? 'Conferindo com a loja…' : formatarTempoRestante(restanteMs)}
        </p>
        <p className={styles.texto}>para retirar · até {formatarHorario(r.expira_em, agora)}</p>
        <p className={styles.instrucao}>
          Informe este código no balcão. O lojista digita o código e você paga na retirada.
        </p>
      </section>

      <section className={styles.cartaoDetalhe} aria-label="Detalhes da reserva">
        <p>
          <strong>
            {r.quantidade} × {r.oferta.produto.nome}
          </strong>
          {r.quantidade < r.pedido && <span className={styles.texto}> (pediu {r.pedido})</span>}
        </p>
        <p>
          A pagar na loja: <strong>{formatarDinheiro(r.total)}</strong>
        </p>
        <p className={styles.texto}>
          {r.oferta.loja.nome}
          <br />
          {r.oferta.loja.endereco}
        </p>
      </section>

      <Botao variante="perigo" onClick={() => setCancelando(true)}>
        Cancelar reserva
      </Botao>
      <FolhaCancelar
        reserva={r}
        aberta={cancelando}
        aoFechar={() => setCancelando(false)}
        aoCancelar={() => mostrarToast('Reserva cancelada. As unidades voltaram para a vitrine.')}
      />
    </>
  )
}

function Expirada({ reserva: r }: { reserva: Reserva }) {
  const navegar = useNavigate()
  return (
    <section className={styles.cartaoCodigo}>
      <SeloReserva estado="expirada" />
      <CodigoRetirada codigo={r.codigo} invalido />
      <p className={styles.texto}>
        O prazo terminou {formatarHorario(r.encerrada_em ?? r.expira_em)} sem retirada. As unidades voltaram para a
        vitrine e este código não vale mais.
      </p>
      <Botao onClick={() => navegar(`/oferta/${r.oferta.id}`)}>Ver se ainda tem na vitrine</Botao>
    </section>
  )
}

function Retirada({ reserva: r }: { reserva: Reserva }) {
  const navegar = useNavigate()
  return (
    <section className={styles.cartaoCodigo}>
      <span className={classes(styles.circuloResultado, styles.circuloSucesso)} aria-hidden="true">
        ✓
      </span>
      <SeloReserva estado="retirada" />
      <p>
        Retirada {r.encerrada_em ? formatarHorario(r.encerrada_em) : ''} · Obrigado por evitar desperdício!
      </p>
      <p>
        {r.quantidade} × {r.oferta.produto.nome} · Você pagou <strong>{formatarDinheiro(r.total)}</strong>
      </p>
      <p className={styles.economia}>Você economizou {formatarDinheiro(r.economia)}</p>
      <Botao onClick={() => navegar('/vitrine')}>Voltar para a vitrine</Botao>
    </section>
  )
}

function Cancelada({ reserva: r }: { reserva: Reserva }) {
  const navegar = useNavigate()
  return (
    <section className={styles.cartaoCodigo}>
      <SeloReserva estado="cancelada" />
      <p className={styles.texto}>
        Você cancelou esta reserva {r.encerrada_em ? formatarHorario(r.encerrada_em) : ''}. As unidades voltaram para a
        vitrine.
      </p>
      <Botao onClick={() => navegar('/vitrine')}>Voltar para a vitrine</Botao>
    </section>
  )
}
