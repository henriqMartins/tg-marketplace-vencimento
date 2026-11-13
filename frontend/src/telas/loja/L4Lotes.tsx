import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { Grupo } from '../../api'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { AmostraFita, BolinhaFita } from '../../componentes/AmostraFita'
import { Chip } from '../../componentes/Chip'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { EstadoVazio } from '../../componentes/EstadoVazio'
import { IconeLotes, IconeMais } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import { Selo, SeloGrupo } from '../../componentes/Selo'
import { CORES, nomeDaCor } from '../../util/fita'
import { formatarData, formatarDataCurta } from '../../util/formatar'
import styles from './Lotes.module.css'

const lerCor = (texto: string | null) => CORES.find((c) => c === texto) ?? null

/** L4 · Lotes e fitas (celular): grupos por produto e cor; o filtro de cor fica na URL (?cor=). */
export function L4Lotes() {
  const api = useApi()
  const navegar = useNavigate()
  const { lojaId } = useLojaAtual()
  const [parametros, setParametros] = useSearchParams()
  const cor = lerCor(parametros.get('cor'))
  const grupos = useQuery({
    queryKey: ['grupos', lojaId, cor],
    queryFn: () => api.lotes.listarGrupos(lojaId, cor ? { cor } : {}),
  })
  // Grupo encerrado (virou oferta que acabou, ou "não vai para oferta") já saiu da gôndola.
  const ativos = grupos.data?.filter((g) => g.situacao !== 'encerrado')

  return (
    <div className={styles.tela}>
      <header>
        <h1 className={styles.titulo}>Lotes e fitas</h1>
        <p className={styles.ajuda}>Grupos por produto e cor · referência = data mais próxima</p>
      </header>
      <div role="group" aria-label="Filtrar por cor da fita" className={styles.chips}>
        <Chip ativo={cor === null} onClick={() => setParametros({}, { replace: true })}>
          Todas
        </Chip>
        {CORES.map((c) => (
          <Chip key={c} ativo={cor === c} onClick={() => setParametros({ cor: c }, { replace: true })}>
            <BolinhaFita cor={c} /> {nomeDaCor(c)}
          </Chip>
        ))}
      </div>

      {grupos.isPending ? (
        <EsqueletoLista quantidade={3} rotulo="Carregando grupos…" />
      ) : grupos.isError ? (
        <MensagemErro erro={grupos.error} />
      ) : ativos!.length === 0 ? (
        <EstadoVazio
          icone={<IconeLotes tamanho={40} />}
          frase={cor ? `Nenhum grupo ${nomeDaCor(cor)}` : 'Nenhum lote cadastrado'}
          detalhe="Cadastre o lote quando a mercadoria chegar: a fita e o aviso saem da validade."
          acao={{ rotulo: 'Cadastrar lote', aoClicar: () => navegar(`/loja/${lojaId}/lotes/novo`) }}
        />
      ) : (
        <ul className={styles.lista}>
          {ativos!.map((g) => (
            <li key={g.id}>
              <CartaoGrupo grupo={g} lojaId={lojaId} />
            </li>
          ))}
        </ul>
      )}

      <Link to={`/loja/${lojaId}/lotes/novo`} className={styles.botaoFlutuante}>
        <IconeMais tamanho={20} />
        Cadastrar lote
      </Link>
    </div>
  )
}

/** Linha de situação: o que acontece com o grupo agora, com as datas da API. */
function situacaoEmTexto(g: Grupo): string {
  switch (g.situacao) {
    case 'conferir':
      return `Aviso disparado ${formatarDataCurta(g.adiado_ate ?? g.aviso_em)} · conferir na gôndola`
    case 'adiado':
      return `Aviso adiado para ${formatarDataCurta(g.adiado_ate!)}`
    case 'em_oferta':
      return 'Na vitrine · ver a oferta'
    case 'aguardando':
      return `Aviso em ${formatarData(g.aviso_em)}`
    default:
      return 'Encerrado'
  }
}

function CartaoGrupo({ grupo: g, lojaId }: { grupo: Grupo; lojaId: number }) {
  const lotes = g.qtd_lotes ?? g.lotes?.length ?? 0
  const conteudo = (
    <>
      <span className={styles.linhaTopo}>
        <span className={styles.nomeProduto}>{g.produto.nome}</span>
        <SeloGrupo situacao={g.situacao} />
      </span>
      <AmostraFita fita={g.fita} data={g.referencia} rotuloData="ref." />
      <span className={styles.ajuda}>
        {lotes} {lotes === 1 ? 'lote' : 'lotes'}
        {g.recebido !== undefined && ` · ${g.recebido} un. recebidas`}
      </span>
      <span className={styles.situacao}>{situacaoEmTexto(g)}</span>
      {g.colisao && (
        <span>
          <Selo variante="warn">Colisão de ciclo</Selo>{' '}
          <span className={styles.ajuda}>
            ainda há lote {nomeDaCor(g.fita.cor)} com validade {formatarData(g.colisao.validade)}
          </span>
        </span>
      )}
    </>
  )
  // Aviso leva à conferência (L6); oferta, ao detalhe (L10). Os outros só informam.
  const destino =
    g.situacao === 'conferir' || g.situacao === 'adiado'
      ? `/loja/${lojaId}/avisos/${g.id}`
      : g.situacao === 'em_oferta' && g.oferta_id
        ? `/loja/${lojaId}/ofertas/${g.oferta_id}`
        : null
  return destino ? (
    <Link to={destino} className={styles.cartaoGrupo}>
      {conteudo}
    </Link>
  ) : (
    <div className={styles.cartaoGrupo}>{conteudo}</div>
  )
}
