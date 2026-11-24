import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { Pedido } from '../../api'
import { RECARGA_30S } from '../../app/consultas'
import { useApi } from '../../app/contextos'
import { useAgora } from '../../app/tempo'
import { Abas } from '../../componentes/Abas'
import { idAba, idPainel } from '../../componentes/abasIds'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { EstadoVazio } from '../../componentes/EstadoVazio'
import { IconeReservas } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import { Selo, type VarianteSelo } from '../../componentes/Selo'
import { classes } from '../../util/classes'
import { comEm, formatarDinheiro, formatarHorario, formatarTempoRestante } from '../../util/formatar'
import styles from './Consumidor.module.css'

const URGENTE_MS = 30 * 60_000

type IdAba = 'ativas' | 'historico'

/**
 * C8 · Minhas reservas: um cartão por PEDIDO (loja, código, itens, prazo mais próximo).
 * Abas Ativas (n) e Histórico (?aba=historico, para o voltar funcionar).
 */
export function C8MinhasReservas() {
  const api = useApi()
  const navegar = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const aba: IdAba = parametros.get('aba') === 'historico' ? 'historico' : 'ativas'

  const ativas = useQuery({
    queryKey: ['pedidos', 'ativo'],
    queryFn: () => api.pedidos.listar('ativo'),
    ...RECARGA_30S,
  })
  const historico = useQuery({
    queryKey: ['pedidos', 'encerrado'],
    queryFn: () => api.pedidos.listar('encerrado'),
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
          <ListaPedidos pedidos={consulta.data} />
        )}
      </div>
    </div>
  )
}

function ListaPedidos({ pedidos }: { pedidos: Pedido[] }) {
  const agora = useAgora(10_000)
  return (
    <ul className={styles.lista}>
      {pedidos.map((p) => {
        // Ativo: só os itens ainda reservados. Encerrado: todos (o que foi o pedido).
        const itens = p.estado === 'ativo' ? p.itens.filter((i) => i.estado === 'reservada') : p.itens
        const [rotulo, variante] = seloDo(p)
        return (
          <li key={p.id}>
            <Link to={`/pedidos/${p.id}`} className={styles.cartaoReserva}>
              <span className={styles.linhaTopo}>
                <span className={styles.nomeProduto}>Pedido · {itens.length === 1 ? '1 item' : `${itens.length} itens`}</span>
                <Selo variante={variante}>{rotulo}</Selo>
              </span>
              <span className={styles.texto}>{itens.map((i) => `${i.produto} ×${i.quantidade}`).join(', ')}</span>
              <span className={styles.texto}>{p.loja.nome}</span>
              <span className={styles.separador} aria-hidden="true" />
              {p.estado === 'ativo' ? <RodapeAtivo pedido={p} agora={agora} /> : <RodapeEncerrado pedido={p} rotulo={rotulo} agora={agora} />}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Encerrado: "Expirado" se algum item venceu; senão a pessoa cancelou. */
function seloDo(p: Pedido): [string, VarianteSelo] {
  if (p.estado === 'ativo') return ['Reservado', 'pending']
  if (p.estado === 'retirado') return ['Retirado', 'success']
  return p.itens.some((i) => i.estado === 'expirada') ? ['Expirado', 'neutral'] : ['Cancelado', 'danger']
}

function RodapeAtivo({ pedido: p, agora }: { pedido: Pedido; agora: Date }) {
  const restante = p.expira_em_proximo ? new Date(p.expira_em_proximo).getTime() - agora.getTime() : 0
  return (
    <span className={styles.linhaTopo}>
      <span className={styles.codigoCartao}>
        <span className="so-leitor">Código </span>
        {p.codigo.slice(0, 3)} {p.codigo.slice(3)}
      </span>
      <span className={classes(styles.tempoCartao, restante < URGENTE_MS && styles.urgente)}>
        {restante > 0 ? `faltam ${formatarTempoRestante(restante)}` : 'conferindo…'}
      </span>
    </span>
  )
}

function RodapeEncerrado({ pedido: p, rotulo, agora }: { pedido: Pedido; rotulo: string; agora: Date }) {
  const fim = p.itens
    .map((i) => i.encerrada_em)
    .filter((x): x is string => Boolean(x))
    .sort()
    .at(-1)
  if (!fim) return null
  return (
    <span className={styles.linhaTopo}>
      <span className={styles.texto}>
        {rotulo} {comEm(formatarHorario(fim, agora))}
      </span>
      {p.estado === 'retirado' && <strong>{formatarDinheiro(p.total)}</strong>}
    </span>
  )
}
