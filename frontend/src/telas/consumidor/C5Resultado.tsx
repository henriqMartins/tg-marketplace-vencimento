import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import type { Reserva, ResultadoReserva } from '../../api'
import { useApi } from '../../app/contextos'
import { Botao } from '../../componentes/Botao'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { MensagemErro } from '../../componentes/Mensagem'
import { useToast } from '../../componentes/toast/contexto'
import { classes } from '../../util/classes'
import { formatarDinheiro, formatarHorario } from '../../util/formatar'
import { FolhaCancelar } from './FolhaCancelar'
import styles from './Consumidor.module.css'

/**
 * C5 · Resultado da reserva. O estado vem da RESPOSTA da API:
 *   confirmada (quantidade == pedido) · parcial (quantidade < pedido) · recusada (409, sem reserva).
 */
export function C5Resultado() {
  const id = Number(useParams().id)
  const api = useApi()
  const rota = useLocation()
  const navegar = useNavigate()
  const mostrarToast = useToast()
  const [cancelando, setCancelando] = useState(false)

  const doEnvio = rota.state as ResultadoReserva | null
  const reserva = useQuery({
    queryKey: ['reserva', id],
    queryFn: () => api.consumidor.obterReserva(id),
    initialData: doEnvio && doEnvio.status !== 'recusada' && doEnvio.reserva.id === id ? doEnvio.reserva : undefined,
  })

  if (reserva.isPending) return <EsqueletoLista quantidade={1} />
  if (reserva.isError) return <MensagemErro erro={reserva.error} />

  const r = reserva.data
  // Já não está ativa (cancelou, expirou, retirou): a tela da reserva mostra o desfecho.
  if (r.estado !== 'reservada') return <Navigate to={`/reservas/${r.id}`} replace />

  const parcial = r.quantidade < r.pedido
  const item = `${r.quantidade} × ${r.oferta.produto.nome}`
  const verCodigo = () => navegar(`/reservas/${r.id}`)

  if (!parcial) {
    return (
      <div className={styles.resultado}>
        <span className={classes(styles.circuloResultado, styles.circuloSucesso)} aria-hidden="true">
          ✓
        </span>
        <h1 className={styles.tituloLista}>Reservado!</h1>
        <p>
          {item} · {r.oferta.loja.nome}
        </p>
        <p className={styles.texto}>
          Retire até {formatarHorario(r.expira_em)}. Você paga {formatarDinheiro(r.total)} na loja.
        </p>
        <Botao onClick={verCodigo}>Ver código de retirada</Botao>
      </div>
    )
  }

  return (
    <div className={styles.resultado}>
      <span className={classes(styles.circuloResultado, styles.circuloAtencao)} aria-hidden="true">
        !
      </span>
      <h1 className={styles.tituloLista}>
        Reservamos {r.quantidade} de {r.pedido}
      </h1>
      <p className={styles.texto}>
        Alguém reservou antes e só {r.quantidade === 1 ? 'restava 1 unidade. Ela já está separada' : `restavam ${r.quantidade} unidades. Elas já estão separadas`} para você.
      </p>
      <ItemETotal reserva={r} />
      <Botao onClick={verCodigo}>{r.quantidade === 1 ? 'Manter a unidade' : `Manter as ${r.quantidade} unidades`}</Botao>
      <Botao variante="perigo" onClick={() => setCancelando(true)}>
        Cancelar a reserva
      </Botao>
      <FolhaCancelar
        reserva={r}
        aberta={cancelando}
        aoFechar={() => setCancelando(false)}
        aoCancelar={() => mostrarToast('Reserva cancelada. As unidades voltaram para a vitrine.')}
      />
    </div>
  )
}

function ItemETotal({ reserva }: { reserva: Reserva }) {
  return (
    <div className={styles.cartaoDetalhe}>
      <p>
        <strong>
          {reserva.quantidade} × {reserva.oferta.produto.nome}
        </strong>
      </p>
      <p className={styles.texto}>{reserva.oferta.loja.nome}</p>
      <p>
        A pagar na loja: <strong>{formatarDinheiro(reserva.total)}</strong>
      </p>
    </div>
  )
}

/** C5, estado recusada: a API respondeu 409 (livre era 0) e gravou uma Recusa. */
export function ResultadoRecusada({ recusa }: { recusa: Extract<ResultadoReserva, { status: 'recusada' }> }) {
  const navegar = useNavigate()
  return (
    <div className={styles.resultado}>
      <span className={classes(styles.circuloResultado, styles.circuloErro)} aria-hidden="true">
        ×
      </span>
      <h1 className={styles.tituloLista}>{recusa.erro}</h1>
      <p className={styles.texto}>
        Outra pessoa reservou as últimas unidades. A oferta volta para a vitrine se alguém cancelar ou deixar a reserva
        expirar.
      </p>
      <Botao onClick={() => navegar('/vitrine')}>Ver outras ofertas</Botao>
    </div>
  )
}
