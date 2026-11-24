import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { ItemPedido, Pedido } from '../../api'
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
import { FolhaCancelarPedido, type AlvoCancelar } from './FolhaCancelarPedido'
import styles from './Consumidor.module.css'

const URGENTE_MS = 30 * 60_000 // especificação, C8: menos de 30 min em `urgent`
const contarItens = (n: number) => (n === 1 ? '1 item' : `${n} itens`)
const hora = (iso: string) => formatarHorario(iso).split(', ')[1]

/**
 * C6 (código do pedido) e C7 (desfechos), na rota /pedidos/:id. O QUE MOSTRAR sai do `estado`
 * do pedido que a API devolve (calculado pelos itens), revalidado a cada 30 s.
 */
export function C6Pedido() {
  const id = Number(useParams().id)
  const api = useApi()
  const consulta = useQuery({ queryKey: ['pedido', id], queryFn: () => api.pedidos.obter(id), ...RECARGA_30S })

  if (consulta.isPending) return <EsqueletoLista quantidade={1} rotulo="Carregando pedido…" />
  if (consulta.isError) return <MensagemErro erro={consulta.error} />

  const p = consulta.data
  return (
    <div className={styles.reserva}>
      <h1 className={styles.tituloTela}>Seu pedido</h1>
      {p.estado === 'ativo' && <Codigo pedido={p} conferirAgora={consulta.refetch} />}
      {p.estado === 'retirado' && <Retirado pedido={p} />}
      {p.estado === 'encerrado' && <Encerrado pedido={p} />}
    </div>
  )
}

function Codigo({ pedido: p, conferirAgora }: { pedido: Pedido; conferirAgora: () => unknown }) {
  const agora = useAgora(1000)
  const mostrarToast = useToast()
  const [cancelar, setCancelar] = useState<AlvoCancelar | null>(null)
  const ativos = p.itens.filter((i) => i.estado === 'reservada')
  const sairam = p.itens.filter((i) => i.estado === 'expirada' || i.estado === 'cancelada')
  const prazo = p.expira_em_proximo!

  // A contagem é LOCAL e só para exibir. Chegou a zero: pergunta à API (o item vencido sai da lista).
  const restanteMs = new Date(prazo).getTime() - agora.getTime()
  const acabou = restanteMs <= 0
  useEffect(() => {
    if (acabou) void conferirAgora()
  }, [acabou, conferirAgora])

  return (
    <>
      <section className={styles.cartaoCodigo} aria-labelledby="titulo-codigo">
        <Selo variante="success">✓ Pedido confirmado · {contarItens(ativos.length)}</Selo>
        <h2 id="titulo-codigo" className={styles.sobrelinha}>
          Código de retirada
        </h2>
        <CodigoRetirada codigo={p.codigo} />
        <p role="timer" className={classes(styles.contagemRegressiva, restanteMs < URGENTE_MS && styles.urgente)}>
          {acabou ? 'Conferindo com a loja…' : formatarTempoRestante(restanteMs)}
        </p>
        <p className={styles.texto}>
          para retirar · até {formatarHorario(prazo, agora)}
          {ativos.length > 1 && (
            <>
              <br />
              (o primeiro item vence às {hora(prazo)})
            </>
          )}
        </p>
        <p className={styles.instrucao}>
          Informe este código no balcão. O lojista digita o código e você paga na retirada.
        </p>
      </section>

      <section className={styles.cartaoDetalhe} aria-label="Itens do pedido">
        <ul className={styles.listaItens}>
          {ativos.map((i) => (
            <li key={i.reserva_id} className={styles.linhaResultado}>
              <span className={styles.textoResultado}>
                {i.produto} · <strong>{i.quantidade} un.</strong>
                {i.quantidade < i.pedido && <span className={styles.texto}> (pediu {i.pedido})</span>}
                {i.expira_em && i.expira_em !== prazo && <span className={styles.texto}> · até {formatarHorario(i.expira_em, agora)}</span>}
              </span>
              <span>{formatarDinheiro(i.subtotal)}</span>
            </li>
          ))}
        </ul>
        {sairam.map((i) => (
          <p key={i.reserva_id} className={styles.texto}>
            {i.produto} {i.estado === 'expirada' ? 'expirou e voltou para a vitrine' : 'foi cancelado'}.
          </p>
        ))}
        <p className={styles.totalLoja}>
          <span>A pagar na loja</span>
          <strong>{formatarDinheiro(p.total)}</strong>
        </p>
        <p className={styles.texto}>
          {p.loja.nome}
          <br />
          {p.loja.endereco}
        </p>
      </section>

      {ativos.length > 1 && (
        <Botao variante="secundario" onClick={() => setCancelar('item')}>
          Cancelar um item
        </Botao>
      )}
      <Botao variante="perigo" onClick={() => setCancelar('pedido')}>
        Cancelar o pedido
      </Botao>
      <FolhaCancelarPedido
        pedido={p}
        alvo={cancelar}
        aoFechar={() => setCancelar(null)}
        aoCancelar={(_, alvo) => {
          setCancelar(null)
          mostrarToast(
            alvo === 'item'
              ? 'Item cancelado. Ele voltou para a vitrine; o código continua valendo.'
              : 'Pedido cancelado. Os itens voltaram para a vitrine.',
          )
        }}
      />
    </>
  )
}

/** C7 · Retirado: a loja confirmou a retirada (dos itens que ainda estavam ativos). */
function Retirado({ pedido: p }: { pedido: Pedido }) {
  const navegar = useNavigate()
  const retirados = p.itens.filter((i) => i.estado === 'retirada')
  const quando = retirados.map((i) => i.encerrada_em).find(Boolean)
  return (
    <section className={styles.cartaoCodigo}>
      <span className={classes(styles.circuloResultado, styles.circuloSucesso)} aria-hidden="true">
        ✓
      </span>
      <SeloReserva estado="retirada" />
      <p>Retirada {quando ? formatarHorario(quando) : ''} · Obrigado por evitar desperdício!</p>
      <ListaSimples itens={retirados} />
      <p>
        Você pagou <strong>{formatarDinheiro(p.total)}</strong>
      </p>
      <Botao onClick={() => navegar('/vitrine')}>Voltar para a vitrine</Botao>
    </section>
  )
}

/** C7 · Expirado (todos os itens venceram) ou Cancelado (a pessoa cancelou). */
function Encerrado({ pedido: p }: { pedido: Pedido }) {
  const navegar = useNavigate()
  const expirou = p.itens.some((i) => i.estado === 'expirada')
  const fim = p.itens
    .map((i) => i.encerrada_em)
    .filter((x): x is string => Boolean(x))
    .sort()
    .at(-1)
  return (
    <section className={styles.cartaoCodigo}>
      <SeloReserva estado={expirou ? 'expirada' : 'cancelada'} />
      <CodigoRetirada codigo={p.codigo} invalido />
      <p className={styles.texto}>
        {expirou
          ? `O prazo terminou ${fim ? formatarHorario(fim) : ''} sem retirada. Os itens voltaram para a vitrine e este código não vale mais.`
          : `Você cancelou este pedido ${fim ? formatarHorario(fim) : ''}. Os itens voltaram para a vitrine.`}
      </p>
      <ListaSimples itens={p.itens} />
      <p className={styles.texto}>{p.loja.nome}</p>
      <Botao onClick={() => navegar('/vitrine')}>{expirou ? 'Ver se ainda tem na vitrine' : 'Voltar para a vitrine'}</Botao>
    </section>
  )
}

function ListaSimples({ itens }: { itens: ItemPedido[] }) {
  return (
    <ul className={styles.listaItens}>
      {itens.map((i) => (
        <li key={i.reserva_id ?? i.oferta_id}>
          {i.quantidade} × {i.produto}
        </li>
      ))}
    </ul>
  )
}
