import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import type { OfertaVitrine, ResultadoReserva } from '../../api'
import { RECARGA_30S } from '../../app/consultas'
import { useApi, useSessao } from '../../app/contextos'
import { Botao, BotaoIcone } from '../../componentes/Botao'
import { Preco, SeloDesconto } from '../../componentes/CartaoOferta'
import { Contador } from '../../componentes/Contador'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { IconeSacola, IconeVoltar } from '../../componentes/icones'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { previaTotal } from '../../util/dinheiro'
import { formatarData, formatarDinheiro, formatarDistancia, formatarHorario } from '../../util/formatar'
import { ResultadoRecusada } from './C5Resultado'
import styles from './Consumidor.module.css'

/** A distância vem da vitrine (a rota da oferta não recebe lat/lng no contrato). */
function procurarNaVitrine(consultas: QueryClient, id: number): OfertaVitrine | undefined {
  for (const [, lista] of consultas.getQueriesData<OfertaVitrine[]>({ queryKey: ['vitrine'] })) {
    const achada = lista?.find((o) => o.id === id)
    if (achada) return achada
  }
  return undefined
}

type Recusa = Extract<ResultadoReserva, { status: 'recusada' }>

/** C4 · Reserva da quantidade. O máximo do contador é o `livre` que a API devolve. */
export function C4Oferta() {
  const id = Number(useParams().ofertaId)
  const api = useApi()
  const { token } = useSessao()
  const consultas = useQueryClient()
  const navegar = useNavigate()
  const rota = useLocation()
  const [quantidade, setQuantidade] = useState(1)
  const [recusa, setRecusa] = useState<Recusa | null>(null)

  const oferta = useQuery({ queryKey: ['oferta', id], queryFn: () => api.consumidor.obterOferta(id), ...RECARGA_30S })

  const reservar = useMutation({
    mutationFn: (pedido: number) => api.consumidor.reservar(id, pedido),
    onSuccess: (resultado) => {
      void consultas.invalidateQueries({ queryKey: ['vitrine'] })
      void consultas.invalidateQueries({ queryKey: ['oferta', id] })
      void consultas.invalidateQueries({ queryKey: ['minhas-reservas'] })
      if (resultado.status === 'recusada') {
        setRecusa(resultado) // C5, estado recusada
        return
      }
      consultas.setQueryData(['reserva', resultado.reserva.id], resultado.reserva)
      navegar(`/reserva/${resultado.reserva.id}/resultado`, { state: resultado })
    },
  })

  const voltar = () => (rota.key === 'default' ? navegar('/vitrine') : navegar(-1))

  if (recusa) return <ResultadoRecusada recusa={recusa} />
  if (oferta.isPending) return <EsqueletoLista quantidade={1} rotulo="Carregando oferta…" />
  if (oferta.isError) {
    return (
      <div className={styles.pilha}>
        <MensagemErro erro={oferta.error} />
        <Botao variante="secundario" onClick={() => navegar('/vitrine')}>
          Ver outras ofertas
        </Botao>
      </div>
    )
  }

  const o = oferta.data
  const encerrada = o.estado !== 'ativa'
  const disponivel = !encerrada && o.livre > 0
  const qtd = Math.max(1, Math.min(quantidade, o.livre)) // o livre pode cair na recarga de 30 s
  const distancia = procurarNaVitrine(consultas, id)?.distancia_km ?? null

  function aoReservar() {
    if (!token) {
      navegar(`/entrar?voltar=${encodeURIComponent(rota.pathname)}`)
      return
    }
    reservar.mutate(qtd)
  }

  return (
    <div className={styles.c4}>
      <div className={styles.imagemGrande}>
        <IconeSacola tamanho={48} />
        <BotaoIcone rotulo="Voltar" className={styles.voltarRedondo} onClick={voltar}>
          <IconeVoltar />
        </BotaoIcone>
        <span className={styles.seloImagem}>
          <SeloDesconto desconto={o.desconto} grande />
        </span>
      </div>

      <h1 className={styles.tituloProduto}>{o.produto.nome}</h1>
      <p>
        <Preco preco={o.preco} original={o.preco_original} tamanho={24} />{' '}
        <span className={styles.texto}>· vence {formatarData(o.validade)}</span>
      </p>
      <p className={styles.loja}>
        <strong>{o.loja.nome}</strong>
        <br />
        {o.loja.endereco}
        {distancia !== null && ` · ${formatarDistancia(distancia)}`}
      </p>

      {encerrada ? (
        <Mensagem tipo="erro">Esta oferta já terminou.</Mensagem>
      ) : !disponivel ? (
        <Mensagem tipo="erro" titulo="Esgotou.">
          A oferta volta para a vitrine se alguém cancelar ou deixar a reserva expirar.
        </Mensagem>
      ) : (
        <>
          <div className={styles.linhaQuantidade}>
            <span className={styles.rotulo}>Quantidade</span>
            <span className={styles.texto}>
              {o.livre} {o.livre === 1 ? 'disponível' : 'disponíveis'}
            </span>
          </div>
          <Contador valor={qtd} min={1} max={o.livre} aoMudar={setQuantidade} rotulo="Quantidade" />
          {o.livre <= 2 && (
            <Mensagem tipo="atencao">
              {o.livre === 1 ? 'Resta só 1 unidade.' : `Restam só ${o.livre} unidades.`} Se alguém reservar antes de
              você, reservamos o que sobrar e avisamos na hora.
            </Mensagem>
          )}
          <div className={styles.cartaoJanela}>
            {o.retirar_ate ? (
              <>
                Retire até <strong>{formatarHorario(o.retirar_ate)}</strong> (janela de {o.janela_horas} h).
              </>
            ) : (
              <>
                Janela de {o.janela_horas} h para retirar, até o fim da oferta ({formatarHorario(o.fim)}).
              </>
            )}{' '}
            O pagamento é feito na loja, na retirada.
          </div>
        </>
      )}

      {reservar.isError && <MensagemErro erro={reservar.error} />}

      <Botao disabled={!disponivel} carregando={reservar.isPending} textoCarregando="Reservando…" onClick={aoReservar}>
        {disponivel ? `Reservar ${qtd} · ${formatarDinheiro(previaTotal(o.preco, qtd))}` : 'Indisponível'}
      </Botao>
    </div>
  )
}
