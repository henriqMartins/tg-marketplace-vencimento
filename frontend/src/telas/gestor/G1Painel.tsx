import { useQueries, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Indicadores, OfertaLoja } from '../../api'
import { RECARGA_30S } from '../../app/consultas'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { useAgora } from '../../app/tempo'
import { AmostraFita } from '../../componentes/AmostraFita'
import { Esqueleto } from '../../componentes/Esqueleto'
import { MensagemErro } from '../../componentes/Mensagem'
import { classes } from '../../util/classes'
import { formatarData, formatarTaxa, formatarTempoRestante } from '../../util/formatar'
import { ControlePeriodo } from './ControlePeriodo'
import { GraficoSemanas } from './GraficoSemanas'
import { usePeriodoDaUrl } from './periodo'
import styles from './Gestor.module.css'

const UMA_HORA = 3600_000
const MEIA_HORA = 30 * 60_000

/**
 * G1 · Painel de acompanhamento (Figura 6). Os indicadores vêm PRONTOS da API
 * (GET …/indicadores): a tela não refaz nenhuma conta, só formata.
 * As tabelas usam o grupo C, como o contrato indica.
 */
export function G1Painel() {
  const api = useApi()
  const { lojaId } = useLojaAtual()
  const { periodo, de, ate, trocar } = usePeriodoDaUrl()
  const indicadores = useQuery({
    queryKey: ['indicadores', lojaId, de, ate],
    queryFn: () => api.gestor.indicadores(lojaId, de, ate),
    ...RECARGA_30S,
  })
  const i = indicadores.data

  return (
    <div className={styles.tela}>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Painel de acompanhamento</h1>
          <p className={styles.subtitulo}>
            Indicadores lidos do banco · {formatarData(i?.de ?? de)} a {formatarData(i?.ate ?? ate)}
          </p>
        </div>
        <ControlePeriodo periodo={periodo} aoTrocar={trocar} />
      </header>

      {indicadores.isError ? <MensagemErro erro={indicadores.error} /> : <Cartoes indicadores={i} />}
      {i && <GraficoSemanas semanas={i.semanas} />}

      <div className={styles.duasColunas}>
        <OfertasAtivas lojaId={lojaId} />
      </div>
    </div>
  )
}

// ---------- Cartões ----------

function Cartoes({ indicadores: i }: { indicadores: Indicadores | undefined }) {
  return (
    <dl className={styles.cartoes}>
      <Cartao rotulo="Reservas criadas" valor={i?.reservas_criadas} nota={i && `${i.encerradas.total} encerradas no período`} />
      <Cartao
        rotulo="Taxa de retirada"
        valor={i && formatarTaxa(i.taxa_retirada)}
        tom="primario"
        nota={i && `das reservas encerradas · ${i.encerradas.retiradas} de ${i.encerradas.total}`}
      />
      <Cartao
        rotulo="Taxa de expiração"
        valor={i && formatarTaxa(i.taxa_expiracao)}
        tom="alerta"
        nota={i && `das reservas encerradas · ${i.encerradas.expiradas} de ${i.encerradas.total}`}
      />
      <Cartao
        rotulo="Compradores bloqueados"
        valor={i?.bloqueados.total}
        nota={
          i && (
            <>
              {i.bloqueados.recusas} sem nada · {i.bloqueados.parciais} levaram menos do que pediram
            </>
          )
        }
      />
      <Cartao
        rotulo="Perda no encerramento"
        valor={i && `${i.perda_unidades} un.`}
        nota={i && 'sobra livre ao fim das ofertas'}
      />
    </dl>
  )
}

function Cartao(props: { rotulo: string; valor: ReactNode | undefined; nota: ReactNode | undefined; tom?: 'primario' | 'alerta' }) {
  const { rotulo, valor, nota, tom } = props
  return (
    <div className={styles.cartao}>
      <dt className={styles.rotuloCartao}>{rotulo}</dt>
      <dd className={classes(styles.valorCartao, tom === 'primario' && styles.tomPrimario, tom === 'alerta' && styles.tomAlerta)}>
        {valor === undefined ? <Esqueleto largura={72} altura={34} /> : valor}
      </dd>
      <dd className={styles.notaCartao}>{nota ?? <Esqueleto largura="80%" />}</dd>
    </div>
  )
}

// ---------- Tabelas (grupo C) ----------

function OfertasAtivas({ lojaId }: { lojaId: number }) {
  const api = useApi()
  const agora = useAgora(30_000)
  // Mesmas chaves da L9 e da L10: o que uma tela busca, a outra aproveita.
  const ofertas = useQuery({
    queryKey: ['loja-ofertas', lojaId, 'ativa'],
    queryFn: () => api.operacao.listarOfertas(lojaId, 'ativa'),
    ...RECARGA_30S,
  })
  // "Reservas em andamento" precisa do expira_em: uma leitura por oferta ativa.
  const detalhes = useQueries({
    queries: (ofertas.data ?? []).map((o) => ({
      queryKey: ['loja-oferta', lojaId, o.id],
      queryFn: () => api.operacao.obterOferta(lojaId, o.id),
      ...RECARGA_30S,
    })),
  })

  const reservas = detalhes
    .flatMap((d) => (d.data ? d.data.reservas.filter((r) => r.estado === 'reservada').map((r) => ({ ...r, produto: d.data.produto.nome })) : []))
    .sort((a, b) => a.expira_em.localeCompare(b.expira_em))
  const carregandoReservas = ofertas.isPending || detalhes.some((d) => d.isPending)

  return (
    <>
      <section className={classes(styles.cartaoSecao, styles.colunaLarga)} aria-labelledby="titulo-ofertas-ativas">
        <h2 id="titulo-ofertas-ativas" className={styles.tituloSecao}>
          Ofertas ativas
        </h2>
        {ofertas.isError ? (
          <MensagemErro erro={ofertas.error} />
        ) : ofertas.isPending ? (
          <Esqueleto altura={120} />
        ) : ofertas.data.length === 0 ? (
          <p className={styles.vazio}>Nenhuma oferta ativa agora.</p>
        ) : (
          <TabelaOfertas ofertas={ofertas.data} lojaId={lojaId} />
        )}
      </section>

      <section className={classes(styles.cartaoSecao, styles.colunaEstreita)} aria-labelledby="titulo-em-andamento">
        <h2 id="titulo-em-andamento" className={styles.tituloSecao}>
          Reservas em andamento
        </h2>
        {carregandoReservas ? (
          <Esqueleto altura={120} />
        ) : reservas.length === 0 ? (
          <p className={styles.vazio}>Nenhuma reserva aguardando retirada.</p>
        ) : (
          <div className={styles.rolagem}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Produto</th>
                  <th scope="col" className={styles.numero}>
                    Qtd
                  </th>
                  <th scope="col" className={styles.numero}>
                    Expira em
                  </th>
                </tr>
              </thead>
              <tbody>
                {reservas.map((r) => {
                  const restante = new Date(r.expira_em).getTime() - agora.getTime()
                  return (
                    <tr key={r.id}>
                      <td className={styles.codigo}>••• {r.codigo_final}</td>
                      <td>{r.produto}</td>
                      <td className={styles.numero}>{r.quantidade}</td>
                      <td
                        className={classes(
                          styles.numero,
                          restante < MEIA_HORA ? styles.urgente : restante < UMA_HORA ? styles.alerta : undefined,
                        )}
                      >
                        {restante > 0 ? formatarTempoRestante(restante) : 'expirando'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function TabelaOfertas({ ofertas, lojaId }: { ofertas: OfertaLoja[]; lojaId: number }) {
  return (
    <div className={styles.rolagem}>
      <table className={styles.tabela}>
        <thead>
          <tr>
            <th scope="col">Produto</th>
            <th scope="col">Fita</th>
            <th scope="col" className={styles.numero}>
              Livre
            </th>
            <th scope="col" className={styles.numero}>
              Reservado
            </th>
            <th scope="col" className={styles.numero}>
              Retirado
            </th>
            <th scope="col">Fim da oferta</th>
          </tr>
        </thead>
        <tbody>
          {ofertas.map((o) => (
            <tr key={o.id}>
              <td>
                {/* No computador a oferta abre no painel da G4. */}
                <Link to={`/loja/${lojaId}/ofertas?oferta=${o.id}`} className={styles.link}>
                  {o.produto.nome}
                </Link>
              </td>
              <td>
                <AmostraFita fita={o.fita} data={o.validade} tamanho="linha" />
              </td>
              <td className={styles.numero}>{o.estoque.livre}</td>
              <td className={styles.numero}>{o.estoque.reservado}</td>
              <td className={styles.numero}>{o.estoque.retirado}</td>
              <td>{formatarData(o.fim)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
