import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import type { ItemPedido, MotivoRecusaItem, Pedido } from '../../api'
import { useApi } from '../../app/contextos'
import { Botao } from '../../componentes/Botao'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { MensagemErro } from '../../componentes/Mensagem'
import { useToast } from '../../componentes/toast/contexto'
import { classes } from '../../util/classes'
import { formatarDinheiro, formatarHorario } from '../../util/formatar'
import { FolhaCancelarPedido, type AlvoCancelar } from './FolhaCancelarPedido'
import styles from './Consumidor.module.css'

const contarItens = (n: number) => (n === 1 ? '1 item' : `${n} itens`)

/**
 * C5 · Resultado do pedido, POR ITEM (docs/pedido.md). Vem da resposta do POST /api/pedidos
 * (no `state` da navegação), que é a única que traz os recusados. Recarregou a página? Busca o
 * pedido; sem os recusados, o que mudou aparece pelo `status` (parcial) de cada reserva.
 */
export function C5Pedido() {
  const id = Number(useParams().id)
  const api = useApi()
  const rota = useLocation()
  const navegar = useNavigate()
  const mostrarToast = useToast()
  const [cancelar, setCancelar] = useState<AlvoCancelar | null>(null)

  const doEnvio = rota.state as Pedido | null
  const consulta = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => api.pedidos.obter(id),
    initialData: doEnvio?.id === id ? doEnvio : undefined,
  })

  if (consulta.isPending) return <EsqueletoLista quantidade={1} rotulo="Carregando pedido…" />
  if (consulta.isError) return <MensagemErro erro={consulta.error} />

  const pedido = consulta.data
  // Já não está ativo (cancelou, venceu, retirou): a tela do pedido mostra o desfecho.
  if (pedido.estado !== 'ativo') return <Navigate to={`/pedidos/${pedido.id}`} replace />

  // Os itens do envio (com os recusados), se ainda são deste pedido; senão, os de agora.
  const itens = doEnvio?.id === id ? doEnvio.itens : pedido.itens
  const reservados = itens.filter((i) => i.reserva_id !== null)
  const tudoCerto = itens.every((i) => i.status === 'confirmada')
  const verCodigo = () => navegar(`/pedidos/${pedido.id}`)

  if (tudoCerto) {
    return (
      <div className={styles.resultado}>
        <span className={classes(styles.circuloResultado, styles.circuloSucesso)} aria-hidden="true">
          ✓
        </span>
        <h1 className={styles.tituloLista}>Pedido confirmado!</h1>
        <p>
          {contarItens(reservados.length)} · {pedido.loja.nome}
        </p>
        <p className={styles.texto}>{reservados.map((i) => `${i.produto} ×${i.quantidade}`).join(' · ')}</p>
        <p className={styles.texto}>
          Retire até {pedido.expira_em_proximo ? formatarHorario(pedido.expira_em_proximo) : '—'}. Você paga{' '}
          {formatarDinheiro(pedido.total)} na loja, com um código só.
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
      <h1 className={styles.tituloLista}>Pedido confirmado com mudanças</h1>
      <p className={styles.texto}>Enquanto você montava o pedido, outras pessoas reservaram parte das unidades.</p>
      <ul className={styles.listaResultado} aria-label="Resultado por item">
        {itens.map((item) => (
          <LinhaResultado key={item.oferta_id} item={item} />
        ))}
      </ul>
      <p>
        Total na loja: <strong>{formatarDinheiro(pedido.total)}</strong>
      </p>
      <Botao onClick={verCodigo}>Manter o pedido</Botao>
      <Botao variante="perigo" onClick={() => setCancelar('pedido')}>
        Cancelar o pedido
      </Botao>
      <FolhaCancelarPedido
        pedido={pedido}
        alvo={cancelar}
        aoFechar={() => setCancelar(null)}
        aoCancelar={() => mostrarToast('Pedido cancelado. Os itens voltaram para a vitrine.')}
      />
    </div>
  )
}

/** ✓ confirmado · ! pediu N, reservamos M · × esgotou (ou a oferta terminou). */
function LinhaResultado({ item }: { item: ItemPedido }) {
  const [marca, classe, texto] =
    item.status === 'confirmada'
      ? ['✓', styles.marcaSucesso, `${item.produto} ×${item.quantidade} · confirmado`]
      : item.status === 'parcial'
        ? ['!', styles.marcaAtencao, `${item.produto}: pediu ${item.pedido}, reservamos ${item.quantidade}`]
        : ['×', styles.marcaErro, `${item.produto} · ${item.motivo === 'oferta_encerrada' ? 'a oferta terminou' : 'esgotou'}`]
  return (
    <li className={styles.linhaResultado}>
      <span className={classes(styles.marcaResultado, classe)} aria-hidden="true">
        {marca}
      </span>
      <span className={styles.textoResultado}>{texto}</span>
      <span>{item.status === 'recusada' ? '—' : formatarDinheiro(item.subtotal)}</span>
    </li>
  )
}

/** C5, nada sobrou: 409 tudo_esgotado, sem código. Os itens continuam no carrinho, marcados. */
export function NadaSobrou({ aoVoltar }: { aoVoltar: () => void }) {
  return (
    <div className={styles.resultado}>
      <span className={classes(styles.circuloResultado, styles.circuloErro)} aria-hidden="true">
        ×
      </span>
      <h1 className={styles.tituloLista}>Esgotou tudo agora há pouco</h1>
      <p className={styles.texto}>
        Outras pessoas reservaram as últimas unidades enquanto você montava o pedido. Seus itens continuam no carrinho,
        marcados como esgotados, e voltam a valer se alguma reserva expirar ou for cancelada.
      </p>
      <Botao onClick={aoVoltar}>Voltar ao pedido</Botao>
    </div>
  )
}

/** C5, recusada, vinda da C4 ("Reservar só este agora"): o único item não virou reserva. */
export function ReservaRecusada({ motivo }: { motivo: MotivoRecusaItem }) {
  const navegar = useNavigate()
  const terminou = motivo === 'oferta_encerrada'
  return (
    <div className={styles.resultado}>
      <span className={classes(styles.circuloResultado, styles.circuloErro)} aria-hidden="true">
        ×
      </span>
      <h1 className={styles.tituloLista}>{terminou ? 'Esta oferta já terminou' : 'Esgotou agora há pouco'}</h1>
      {!terminou && (
        <p className={styles.texto}>
          Outra pessoa reservou as últimas unidades. A oferta volta para a vitrine se alguém cancelar ou deixar a reserva
          expirar.
        </p>
      )}
      <Botao onClick={() => navegar('/vitrine')}>Ver outras ofertas</Botao>
    </div>
  )
}
