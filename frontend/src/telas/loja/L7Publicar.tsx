import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import type { AvisoDetalhe, OfertaLoja } from '../../api'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { AmostraFita } from '../../componentes/AmostraFita'
import { Botao, BotaoIcone } from '../../componentes/Botao'
import { CaixaSelecao } from '../../componentes/CaixaSelecao'
import { Campo } from '../../componentes/Campo'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { IconeVoltar } from '../../componentes/icones'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { classes } from '../../util/classes'
import { lerPrecoDigitado, previaDesconto } from '../../util/dinheiro'
import { codigoDoErro } from '../../util/erros'
import { comEm, formatarDinheiro, formatarHorario } from '../../util/formatar'
import { chaveAviso, invalidarAvisos } from './avisos'
import styles from './Lotes.module.css'

const DESCONTOS = [20, 30, 40, 50] as const
const JANELAS = [1, 2, 4, 8, 12, 24] as const

/** "6.99" → "6,99" para o campo. */
const paraCampo = (valor: string | null) => (valor ? valor.replace('.', ',') : '')

/**
 * L7 · Revisar e publicar oferta. A quantidade vem da contagem da L6 (?separado=N).
 * O backend calcula o preço, o fim e grava; a tela mostra só uma prévia do preço.
 */
export function L7Publicar() {
  const api = useApi()
  const navegar = useNavigate()
  const { lojaId } = useLojaAtual()
  const avisoId = Number(useParams().avisoId)
  const separado = Number(useSearchParams()[0].get('separado'))
  const aviso = useQuery({ queryKey: chaveAviso(lojaId, avisoId), queryFn: () => api.lotes.obterAviso(lojaId, avisoId) })
  const [publicada, setPublicada] = useState<OfertaLoja | null>(null)
  const voltarL6 = `/loja/${lojaId}/avisos/${avisoId}`

  // Sem contagem (link direto, recarga sem ?separado) não há o que publicar: volta para contar.
  if (!Number.isInteger(separado) || separado < 1) return <Navigate to={voltarL6} replace />
  if (publicada) return <OfertaPublicada oferta={publicada} lojaId={lojaId} />

  const cabecalho = (
    <header className={styles.cabecalho}>
      <BotaoIcone rotulo="Voltar para a conferência" onClick={() => navegar(voltarL6)}>
        <IconeVoltar />
      </BotaoIcone>
      <h1 className={styles.tituloTela}>Revisar e publicar</h1>
    </header>
  )

  if (aviso.isPending) return <EsqueletoLista quantidade={2} rotulo="Carregando aviso…" />
  if (aviso.isError) {
    return (
      <div className={styles.tela}>
        {cabecalho}
        <MensagemErro erro={aviso.error} />
      </div>
    )
  }
  return (
    // key: se o aviso mudar (outra contagem), o formulário recomeça com os valores da API.
    <FormPublicar key={`${avisoId}-${separado}`} aviso={aviso.data} separado={separado} cabecalho={cabecalho} aoPublicar={setPublicada} />
  )
}

function FormPublicar(props: {
  aviso: AvisoDetalhe
  separado: number
  cabecalho: ReactNode
  aoPublicar: (o: OfertaLoja) => void
}) {
  const { aviso, separado, cabecalho, aoPublicar } = props
  const api = useApi()
  const consultas = useQueryClient()
  const { lojaId } = useLojaAtual()
  // Preço normal pré-preenchido com o da última oferta do produto (preco_sugerido); vazio na primeira.
  const [precoTexto, setPrecoTexto] = useState(paraCampo(aviso.preco_sugerido))
  const [desconto, setDesconto] = useState<number>(30)
  const [janela, setJanela] = useState(aviso.janela_padrao_horas)
  const [confirmou, setConfirmou] = useState(false)
  const preco = lerPrecoDigitado(precoTexto)
  const { grupo } = aviso

  const publicar = useMutation({
    mutationFn: () =>
      api.lotes.publicarAviso(lojaId, grupo.id, {
        separado,
        preco_original: preco!,
        desconto,
        janela_horas: janela,
        confirmou_separacao: true,
      }),
    onSuccess: ({ oferta }) => {
      invalidarAvisos(consultas, lojaId)
      void consultas.invalidateQueries({ queryKey: ['loja-ofertas', lojaId] })
      void consultas.invalidateQueries({ queryKey: ['produtos', lojaId] }) // o preço sugerido mudou
      aoPublicar(oferta)
    },
  })

  const codigo = codigoDoErro(publicar.error)
  const rotuloBotao = !confirmou ? 'Confirme a separação' : !preco ? 'Informe o preço normal' : 'Publicar oferta'

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (confirmou && preco) publicar.mutate()
  }

  return (
    <form className={styles.tela} onSubmit={enviar} noValidate>
      {cabecalho}
      <section className={styles.cartao} aria-label="Resumo">
        <span className={styles.nomeProduto}>{grupo.produto.nome}</span>
        <AmostraFita fita={grupo.fita} data={grupo.referencia} rotuloData="validade" />
        <span className={styles.destaqueNumero}>{separado === 1 ? '1 separada' : `${separado} separadas`}</span>
      </section>

      <Campo
        rotulo="Preço normal"
        inputMode="decimal"
        placeholder="0,00"
        value={precoTexto}
        erro={precoTexto && !preco ? 'Use um valor como 6,99.' : null}
        onChange={(e) => {
          publicar.reset()
          setPrecoTexto(e.target.value)
        }}
      />

      <div className={styles.campo}>
        <span id="rotulo-desconto" className={styles.rotulo}>
          Desconto
        </span>
        <div role="group" aria-labelledby="rotulo-desconto" className={styles.gradeDescontos}>
          {DESCONTOS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={desconto === d}
              className={classes(styles.ladrilho, desconto === d && styles.ladrilhoAtivo)}
              onClick={() => setDesconto(d)}
            >
              {d}%
            </button>
          ))}
        </div>
      </div>

      {/* Resultado logo abaixo da escolha do desconto: preço normal + desconto → preço na oferta. */}
      <section className={styles.precoOferta} aria-label="Preço na oferta">
        <div className={styles.linhaPrecoOferta}>
          <span className={styles.rotulo}>Preço na oferta</span>
          <span className={styles.valorComSelo}>
            <span className={styles.seloDesconto}>−{desconto}%</span>
            <strong className={styles.valorOferta}>{preco ? formatarDinheiro(previaDesconto(preco, desconto)) : '—'}</strong>
          </span>
        </div>
        <p className={styles.ajuda}>
          {preco ? (
            <>
              De <s>{formatarDinheiro(preco)}</s> por <strong>{formatarDinheiro(previaDesconto(preco, desconto))}</strong>. O
              valor final é o que o sistema grava ao publicar.
            </>
          ) : (
            'Informe o preço normal para ver o preço na oferta.'
          )}
        </p>
      </section>

      <div className={styles.campo}>
        <span id="rotulo-janela" className={styles.rotulo}>
          Janela de reserva
        </span>
        <div role="group" aria-labelledby="rotulo-janela" className={styles.gradeJanelas}>
          {JANELAS.map((j) => (
            <button
              key={j}
              type="button"
              aria-pressed={janela === j}
              className={classes(styles.ladrilho, janela === j && styles.ladrilhoAtivo)}
              onClick={() => setJanela(j)}
            >
              {j} h
            </button>
          ))}
        </div>
        <p className={styles.ajuda}>Janelas curtas fazem quem mora longe perder a reserva.</p>
      </div>

      <div className={styles.cartaoFim}>
        <strong>Sai da vitrine {comEm(formatarHorario(aviso.fim_previsto))}</strong>
        <span>
          Validade menos {aviso.margem_efetiva_dias} {aviso.margem_efetiva_dias === 1 ? 'dia' : 'dias'} de margem. Nenhuma
          reserva passa desse horário; o que sobrar livre vira perda.
        </span>
      </div>

      <div className={styles.caixaAviso}>
        <CaixaSelecao checked={confirmou} onChange={(e) => setConfirmou(e.target.checked)}>
          <strong>{separado === 1 ? 'Separei a unidade' : `Separei as ${separado} unidades`}</strong> na área de reservas e não
          vou {separado === 1 ? 'vendê-la' : 'vendê-las'} no balcão
        </CaixaSelecao>
      </div>

      {codigo === 'fim_ja_passou' ? (
        <Mensagem tipo="erro">Essa validade está perto demais: a oferta acabaria antes de começar.</Mensagem>
      ) : (
        publicar.isError && <MensagemErro erro={publicar.error} />
      )}

      <Botao type="submit" disabled={!confirmou || !preco} carregando={publicar.isPending} textoCarregando="Publicando…">
        {rotuloBotao}
      </Botao>
    </form>
  )
}

/** L8 (parte 2) · Oferta publicada: os números são os que a API devolveu. */
function OfertaPublicada({ oferta: o, lojaId }: { oferta: OfertaLoja; lojaId: number }) {
  const navegar = useNavigate()
  return (
    <div className={classes(styles.tela, styles.centro)}>
      <span className={styles.circulo} aria-hidden="true">
        ✓
      </span>
      <h1 className={styles.titulo}>Oferta na vitrine</h1>
      <section className={styles.cartao} aria-label="Oferta publicada">
        <span className={styles.nomeProduto}>{o.produto.nome}</span>
        <dl className={styles.resumoOferta}>
          <div>
            <dt>Quantidade</dt>
            <dd>{o.estoque.separado} un.</dd>
          </div>
          <div>
            <dt>Preço</dt>
            <dd>{formatarDinheiro(o.preco)}</dd>
          </div>
          <div>
            <dt>Janela</dt>
            <dd>{o.janela_horas} h</dd>
          </div>
          <div>
            <dt>Sai da vitrine</dt>
            <dd>{formatarHorario(o.fim)}</dd>
          </div>
        </dl>
      </section>
      <div className={styles.acoes}>
        <Botao onClick={() => navegar(`/loja/${lojaId}/ofertas/${o.id}`)}>Ver a oferta</Botao>
        <Botao variante="secundario" onClick={() => navegar(`/loja/${lojaId}/avisos`)}>
          Próximo aviso
        </Botao>
      </div>
    </div>
  )
}
