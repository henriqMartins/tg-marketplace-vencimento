import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { Chegada, FaixaLote, FaixaProcura, Projecao } from '../../api'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { Botao } from '../../componentes/Botao'
import { Esqueleto } from '../../componentes/Esqueleto'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { classes } from '../../util/classes'
import { formatarJanela, formatarPercentual } from '../../util/formatar'
import styles from './Gestor.module.css'

/** Paradas dos controles deslizantes: posição 0 = sem filtro (todas as rodadas). */
const LOTES: (FaixaLote | null)[] = [null, '5-14', '15-24', '25-34', '35-44', '45-60']
const PROCURAS: (FaixaProcura | null)[] = [null, '0.3-0.8', '0.8-1.3', '1.3-1.8', '1.8-2.3', '2.3-3.0']
const CHEGADAS: Chegada[] = [1, 2, 4]

/** Sem a configuração da loja, começa pela de 4 h. Nenhuma das duas é recomendação. */
const JANELA_INICIAL = 4

/** Sempre uma casa ("13,0"), para os números se alinharem no gráfico e na tabela. */
const umaCasa = (n: number | null) => n === null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const textoLote = (f: FaixaLote | null) => (f ? `${f.replace('-', '–')} un.` : 'Todos')
const textoProcura = (f: FaixaProcura | null) =>
  f ? `${f.replace('-', '–').replaceAll('.', ',')} × o lote` : 'Todas'

interface Cenario {
  lote: FaixaLote | null
  procura: FaixaProcura | null
  chegada: Chegada
}

function lerCenario(p: URLSearchParams): Cenario {
  const chegada = Number(p.get('chegada'))
  return {
    lote: LOTES.find((f) => f && f === p.get('lote')) ?? null,
    procura: PROCURAS.find((f) => f && f === p.get('procura')) ?? null,
    chegada: CHEGADAS.includes(chegada as Chegada) ? (chegada as Chegada) : 2,
  }
}

/**
 * G2 · Projeção da janela de reserva. Os controles FILTRAM rodadas já simuladas (nada é
 * simulado na hora): a API devolve as médias e quantas rodadas entraram na conta.
 * O cenário aplicado fica na URL; o que está nos controles só vale ao clicar "Atualizar".
 * A tela compara janelas — nenhum texto recomenda uma.
 */
export function G2Projecao() {
  const api = useApi()
  const { lojaId } = useLojaAtual()
  const [parametros, setParametros] = useSearchParams()
  const aplicado = lerCenario(parametros)
  const [rascunho, setRascunho] = useState<Cenario>(aplicado)
  // Começa pela janela que a loja usa hoje (grupo E), para comparar com as outras.
  const loja = useQuery({ queryKey: ['loja-config', lojaId], queryFn: () => api.configuracao.obterLoja(lojaId) })
  const [escolhida, setJanela] = useState<number | null>(null)
  const janela = escolhida ?? loja.data?.janela_padrao_horas ?? JANELA_INICIAL

  const projecao = useQuery({
    queryKey: ['projecao', lojaId, aplicado.lote, aplicado.procura, aplicado.chegada],
    queryFn: () =>
      api.projecao.projecao(lojaId, {
        lote: aplicado.lote ?? undefined,
        procura: aplicado.procura ?? undefined,
        chegada: aplicado.chegada,
      }),
    placeholderData: keepPreviousData,
    staleTime: Infinity, // resumo pré-calculado: não muda enquanto a tela está aberta
  })

  const mudou =
    rascunho.lote !== aplicado.lote || rascunho.procura !== aplicado.procura || rascunho.chegada !== aplicado.chegada

  function atualizar() {
    const p = new URLSearchParams()
    if (rascunho.lote) p.set('lote', rascunho.lote)
    if (rascunho.procura) p.set('procura', rascunho.procura)
    if (rascunho.chegada !== 2) p.set('chegada', String(rascunho.chegada))
    setParametros(p, { replace: true })
  }

  return (
    <div className={styles.tela}>
      <header>
        <h1 className={styles.titulo}>Projeção da janela de reserva</h1>
        <p className={styles.subtitulo}>Compare perda e compradores bloqueados para cada janela</p>
      </header>

      <p role="note" className={styles.faixaAviso}>
        <strong>Cenário projetado, não previsão.</strong> Os números vêm de milhares de ofertas simuladas pelo mesmo motor
        de regras do sistema, com as faixas do estudo. Servem para comparar janelas, não para prometer resultado.
      </p>

      <div className={styles.mestreDetalhe}>
        <section className={classes(styles.cartaoSecao, styles.parametros)} aria-labelledby="titulo-parametros">
          <h2 id="titulo-parametros" className={styles.tituloSecao}>
            Parâmetros do cenário
          </h2>
          <Deslizante
            rotulo="Tamanho do lote"
            paradas={LOTES}
            valor={rascunho.lote}
            texto={textoLote}
            pontas={['Todos', '45–60']}
            aoMudar={(lote) => setRascunho({ ...rascunho, lote })}
          />
          <Deslizante
            rotulo="Procura esperada"
            paradas={PROCURAS}
            valor={rascunho.procura}
            texto={textoProcura}
            pontas={['Todas', '3,0 × o lote']}
            aoMudar={(procura) => setRascunho({ ...rascunho, procura })}
          />
          <div className={styles.campoParametro}>
            <span id="rotulo-chegada" className={styles.rotuloCartao}>
              Tempo típico até o cliente chegar
            </span>
            <div role="group" aria-labelledby="rotulo-chegada" className={styles.segmentado}>
              {CHEGADAS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={rascunho.chegada === c}
                  className={classes(styles.segmento, rascunho.chegada === c && styles.segmentoAtivo)}
                  onClick={() => setRascunho({ ...rascunho, chegada: c })}
                >
                  {c} h
                </button>
              ))}
            </div>
          </div>
          <Botao onClick={atualizar} disabled={!mudou}>
            Atualizar projeção
          </Botao>
          <p className={styles.nota}>
            {projecao.data && (
              <strong className={styles.rodadas}>
                Baseado em {projecao.data.rodadas.toLocaleString('pt-BR')} rodadas simuladas.{' '}
              </strong>
            )}
            Os demais valores (janela da loja, margem, horários de chegada) seguem as faixas do estudo.
          </p>
        </section>

        <section className={classes(styles.cartaoSecao, styles.resultado)} aria-labelledby="titulo-resultado">
          <h2 id="titulo-resultado" className={styles.tituloSecao}>
            Resultado
          </h2>
          {projecao.isError ? (
            <MensagemErro erro={projecao.error} />
          ) : !projecao.data ? (
            <Esqueleto altura={320} />
          ) : (
            <Resultado projecao={projecao.data} janela={janela} aoEscolher={setJanela} atualizando={projecao.isPlaceholderData} />
          )}
        </section>
      </div>
    </div>
  )
}

// ---------- Controle deslizante com paradas ----------

function Deslizante<T>(props: {
  rotulo: string
  paradas: T[]
  valor: T
  texto: (v: T) => string
  pontas: [string, string]
  aoMudar: (v: T) => void
}) {
  const { rotulo, paradas, valor, texto, pontas, aoMudar } = props
  const id = useId()
  const indice = paradas.indexOf(valor)
  return (
    <div className={styles.campoParametro}>
      <div className={styles.linhaParametro}>
        <label htmlFor={id} className={styles.rotuloCartao}>
          {rotulo}
        </label>
        <span className={styles.valorParametro}>{texto(valor)}</span>
      </div>
      {/* As posições são as faixas do contrato; o leitor de tela ouve a faixa, não o índice. */}
      <input
        id={id}
        type="range"
        min={0}
        max={paradas.length - 1}
        step={1}
        value={indice}
        aria-valuetext={texto(valor)}
        className={styles.deslizante}
        onChange={(e) => aoMudar(paradas[Number(e.target.value)])}
      />
      <div className={styles.pontas} aria-hidden="true">
        <span>{pontas[0]}</span>
        <span>{pontas[1]}</span>
      </div>
    </div>
  )
}

// ---------- Resultado ----------

type LinhaJanela = Projecao['janelas'][number]

const descrever = (j: LinhaJanela) =>
  `Janela ${formatarJanela(j.janela_horas)}: perda ${formatarPercentual(j.perda_pct)}, bloqueados ${formatarPercentual(j.bloqueados_pct)}`

function Resultado(props: { projecao: Projecao; janela: number; aoEscolher: (j: number) => void; atualizando: boolean }) {
  const { projecao, janela, aoEscolher, atualizando } = props
  const escolhida = projecao.janelas.find((j) => j.janela_horas === janela) ?? projecao.janelas[0]

  // Combinação de faixas sem nenhuma rodada simulada: a API devolve rodadas 0 e números null.
  if (projecao.rodadas === 0) {
    return (
      <Mensagem tipo="info">
        Nenhuma rodada simulada com essa combinação de lote e procura. Escolha outra faixa para comparar as janelas.
      </Mensagem>
    )
  }

  return (
    <div className={classes(styles.tela, atualizando && styles.atualizando)}>
      <div role="group" aria-label="Janela de reserva" className={classes(styles.segmentado, styles.seletorJanela)}>
        {projecao.janelas.map((j) => (
          <button
            key={j.janela_horas}
            type="button"
            aria-pressed={j === escolhida}
            className={classes(styles.segmento, j === escolhida && styles.segmentoAtivo)}
            onClick={() => aoEscolher(j.janela_horas)}
          >
            {formatarJanela(j.janela_horas)}
          </button>
        ))}
      </div>

      <dl className={styles.cartoes}>
        <div className={classes(styles.cartao, styles.cartaoPerda)}>
          <dt className={styles.rotuloCartao}>Perda projetada</dt>
          <dd className={styles.valorCartao}>{formatarPercentual(escolhida.perda_pct)}</dd>
          <dd className={styles.notaCartao}>do lote separado</dd>
        </div>
        <div className={classes(styles.cartao, styles.cartaoBloqueio)}>
          <dt className={styles.rotuloCartao}>Compradores bloqueados</dt>
          <dd className={styles.valorCartao}>{formatarPercentual(escolhida.bloqueados_pct)}</dd>
          <dd className={styles.notaCartao}>dos compradores não levaram tudo o que pediram</dd>
        </div>
        <div className={classes(styles.cartao, styles.cartaoNeutro)}>
          <dt className={styles.rotuloCartao}>Taxa de retirada</dt>
          <dd className={styles.valorCartao}>{formatarPercentual(escolhida.retirada_pct)}</dd>
          <dd className={styles.notaCartao}>das reservas</dd>
        </div>
      </dl>

      <GraficoJanelas janelas={projecao.janelas} escolhida={escolhida} aoEscolher={aoEscolher} />

      <p className={styles.comoLer}>
        <strong>Como ler:</strong> janela curta demais: o cliente não chega a tempo e a reserva expira, então a perda
        sobe. Janela longa: unidades ficam presas em reservas que não vão ser retiradas, e quem chega depois encontra o
        estoque livre zerado.
      </p>
    </div>
  )
}

/**
 * Barras agrupadas por janela (perda e bloqueados, escala 0–100%), sem biblioteca.
 * Verde e laranja ficam perto demais para quem não distingue vermelho (protanopia):
 * a barra de bloqueados tem textura, os valores ficam escritos e há a tabela.
 */
function GraficoJanelas(props: { janelas: LinhaJanela[]; escolhida: LinhaJanela; aoEscolher: (j: number) => void }) {
  const { janelas, escolhida, aoEscolher } = props
  return (
    <figure className={styles.figuraJanelas}>
      <ul className={styles.legenda} aria-label="Legenda">
        <li>
          <span className={classes(styles.amostra, styles.seriePerda)} aria-hidden="true" />
          Perda (%)
        </li>
        <li>
          <span className={classes(styles.amostra, styles.serieBloqueados)} aria-hidden="true" />
          Compradores bloqueados (%)
        </li>
      </ul>
      <div className={styles.areaJanelas}>
        {janelas.map((j) => (
          <button
            key={j.janela_horas}
            type="button"
            aria-pressed={j === escolhida}
            aria-label={descrever(j)}
            className={classes(styles.grupoJanela, j !== escolhida && styles.grupoApagado)}
            onClick={() => aoEscolher(j.janela_horas)}
          >
            <span className={styles.pares} aria-hidden="true">
              {(
                [
                  [j.perda_pct, styles.seriePerda],
                  [j.bloqueados_pct, styles.serieBloqueados],
                ] as const
              ).map(([valor, classe], k) => (
                <span key={k} className={styles.colunaBarra}>
                  <span className={styles.valorBarra}>{umaCasa(valor)}</span>
                  {valor !== null && (
                    <span className={classes(styles.barra, classe)} style={{ height: `${Math.max(1, valor) * 1.8}px` }} />
                  )}
                </span>
              ))}
            </span>
            <span className={styles.rotuloJanela} aria-hidden="true">
              {formatarJanela(j.janela_horas)}
            </span>
          </button>
        ))}
      </div>
      <details className={styles.verTabela}>
        <summary>Ver como tabela</summary>
        <table className={styles.tabela}>
          <caption className="so-leitor">Projeção por janela de reserva</caption>
          <thead>
            <tr>
              <th scope="col">Janela</th>
              <th scope="col" className={styles.numero}>
                Perda (% do lote)
              </th>
              <th scope="col" className={styles.numero}>
                Bloqueados (% dos compradores)
              </th>
              <th scope="col" className={styles.numero}>
                Retirada (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {janelas.map((j) => (
              <tr key={j.janela_horas}>
                <th scope="row">{formatarJanela(j.janela_horas)}</th>
                <td className={styles.numero}>{umaCasa(j.perda_pct)}</td>
                <td className={styles.numero}>{umaCasa(j.bloqueados_pct)}</td>
                <td className={styles.numero}>{umaCasa(j.retirada_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
