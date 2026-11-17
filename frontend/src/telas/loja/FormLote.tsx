import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState, type FormEvent, type ReactNode } from 'react'
import type { Produto, ResultadoLote } from '../../api'
import { useApi } from '../../app/contextos'
import { AmostraFita } from '../../componentes/AmostraFita'
import { Botao } from '../../componentes/Botao'
import { Campo } from '../../componentes/Campo'
import { Contador } from '../../componentes/Contador'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { mascararData, paraDataIso } from '../../util/data-digitada'
import { codigoDoErro, mensagemDeErro } from '../../util/erros'
import { corDaFita, nomeDaCor } from '../../util/fita'
import { formatarData } from '../../util/formatar'
import styles from './Lotes.module.css'

export interface FormLoteProps {
  lojaId: number
  /** Produto já escolhido (volta da L2 com ?produto=id). */
  produtoInicial?: number | null
  /** "+ Novo produto": leva o que já foi digitado na busca. */
  aoNovoProduto: (busca: string) => void
  aoVerLotes: () => void
  cabecalho?: ReactNode
}

const MAXIMO_RESULTADOS = 6

/**
 * L3 · Cadastro do lote (Figura 3). A cor da fita e o agrupamento são calculados SÓ no
 * backend: o card da fita aparece depois de salvar, com o resultado da API (decisão 1a da F8).
 */
export function FormLote({ lojaId, produtoInicial = null, aoNovoProduto, aoVerLotes, cabecalho }: FormLoteProps) {
  const api = useApi()
  const consultas = useQueryClient()
  // null = ainda vale o produto inicial; 'nenhum' = a pessoa clicou em "Trocar".
  const [escolha, setEscolha] = useState<Produto | 'nenhum' | null>(null)
  const [busca, setBusca] = useState('')
  const buscaAdiada = useDeferredValue(busca.trim())
  const [validade, setValidade] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [resultado, setResultado] = useState<ResultadoLote | null>(null)

  const catalogo = useQuery({
    queryKey: ['produtos', lojaId, buscaAdiada],
    queryFn: () => api.lotes.listarProdutos(lojaId, buscaAdiada || undefined),
    placeholderData: keepPreviousData,
  })
  // Para mostrar o nome do produto que veio da L2 (a lista sem busca tem todos).
  const todos = useQuery({
    queryKey: ['produtos', lojaId, ''],
    queryFn: () => api.lotes.listarProdutos(lojaId),
    enabled: escolha === null && produtoInicial !== null,
  })
  const produto =
    escolha === 'nenhum' ? null : (escolha ?? todos.data?.find((p) => p.id === produtoInicial) ?? null)

  const salvar = useMutation({
    mutationFn: (entrada: { produto: number; validade: string; quantidade: number }) => api.lotes.cadastrarLote(lojaId, entrada),
    onSuccess: (r) => {
      void consultas.invalidateQueries({ queryKey: ['grupos', lojaId] })
      void consultas.invalidateQueries({ queryKey: ['avisos', lojaId] })
      void consultas.invalidateQueries({ queryKey: ['resumo', lojaId] })
      setResultado(r)
    },
  })

  if (resultado) {
    return (
      <ResultadoDoLote
        resultado={resultado}
        produto={produto?.nome ?? resultado.grupo.produto.nome}
        cabecalho={cabecalho}
        aoOutroLote={() => {
          setResultado(null)
          setEscolha('nenhum')
          setBusca('')
          setValidade('')
          setQuantidade(1)
          salvar.reset()
        }}
        aoVerLotes={aoVerLotes}
      />
    )
  }

  const iso = paraDataIso(validade)
  const codigo = codigoDoErro(salvar.error)
  const erroValidade = codigo?.startsWith('validade_')
    ? mensagemDeErro(salvar.error)
    : validade.length === 10 && !iso
      ? 'Essa data não existe no calendário.'
      : null
  const podeSalvar = Boolean(produto && iso && quantidade >= 1)

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (produto && iso) salvar.mutate({ produto: produto.id, validade: iso, quantidade })
  }

  return (
    <form className={styles.tela} onSubmit={enviar} noValidate>
      {cabecalho}

      <div className={styles.campo}>
        <span id="rotulo-produto" className={styles.rotulo}>
          Produto
        </span>
        {produto ? (
          <div className={styles.produtoEscolhido} aria-labelledby="rotulo-produto" role="group">
            <strong>{produto.nome}</strong>
            <button type="button" className={styles.link} onClick={() => setEscolha('nenhum')}>
              Trocar
            </button>
          </div>
        ) : (
          <>
            <input
              type="search"
              className={styles.busca}
              aria-label="Buscar produto no catálogo"
              placeholder="Buscar no catálogo da loja"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <ul className={styles.resultados} aria-label="Produtos do catálogo">
              {catalogo.data?.slice(0, MAXIMO_RESULTADOS).map((p) => (
                <li key={p.id}>
                  <button type="button" className={styles.itemBusca} onClick={() => setEscolha(p)}>
                    {p.nome}
                  </button>
                </li>
              ))}
              {catalogo.data?.length === 0 && <li className={styles.ajuda}>Nenhum produto com esse nome.</li>}
              <li>
                <button type="button" className={styles.novoProduto} onClick={() => aoNovoProduto(busca.trim())}>
                  + Novo produto
                </button>
              </li>
            </ul>
          </>
        )}
      </div>

      <Campo
        rotulo="Validade impressa"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        autoComplete="off"
        value={validade}
        erro={erroValidade}
        onChange={(e) => {
          salvar.reset()
          setValidade(mascararData(e.target.value))
        }}
      />

      <div className={styles.campo}>
        <span className={styles.rotulo}>Quantidade recebida</span>
        <Contador valor={quantidade} min={1} max={999} rotulo="Quantidade recebida" tamanho="cadastro" aoMudar={setQuantidade} />
      </div>

      <section className={styles.cartao} aria-labelledby="titulo-fita">
        <h2 id="titulo-fita" className={styles.sobrelinha}>
          Cor da fita
        </h2>
        <p className={styles.ajuda}>
          A cor sai do bimestre da validade. Ela aparece ao salvar, junto com o grupo em que o lote entrou.
        </p>
      </section>

      {salvar.isError && !erroValidade && <MensagemErro erro={salvar.error} />}

      <Botao type="submit" disabled={!podeSalvar} carregando={salvar.isPending} textoCarregando="Salvando…">
        Salvar lote e agendar aviso
      </Botao>
    </form>
  )
}

function ResultadoDoLote(props: {
  resultado: ResultadoLote
  produto: string
  cabecalho?: ReactNode
  aoOutroLote: () => void
  aoVerLotes: () => void
}) {
  const { resultado: r, produto, cabecalho, aoOutroLote, aoVerLotes } = props
  const { fita, referencia } = r.grupo
  const cor = nomeDaCor(fita.cor)
  return (
    <div className={styles.tela}>
      {cabecalho}
      <section className={styles.cartao} aria-labelledby="titulo-resultado-fita">
        <h2 id="titulo-resultado-fita" className={styles.sobrelinha}>
          Cor da fita
        </h2>
        <AmostraFita fita={fita} data={r.lote.validade} tamanho="destaque" />

        {r.resultado === 'agrupado' && (
          <Mensagem tipo="info">
            Agrupado ao grupo {cor} ativo. Data de referência do grupo: {formatarData(referencia)} (a mais próxima).
          </Mensagem>
        )}
        {r.resultado === 'novo' && (
          <Mensagem tipo="info">
            Novo grupo {cor} criado para este produto. Data de referência: {formatarData(referencia)}.
          </Mensagem>
        )}
        {r.resultado === 'colisao' && r.colisao && (
          <div role="alert">
            <Mensagem tipo="atencao" titulo="Atenção:">
              ainda há lote {cor} {r.colisao.validade < r.lote.validade ? 'do ano anterior' : 'de outro ano'} ativo para este
              produto (validade {formatarData(r.colisao.validade)}). Separe as zonas antes de colar a fita.
            </Mensagem>
          </div>
        )}

        <p className={styles.instrucao}>
          Cole a fita {corDaFita(fita.cor)} na caixa e posicione a divisória na zona {cor} da gôndola.
        </p>
        <p className={styles.ajuda}>
          {r.lote.quantidade} un. de {produto} · aviso em {formatarData(r.grupo.aviso_em)}
        </p>
      </section>
      <div className={styles.acoes}>
        <Botao onClick={aoOutroLote}>Cadastrar outro lote</Botao>
        <Botao variante="secundario" onClick={aoVerLotes}>
          Ver lotes e fitas
        </Botao>
      </div>
    </div>
  )
}
