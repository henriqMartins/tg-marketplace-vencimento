import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { OfertaLoja } from '../../api'
import { RECARGA_30S } from '../../app/consultas'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { useAgora } from '../../app/tempo'
import { Abas } from '../../componentes/Abas'
import { idAba, idPainel } from '../../componentes/abasIds'
import { AmostraFita } from '../../componentes/AmostraFita'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { BarraEstoque, LegendaEstoque } from '../../componentes/Estoque'
import { EstadoVazio } from '../../componentes/EstadoVazio'
import { IconeEtiqueta } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import { classes } from '../../util/classes'
import { resumoEstoque } from '../../util/estoque'
import { comEm, formatarDinheiro, formatarHorario } from '../../util/formatar'
import styles from './Loja.module.css'

/** L9 · Ofertas da loja: abas Ativas (n) e Encerradas (?aba=encerradas). */
export function L9Ofertas() {
  const api = useApi()
  const navegar = useNavigate()
  const { lojaId } = useLojaAtual()
  const [parametros, setParametros] = useSearchParams()
  const aba = parametros.get('aba') === 'encerradas' ? 'encerradas' : 'ativas'

  const ativas = useQuery({
    queryKey: ['loja-ofertas', lojaId, 'ativa'],
    queryFn: () => api.operacao.listarOfertas(lojaId, 'ativa'),
    ...RECARGA_30S,
  })
  const encerradas = useQuery({
    queryKey: ['loja-ofertas', lojaId, 'encerrada'],
    queryFn: () => api.operacao.listarOfertas(lojaId, 'encerrada'),
    enabled: aba === 'encerradas',
  })
  const consulta = aba === 'ativas' ? ativas : encerradas

  return (
    <div className={styles.tela}>
      <h1 className={styles.tituloLista}>Ofertas</h1>
      <Abas
        prefixo="ofertas"
        rotulo="Ofertas da loja"
        ativa={aba}
        aoTrocar={(id) => setParametros(id === 'encerradas' ? { aba: 'encerradas' } : {}, { replace: true })}
        abas={[
          { id: 'ativas', rotulo: ativas.data ? `Ativas (${ativas.data.length})` : 'Ativas' },
          { id: 'encerradas', rotulo: 'Encerradas' },
        ]}
      />
      <div role="tabpanel" id={idPainel('ofertas', aba)} aria-labelledby={idAba('ofertas', aba)} className={styles.tela}>
        {consulta.isPending ? (
          <EsqueletoLista quantidade={3} rotulo="Carregando ofertas…" />
        ) : consulta.isError ? (
          <MensagemErro erro={consulta.error} />
        ) : consulta.data.length === 0 ? (
          <EstadoVazio
            icone={<IconeEtiqueta tamanho={40} />}
            frase={aba === 'ativas' ? 'Nenhuma oferta ativa' : 'Nenhuma oferta encerrada'}
            detalhe={aba === 'ativas' ? 'As ofertas nascem dos avisos de validade, depois da conferência.' : undefined}
            acao={{ rotulo: 'Ver avisos de validade', aoClicar: () => navegar(`/loja/${lojaId}/avisos`) }}
          />
        ) : (
          <>
            <ul className={styles.lista}>
              {consulta.data.map((o) => (
                <li key={o.id}>
                  <CartaoOfertaLoja oferta={o} lojaId={lojaId} />
                </li>
              ))}
            </ul>
            <LegendaEstoque />
          </>
        )}
      </div>
    </div>
  )
}

function CartaoOfertaLoja({ oferta: o, lojaId }: { oferta: OfertaLoja; lojaId: number }) {
  const agora = useAgora(60_000)
  const fim = formatarHorario(o.fim, agora)
  const fimProximo = o.estado === 'ativa' && (fim.startsWith('hoje') || fim.startsWith('amanhã'))
  return (
    <Link to={`/loja/${lojaId}/ofertas/${o.id}`} className={styles.cartao}>
      <span className={styles.linhaTopo}>
        <span className={styles.nomeProduto}>{o.produto.nome}</span>
        <span className={styles.preco}>{formatarDinheiro(o.preco)}</span>
      </span>
      <AmostraFita fita={o.fita} data={o.validade} tamanho="linha" />
      <BarraEstoque estoque={o.estoque} />
      <span className={styles.linhaTopo}>
        <span className={styles.texto}>{resumoEstoque(o.estoque)}</span>
        <span className={classes(styles.fim, fimProximo && styles.urgente)}>
          {o.estado === 'ativa' ? `até ${fim}` : `encerrada ${comEm(fim)}`}
        </span>
      </span>
    </Link>
  )
}
