import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import type { OfertaLojaDetalhe, ReservaLoja } from '../../api'
import { RECARGA_30S } from '../../app/consultas'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { useAgora } from '../../app/tempo'
import { AmostraFita } from '../../componentes/AmostraFita'
import { BotaoIcone } from '../../componentes/Botao'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { CaixasEstoque } from '../../componentes/Estoque'
import { IconeVoltar } from '../../componentes/icones'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { SeloOferta, SeloReserva } from '../../componentes/Selo'
import { comEm, formatarDinheiro, formatarHorario } from '../../util/formatar'
import styles from './Loja.module.css'

/** L10 · Detalhe da oferta (ativa ou encerrada). Recarrega a cada 30 s. */
export function L10Oferta() {
  const api = useApi()
  const navegar = useNavigate()
  const { lojaId } = useLojaAtual()
  const id = Number(useParams().ofertaId)
  const consulta = useQuery({
    queryKey: ['loja-oferta', lojaId, id],
    queryFn: () => api.operacao.obterOferta(lojaId, id),
    ...RECARGA_30S,
  })
  const base = `/loja/${lojaId}`

  const voltar = (
    <BotaoIcone rotulo="Voltar para as ofertas" onClick={() => navegar(`${base}/ofertas`)}>
      <IconeVoltar />
    </BotaoIcone>
  )

  if (consulta.isPending) return <EsqueletoLista quantidade={2} rotulo="Carregando oferta…" />
  if (consulta.isError) {
    return (
      <div className={styles.tela}>
        {voltar}
        <MensagemErro erro={consulta.error} />
      </div>
    )
  }

  const o = consulta.data
  const ativa = o.estado === 'ativa'

  return (
    <div className={styles.tela}>
      <header className={styles.cabecalhoDetalhe}>
        {voltar}
        <div className={styles.textosCabecalho}>
          <h1 className={styles.tituloTela}>{o.produto.nome}</h1>
          <span className={styles.texto}>
            {formatarDinheiro(o.preco)} · janela {o.janela_horas} h
          </span>
        </div>
        <SeloOferta estado={o.estado} />
      </header>
      <AmostraFita fita={o.fita} data={o.validade} />

      {ativa ? (
        <div className={styles.cartaoInfo}>
          Sai da vitrine <strong>{comEm(formatarHorario(o.fim))}</strong>. O que sobrar livre vira perda.
        </div>
      ) : (
        <Mensagem tipo="erro">
          Encerrada {comEm(formatarHorario(o.fim))}.{' '}
          {o.estoque.perda > 0
            ? `${o.estoque.perda} ${o.estoque.perda === 1 ? 'unidade livre foi registrada' : 'unidades livres foram registradas'} como perda. Tire-as da área de reservas e dê o destino.`
            : 'Nenhuma unidade sobrou livre.'}
        </Mensagem>
      )}

      <section className={styles.cartao} aria-labelledby="titulo-estoque">
        <h2 id="titulo-estoque" className={styles.sobrelinha}>
          Estoque
        </h2>
        <CaixasEstoque estoque={o.estoque} />
      </section>

      <ListaReservas oferta={o} />

      {ativa && (
        <div className={styles.rodapeAcoes}>
          <Link to={`${base}/ofertas/${o.id}/ajuste`} className={styles.botaoSecundarioLink}>
            Ajustar estoque
          </Link>
          <Link to={`${base}/retirada`} className={styles.botaoPrimarioLink}>
            Validar retirada
          </Link>
        </div>
      )}
    </div>
  )
}

function ListaReservas({ oferta: o }: { oferta: OfertaLojaDetalhe }) {
  const agora = useAgora(30_000)
  const ativa = o.estado === 'ativa'
  return (
    <section className={styles.tela} aria-labelledby="titulo-reservas">
      <h2 id="titulo-reservas" className={styles.sobrelinha}>
        {ativa ? 'Reservas aguardando retirada' : 'Reservas'}
      </h2>
      {o.reservas.length === 0 ? (
        <p className={styles.texto}>{ativa ? 'Nenhuma reserva aguardando.' : 'Esta oferta não teve reservas.'}</p>
      ) : (
        <ul className={styles.lista}>
          {o.reservas.map((r) => (
            <li key={r.id} className={styles.linhaReserva}>
              <LinhaReserva reserva={r} ativa={ativa} agora={agora} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function LinhaReserva({ reserva: r, ativa, agora }: { reserva: ReservaLoja; ativa: boolean; agora: Date }) {
  return (
    <>
      <span className={styles.codigoMascarado}>
        <span aria-hidden="true">•••</span>
        <span className="so-leitor">Código terminado em</span> {r.codigo_final}
      </span>
      <span className={styles.textosCabecalho}>
        <span>
          {r.quantidade} un. · {r.cliente}
        </span>
        {ativa ? (
          <span className={styles.texto}>expira {formatarHorario(r.expira_em, agora)}</span>
        ) : (
          <SeloReserva estado={r.estado} />
        )}
      </span>
    </>
  )
}
