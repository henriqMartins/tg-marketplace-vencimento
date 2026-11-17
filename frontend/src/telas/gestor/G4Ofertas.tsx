import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { OfertaLoja } from '../../api'
import { RECARGA_30S } from '../../app/consultas'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { useAgora } from '../../app/tempo'
import { AmostraFita } from '../../componentes/AmostraFita'
import { Botao } from '../../componentes/Botao'
import { Esqueleto, EsqueletoLista } from '../../componentes/Esqueleto'
import { BarraEstoque, CaixasEstoque, LegendaEstoque } from '../../componentes/Estoque'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { SeloOferta } from '../../componentes/Selo'
import { classes } from '../../util/classes'
import { comEm, formatarDinheiro, formatarHorario } from '../../util/formatar'
import { intervaloDo } from '../../util/periodo'
import { FormAjuste } from '../loja/FormAjuste'
import { ListaReservas } from '../loja/L10Oferta'
import styles from './Gestor.module.css'

const QUARENTA_E_OITO_HORAS = 48 * 3600_000

type Aba = 'ativa' | 'encerrada'

/**
 * G4 · Ofertas (desktop): tabela à esquerda, detalhe da oferta escolhida à direita.
 * Aba e oferta escolhida ficam na URL (?aba=encerradas&oferta=2). Não há "nova oferta":
 * ela nasce da conferência de um aviso, no celular.
 */
export function G4Ofertas() {
  const api = useApi()
  const { lojaId } = useLojaAtual()
  const agora = useAgora(60_000)
  const [parametros, setParametros] = useSearchParams()
  const aba: Aba = parametros.get('aba') === 'encerradas' ? 'encerrada' : 'ativa'

  // Mesmas chaves da L9: as duas listas carregam já, porque o controle mostra os dois totais.
  const ativas = useQuery({
    queryKey: ['loja-ofertas', lojaId, 'ativa'],
    queryFn: () => api.operacao.listarOfertas(lojaId, 'ativa'),
    ...RECARGA_30S,
  })
  const encerradas = useQuery({
    queryKey: ['loja-ofertas', lojaId, 'encerrada'],
    queryFn: () => api.operacao.listarOfertas(lojaId, 'encerrada'),
  })
  const lista = aba === 'ativa' ? ativas : encerradas

  const idNaUrl = Number(parametros.get('oferta'))
  const selecionada = lista.data?.find((o) => o.id === idNaUrl) ?? lista.data?.[0] ?? null

  function trocarAba(nova: Aba) {
    // A oferta escolhida pertence a uma aba só: trocar de aba volta para a primeira da lista.
    setParametros(nova === 'encerrada' ? { aba: 'encerradas' } : {}, { replace: true })
  }

  function escolher(id: number) {
    setParametros(
      (atual) => {
        const proximos = new URLSearchParams(atual)
        proximos.set('oferta', String(id))
        return proximos
      },
      { replace: true },
    )
  }

  return (
    <div className={styles.tela}>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Ofertas</h1>
          <p className={styles.subtitulo}>Ofertas nascem da conferência de um aviso, no celular. Aqui você acompanha e ajusta.</p>
        </div>
        <div role="group" aria-label="Estado das ofertas" className={styles.segmentado}>
          {(
            [
              ['ativa', 'Ativas', ativas.data],
              ['encerrada', 'Encerradas', encerradas.data],
            ] as const
          ).map(([id, rotulo, dados]) => (
            <button
              key={id}
              type="button"
              aria-pressed={aba === id}
              className={classes(styles.segmento, aba === id && styles.segmentoAtivo)}
              onClick={() => trocarAba(id)}
            >
              {dados ? `${rotulo} (${dados.length})` : rotulo}
            </button>
          ))}
        </div>
      </header>

      <CartoesOfertas lojaId={lojaId} ativas={ativas.data} agora={agora} />

      <div className={styles.mestreDetalhe}>
        <section className={classes(styles.cartaoSecao, styles.mestre)} aria-label="Lista de ofertas">
          {lista.isError ? (
            <MensagemErro erro={lista.error} />
          ) : lista.isPending ? (
            <Esqueleto altura={240} />
          ) : lista.data.length === 0 ? (
            <p className={styles.vazio}>
              {aba === 'ativa'
                ? 'Nenhuma oferta ativa. Elas nascem dos avisos de validade, depois da conferência no celular.'
                : 'Nenhuma oferta encerrada.'}
            </p>
          ) : (
            <>
              <TabelaOfertas ofertas={lista.data} selecionada={selecionada?.id} aoEscolher={escolher} agora={agora} />
              <LegendaEstoque />
            </>
          )}
        </section>

        {selecionada && <PainelOferta key={selecionada.id} lojaId={lojaId} ofertaId={selecionada.id} />}
      </div>
    </div>
  )
}

// ---------- Cartões ----------

/**
 * Os 3 primeiros somam a lista de ofertas ativas que a API devolveu (decisão 2a: não há
 * endpoint de resumo de ofertas). "Perda no mês" vem pronta dos indicadores (grupo F).
 */
function CartoesOfertas({ lojaId, ativas, agora }: { lojaId: number; ativas: OfertaLoja[] | undefined; agora: Date }) {
  const api = useApi()
  const { de, ate } = intervaloDo('mes', agora)
  // Mesma chave do G1 no "mês atual": quem passou pelo painel já tem o número.
  const indicadores = useQuery({
    queryKey: ['indicadores', lojaId, de, ate],
    queryFn: () => api.gestor.indicadores(lojaId, de, ate),
    ...RECARGA_30S,
  })

  const soma = (f: (o: OfertaLoja) => number) => ativas?.reduce((total, o) => total + f(o), 0)
  const encerram = ativas?.filter((o) => new Date(o.fim).getTime() - agora.getTime() <= QUARENTA_E_OITO_HORAS).length

  return (
    <dl className={styles.cartoes}>
      <Cartao rotulo="Livres agora" valor={soma((o) => o.estoque.livre)} unidade />
      <Cartao rotulo="Reservadas aguardando" valor={soma((o) => o.estoque.reservado)} unidade />
      <Cartao rotulo="Encerram em 48 h" valor={encerram} urgente />
      <Cartao rotulo="Perda no mês" valor={indicadores.isError ? '—' : indicadores.data?.perda_unidades} unidade />
    </dl>
  )
}

function Cartao(props: { rotulo: string; valor: ReactNode | undefined; unidade?: boolean; urgente?: boolean }) {
  const { rotulo, valor, unidade, urgente } = props
  return (
    <div className={styles.cartao}>
      <dt className={styles.rotuloCartao}>{rotulo}</dt>
      <dd className={classes(styles.valorCartao, urgente && styles.tomUrgente)}>
        {valor === undefined ? (
          <Esqueleto largura={72} altura={34} />
        ) : (
          <>
            {valor}
            {unidade && valor !== '—' && <span className={styles.unidade}> un.</span>}
          </>
        )}
      </dd>
    </div>
  )
}

// ---------- Tabela (mestre) ----------

function TabelaOfertas(props: { ofertas: OfertaLoja[]; selecionada: number | undefined; aoEscolher: (id: number) => void; agora: Date }) {
  const { ofertas, selecionada, aoEscolher, agora } = props
  return (
    <div className={styles.rolagem}>
      <table className={classes(styles.tabela, styles.tabelaOfertas)}>
        <thead>
          <tr>
            <th scope="col">Produto</th>
            <th scope="col">Preço</th>
            <th scope="col">Estoque</th>
            <th scope="col" className={styles.numero}>
              Livre
            </th>
            <th scope="col" className={styles.numero}>
              Reservado
            </th>
            <th scope="col" className={styles.numero}>
              Perda / ajuste
            </th>
            <th scope="col">Fim</th>
          </tr>
        </thead>
        <tbody>
          {ofertas.map((o) => {
            const escolhida = o.id === selecionada
            const fim = formatarHorario(o.fim, agora)
            const fimProximo = o.estado === 'ativa' && (fim.startsWith('hoje') || fim.startsWith('amanhã'))
            return (
              <tr key={o.id} className={classes(escolhida && styles.linhaEscolhida)}>
                <td>
                  {/* O botão é o alvo da linha: teclado e leitor de tela sabem qual está aberta. */}
                  <button type="button" className={styles.botaoLinha} aria-pressed={escolhida} onClick={() => aoEscolher(o.id)}>
                    {o.produto.nome}
                  </button>
                  <AmostraFita fita={o.fita} data={o.validade} tamanho="compacta" />
                </td>
                <td>
                  <span className={styles.precoOferta}>{formatarDinheiro(o.preco)}</span>
                  <s className={styles.precoOriginal}>
                    <span className="so-leitor">de </span>
                    {formatarDinheiro(o.preco_original)}
                  </s>
                </td>
                <td>
                  <div className={styles.colunaEstoque}>
                    <BarraEstoque estoque={o.estoque} />
                    <span className={styles.notaCartao}>{o.estoque.separado} un.</span>
                  </div>
                </td>
                <td className={styles.numero}>{o.estoque.livre}</td>
                <td className={styles.numero}>{o.estoque.reservado}</td>
                {/* Mesma soma da barra ("Perda / ajuste"), só para exibir. */}
                <td className={styles.numero}>{o.estoque.perda + o.estoque.ajustado}</td>
                {/* Só o dia ("amanhã", "18/11"): o horário completo está no painel. */}
                <td className={classes(styles.data, fimProximo && styles.urgente)}>{fim.split(',')[0]}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------- Painel (detalhe) ----------

function PainelOferta({ lojaId, ofertaId }: { lojaId: number; ofertaId: number }) {
  const api = useApi()
  const [ajustando, setAjustando] = useState(false)
  // Mesma chave da L10 e do modal: o ajuste invalida e o painel se atualiza sozinho.
  const consulta = useQuery({
    queryKey: ['loja-oferta', lojaId, ofertaId],
    queryFn: () => api.operacao.obterOferta(lojaId, ofertaId),
    ...RECARGA_30S,
  })

  if (consulta.isPending) {
    return (
      <section className={classes(styles.cartaoSecao, styles.detalhe)} aria-label="Detalhe da oferta">
        <EsqueletoLista quantidade={2} rotulo="Carregando oferta…" />
      </section>
    )
  }
  if (consulta.isError) {
    return (
      <section className={classes(styles.cartaoSecao, styles.detalhe)} aria-label="Detalhe da oferta">
        <MensagemErro erro={consulta.error} />
      </section>
    )
  }

  const o = consulta.data
  const ativa = o.estado === 'ativa'
  return (
    <section className={classes(styles.cartaoSecao, styles.detalhe)} aria-label="Detalhe da oferta">
      <div className={styles.cabecalhoSecao}>
        <div>
          <h2 className={styles.tituloSecao}>{o.produto.nome}</h2>
          <p className={styles.subtitulo}>
            {formatarDinheiro(o.preco)} · janela {o.janela_horas} h
          </p>
        </div>
        <SeloOferta estado={o.estado} />
      </div>
      <AmostraFita fita={o.fita} data={o.validade} tamanho="linha" />

      <CaixasEstoque estoque={o.estoque} />

      {ativa ? (
        <p className={styles.cartaoFim}>
          Sai da vitrine <strong>{comEm(formatarHorario(o.fim))}</strong> (validade − 1 dia). Nenhuma reserva passa desse
          horário.
        </p>
      ) : (
        <Mensagem tipo="erro">
          Encerrada {comEm(formatarHorario(o.fim))}.{' '}
          {o.estoque.perda === 1 ? '1 unidade registrada' : `${o.estoque.perda} unidades registradas`} como perda.
        </Mensagem>
      )}

      <ListaReservas oferta={o} />

      <div className={styles.acoesPainel}>
        <Botao disabled={!ativa || o.estoque.livre === 0} onClick={() => setAjustando(true)}>
          Ajustar estoque
        </Botao>
        <Link
          to={`/loja/${lojaId}/reservas?q=${encodeURIComponent(o.produto.nome)}`}
          className={styles.botaoSecundarioLink}
        >
          Ver reservas
        </Link>
      </div>

      {/* Mesmo formulário da L11, agora num modal; o 409 é tratado lá dentro. */}
      <FolhaInferior forma="modal" aberta={ajustando} titulo="Ajustar estoque" aoFechar={() => setAjustando(false)}>
        <p className={styles.subtitulo}>{o.produto.nome}</p>
        <FormAjuste lojaId={lojaId} ofertaId={o.id} aoConcluir={() => setAjustando(false)} />
      </FolhaInferior>
    </section>
  )
}
