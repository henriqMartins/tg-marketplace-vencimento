import { useQuery } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { Grupo, SituacaoGrupo } from '../../api'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { useAgora } from '../../app/tempo'
import { BolinhaFita } from '../../componentes/AmostraFita'
import { Botao } from '../../componentes/Botao'
import { Chip } from '../../componentes/Chip'
import { Esqueleto } from '../../componentes/Esqueleto'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { IconeMais } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import { Selo, SeloGrupo } from '../../componentes/Selo'
import { classes } from '../../util/classes'
import { BIMESTRES, bimestreDoMes, CORES, nomeDaCor } from '../../util/fita'
import { formatarData, formatarDataCurta } from '../../util/formatar'
import { hojeEmBrasilia } from '../../util/periodo'
import { FormLote } from '../loja/FormLote'
import { FormProduto } from '../loja/FormProduto'
import styles from './Gestor.module.css'

const FILTROS: { situacao: SituacaoGrupo | null; rotulo: string }[] = [
  { situacao: null, rotulo: 'Todos' },
  { situacao: 'conferir', rotulo: 'Conferir' },
  { situacao: 'adiado', rotulo: 'Adiado' },
  { situacao: 'em_oferta', rotulo: 'Em oferta' },
  { situacao: 'aguardando', rotulo: 'Aguardando aviso' },
]
const lerSituacao = (t: string | null) => FILTROS.find((f) => f.situacao === t)?.situacao ?? null

/** Grupo encerrado já saiu da gôndola: não aparece na lista nem conta no calendário (como na L4). */
const ativos = (gs: Grupo[] | undefined) => gs?.filter((g) => g.situacao !== 'encerrado')

/**
 * G5 · Lotes e fitas (computador): calendário de fitas, chips de situação e a tabela de grupos
 * que expande os lotes. "+ Cadastrar lote" abre a L3 num modal (o mesmo formulário do celular).
 */
export function G5Lotes() {
  const api = useApi()
  const { lojaId } = useLojaAtual()
  const [parametros, setParametros] = useSearchParams()
  const situacao = lerSituacao(parametros.get('situacao'))
  const [cadastrando, setCadastrando] = useState(false)

  // Todos os grupos (mesma chave da L4 sem filtro): o calendário conta os ativos por cor.
  const todos = useQuery({ queryKey: ['grupos', lojaId, null], queryFn: () => api.lotes.listarGrupos(lojaId) })
  const lista = useQuery({
    queryKey: ['grupos', lojaId, 'com-lotes', situacao],
    queryFn: () => api.lotes.listarGrupos(lojaId, { com_lotes: true, ...(situacao ? { situacao } : {}) }),
  })

  return (
    <div className={styles.tela}>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Lotes e fitas</h1>
          <p className={styles.subtitulo}>Grupos por produto e cor. A referência do grupo é a validade mais próxima.</p>
        </div>
        <Botao larguraTotal={false} onClick={() => setCadastrando(true)}>
          <IconeMais tamanho={18} /> Cadastrar lote
        </Botao>
      </header>

      <CalendarioFitas grupos={ativos(todos.data)} />

      <div role="group" aria-label="Filtrar por situação" className={styles.chips}>
        {FILTROS.map((f) => (
          <Chip
            key={f.rotulo}
            ativo={f.situacao === situacao}
            onClick={() => setParametros(f.situacao ? { situacao: f.situacao } : {}, { replace: true })}
          >
            {f.rotulo}
          </Chip>
        ))}
      </div>

      <section className={styles.cartaoSecao} aria-label="Grupos de lotes">
        {lista.isError ? (
          <MensagemErro erro={lista.error} />
        ) : lista.isPending ? (
          <Esqueleto altura={240} />
        ) : ativos(lista.data)!.length === 0 ? (
          <p className={styles.vazio}>Nenhum grupo nessa situação.</p>
        ) : (
          <TabelaGrupos grupos={ativos(lista.data)!} lojaId={lojaId} />
        )}
        <p className={styles.nota}>Todos os lotes de um grupo têm a mesma cor, ou seja, validade no mesmo bimestre.</p>
      </section>

      <ModalCadastro aberto={cadastrando} lojaId={lojaId} aoFechar={() => setCadastrando(false)} />
    </div>
  )
}

// ---------- Calendário de fitas ----------

function CalendarioFitas({ grupos }: { grupos: Grupo[] | undefined }) {
  const atual = bimestreDoMes(hojeEmBrasilia(useAgora(60_000)))
  return (
    <section aria-labelledby="titulo-calendario" className={styles.calendario}>
      <h2 id="titulo-calendario" className={styles.sobrelinha}>
        Calendário de fitas
      </h2>
      <ol className={styles.bimestres}>
        {CORES.map((cor, i) => {
          const n = grupos?.filter((g) => g.fita.cor === cor).length
          return (
            <li
              key={cor}
              className={classes(styles.bimestre, i === atual && styles.bimestreAtual)}
              aria-current={i === atual ? 'date' : undefined}
            >
              <span className={styles.amostraBimestre}>
                <BolinhaFita cor={cor} />
              </span>
              <strong>{nomeDaCor(cor)}</strong>
              <span className={styles.notaCartao}>
                {BIMESTRES[i]}
                {i === atual && ' · bimestre atual'}
              </span>
              <span className={styles.notaCartao}>
                {n === undefined ? '…' : `${n} ${n === 1 ? 'grupo ativo' : 'grupos ativos'}`}
              </span>
            </li>
          )
        })}
      </ol>
      <p className={styles.nota}>A cor depende da data de validade, não do tempo que falta.</p>
    </section>
  )
}

// ---------- Tabela de grupos ----------

function textoAviso(g: Grupo): string {
  switch (g.situacao) {
    case 'conferir':
      return `disparado ${formatarDataCurta(g.adiado_ate ?? g.aviso_em)}`
    case 'adiado':
      return `adiado para ${formatarDataCurta(g.adiado_ate!)}`
    case 'em_oferta':
      return 'virou oferta'
    default:
      return `em ${formatarDataCurta(g.aviso_em)}`
  }
}

function TabelaGrupos({ grupos, lojaId }: { grupos: Grupo[]; lojaId: number }) {
  const [abertos, setAbertos] = useState<ReadonlySet<number>>(new Set())
  const alternar = (id: number) =>
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })

  return (
    <div className={styles.rolagem}>
      <table className={styles.tabela}>
        <thead>
          <tr>
            <th scope="col">Produto</th>
            <th scope="col">Fita</th>
            <th scope="col">Referência</th>
            <th scope="col" className={styles.numero}>
              Lotes
            </th>
            <th scope="col" className={styles.numero}>
              Recebido
            </th>
            <th scope="col">Aviso</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => {
            const aberto = abertos.has(g.id)
            const idLotes = `lotes-grupo-${g.id}`
            return (
              <Fragment key={g.id}>
                <tr className={classes(aberto && styles.linhaEscolhida)}>
                  <td>
                    {/* O nome é o botão de expandir: o teclado e o leitor sabem se está aberto. */}
                    <button
                      type="button"
                      className={styles.botaoLinha}
                      aria-expanded={aberto}
                      aria-controls={aberto ? idLotes : undefined}
                      onClick={() => alternar(g.id)}
                    >
                      <span aria-hidden="true">{aberto ? '▾' : '▸'}</span> {g.produto.nome}
                    </button>
                  </td>
                  <td>
                    <span className={styles.fitaLinha}>
                      <BolinhaFita cor={g.fita.cor} /> {nomeDaCor(g.fita.cor)}
                    </span>
                  </td>
                  <td className={styles.data}>{formatarData(g.referencia)}</td>
                  <td className={styles.numero}>{g.qtd_lotes}</td>
                  <td className={styles.numero}>{g.recebido} un.</td>
                  <td>
                    {g.situacao === 'em_oferta' && g.oferta_id ? (
                      <Link to={`/loja/${lojaId}/ofertas?oferta=${g.oferta_id}`} className={styles.link}>
                        {textoAviso(g)}
                      </Link>
                    ) : (
                      textoAviso(g)
                    )}
                  </td>
                  <td>
                    <span className={styles.selos}>
                      <SeloGrupo situacao={g.situacao} />
                      {g.colisao && <Selo variante="warn">Colisão de ciclo</Selo>}
                    </span>
                  </td>
                </tr>
                {aberto && (
                  <tr id={idLotes} className={styles.linhaLotes}>
                    <td colSpan={7}>
                      <ul className={styles.lotes}>
                        {g.lotes?.map((l) => (
                          <li key={l.id}>
                            <BolinhaFita cor={g.fita.cor} /> Recebido em {formatarDataCurta(l.recebido_em)} · Validade{' '}
                            {formatarData(l.validade)} · {l.quantidade} un.
                          </li>
                        ))}
                      </ul>
                      {g.colisao && (
                        <p role="alert" className={styles.alertaColisao}>
                          Ainda há um lote {nomeDaCor(g.fita.cor)} do ciclo anterior (validade {formatarData(g.colisao.validade)}).
                          Separe as zonas na gôndola antes de colar a fita.
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------- L3 (e L2) no modal ----------

function ModalCadastro({ aberto, lojaId, aoFechar }: { aberto: boolean; lojaId: number; aoFechar: () => void }) {
  // "lote" = L3; { busca } = L2 aberta a partir da busca; voltar da L2 traz o produto criado.
  const [passo, setPasso] = useState<{ tela: 'lote'; produto: number | null } | { tela: 'produto'; busca: string }>({
    tela: 'lote',
    produto: null,
  })
  const fechar = () => {
    setPasso({ tela: 'lote', produto: null })
    aoFechar()
  }
  return (
    <FolhaInferior forma="modal" aberta={aberto} titulo={passo.tela === 'lote' ? 'Cadastrar lote' : 'Novo produto'} aoFechar={fechar}>
      {passo.tela === 'lote' ? (
        <FormLote
          key={passo.produto ?? 'sem-produto'}
          lojaId={lojaId}
          produtoInicial={passo.produto}
          aoNovoProduto={(busca) => setPasso({ tela: 'produto', busca })}
          aoVerLotes={fechar}
        />
      ) : (
        <FormProduto lojaId={lojaId} nomeInicial={passo.busca} aoSalvar={(p) => setPasso({ tela: 'lote', produto: p.id })} />
      )}
    </FolhaInferior>
  )
}
