import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { Reserva } from '../../api'
import { RECARGA_30S } from '../../app/consultas'
import { useApi } from '../../app/contextos'
import { useAgora } from '../../app/tempo'
import { Abas } from '../../componentes/Abas'
import { idAba, idPainel } from '../../componentes/abasIds'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { EstadoVazio } from '../../componentes/EstadoVazio'
import { IconeReservas } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import { SeloReserva } from '../../componentes/Selo'
import { classes } from '../../util/classes'
import { comEm, formatarHorario, formatarTempoRestante } from '../../util/formatar'
import styles from './Consumidor.module.css'

const URGENTE_MS = 30 * 60_000

type IdAba = 'ativas' | 'historico'

/** C8 · Minhas reservas: abas Ativas (n) e Histórico (?aba=historico, para o voltar funcionar). */
export function C8MinhasReservas() {
  const api = useApi()
  const navegar = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const aba: IdAba = parametros.get('aba') === 'historico' ? 'historico' : 'ativas'

  const ativas = useQuery({
    queryKey: ['minhas-reservas', 'ativa'],
    queryFn: () => api.consumidor.minhasReservas('ativa'),
    ...RECARGA_30S,
  })
  const historico = useQuery({
    queryKey: ['minhas-reservas', 'encerrada'],
    queryFn: () => api.consumidor.minhasReservas('encerrada'),
    enabled: aba === 'historico',
  })

  const consulta = aba === 'ativas' ? ativas : historico
  const qtdAtivas = ativas.data?.length

  return (
    <div className={styles.reserva}>
      <h1 className={styles.tituloLista}>Minhas reservas</h1>
      <Abas
        prefixo="reservas"
        rotulo="Minhas reservas"
        ativa={aba}
        aoTrocar={(id) => setParametros(id === 'historico' ? { aba: 'historico' } : {}, { replace: true })}
        abas={[
          { id: 'ativas', rotulo: qtdAtivas === undefined ? 'Ativas' : `Ativas (${qtdAtivas})` },
          { id: 'historico', rotulo: 'Histórico' },
        ]}
      />
      <div role="tabpanel" id={idPainel('reservas', aba)} aria-labelledby={idAba('reservas', aba)}>
        {consulta.isPending ? (
          <EsqueletoLista quantidade={2} rotulo="Carregando reservas…" />
        ) : consulta.isError ? (
          <MensagemErro erro={consulta.error} />
        ) : consulta.data.length === 0 ? (
          <EstadoVazio
            icone={<IconeReservas tamanho={40} />}
            frase={aba === 'ativas' ? 'Nenhuma reserva ativa' : 'Nada no histórico ainda'}
            detalhe={aba === 'ativas' ? 'Quando você reservar, o código de retirada aparece aqui.' : undefined}
            acao={{ rotulo: 'Ver ofertas', aoClicar: () => navegar('/vitrine') }}
          />
        ) : (
          <ListaReservas reservas={consulta.data} />
        )}
      </div>
    </div>
  )
}

function ListaReservas({ reservas }: { reservas: Reserva[] }) {
  const agora = useAgora(10_000)
  return (
    <ul className={styles.lista}>
      {reservas.map((r) => (
        <li key={r.id}>
          <Link to={`/reservas/${r.id}`} className={styles.cartaoReserva}>
            <span className={styles.linhaTopo}>
              <span className={styles.nomeProduto}>{r.oferta.produto.nome}</span>
              <SeloReserva estado={r.estado} />
            </span>
            <span className={styles.texto}>
              {r.quantidade} {r.quantidade === 1 ? 'unidade' : 'unidades'} · {r.oferta.loja.nome}
            </span>
            <span className={styles.separador} aria-hidden="true" />
            {r.estado === 'reservada' ? <RodapeAtiva reserva={r} agora={agora} /> : <RodapeEncerrada reserva={r} agora={agora} />}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function RodapeAtiva({ reserva: r, agora }: { reserva: Reserva; agora: Date }) {
  const restante = new Date(r.expira_em).getTime() - agora.getTime()
  return (
    <span className={styles.linhaTopo}>
      <span className={styles.codigoCartao}>
        <span className="so-leitor">Código </span>
        {r.codigo.slice(0, 3)} {r.codigo.slice(3)}
      </span>
      <span className={classes(styles.tempoCartao, restante < URGENTE_MS && styles.urgente)}>
        {restante > 0 ? `faltam ${formatarTempoRestante(restante)}` : 'conferindo…'}
      </span>
    </span>
  )
}

const VERBO = { retirada: 'Retirada', expirada: 'Expirou', cancelada: 'Cancelada' } as const

function RodapeEncerrada({ reserva: r, agora }: { reserva: Reserva; agora: Date }) {
  if (r.estado === 'reservada' || !r.encerrada_em) return null
  return (
    <span className={styles.texto}>
      {VERBO[r.estado]} {comEm(formatarHorario(r.encerrada_em, agora))}
    </span>
  )
}
