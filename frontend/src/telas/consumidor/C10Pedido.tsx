import { useMutation, useQueries, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { ItemPedido, OfertaPublica, OfertaVitrine } from '../../api'
import { RECARGA_30S } from '../../app/consultas'
import { useApi, useSessao } from '../../app/contextos'
import { agruparPorLoja, type GrupoLoja, type ItemCarrinho } from '../../carrinho/carrinho'
import { useCarrinho } from '../../carrinho/contexto'
import { Botao, BotaoIcone } from '../../componentes/Botao'
import { Contador } from '../../componentes/Contador'
import { EstadoVazio } from '../../componentes/EstadoVazio'
import { IconeSacola, IconeVoltar } from '../../componentes/icones'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { classes } from '../../util/classes'
import { previaTotal, somarDinheiro } from '../../util/dinheiro'
import { formatarDinheiro, formatarDistancia } from '../../util/formatar'
import { NadaSobrou } from './C5Pedido'
import styles from './Consumidor.module.css'

/** A distância vem da vitrine (o carrinho e a rota da oferta não têm lat/lng). */
function distanciaDaLoja(consultas: QueryClient, lojaId: number): number | null {
  for (const [, lista] of consultas.getQueriesData<OfertaVitrine[]>({ queryKey: ['vitrine'] })) {
    const achada = lista?.find((o) => o.loja.id === lojaId && o.distancia_km !== null)
    if (achada) return achada.distancia_km
  }
  return null
}

/**
 * C10 · Meu pedido (docs/pedido.md). Itens agrupados por loja; "Confirmar pedido nesta loja"
 * manda só os daquela loja (POST /api/pedidos). Nada fica guardado antes disso. O `livre` de
 * cada oferta é conferido ao abrir e a cada 30 s: o que esgotou fica apagado, com "Remover".
 */
export function C10Pedido() {
  const api = useApi()
  const { token } = useSessao()
  const consultas = useQueryClient()
  const carrinho = useCarrinho()
  const navegar = useNavigate()
  const rota = useLocation()
  const [esgotouTudo, setEsgotouTudo] = useState<ItemPedido[] | null>(null)

  // Mesma chave da C4: abrir a oferta depois aproveita o que já veio.
  const ofertas = useQueries({
    queries: carrinho.itens.map((i) => ({
      queryKey: ['oferta', i.ofertaId],
      queryFn: () => api.consumidor.obterOferta(i.ofertaId),
      ...RECARGA_30S,
    })),
  })
  const ofertaDe = (ofertaId: number): OfertaPublica | undefined =>
    ofertas[carrinho.itens.findIndex((i) => i.ofertaId === ofertaId)]?.data

  const confirmar = useMutation({
    mutationFn: (grupo: GrupoLoja) =>
      api.pedidos.confirmar({
        loja_id: grupo.lojaId,
        itens: grupo.itens
          .filter((i) => !esgotado(ofertaDe(i.ofertaId)))
          .map((i) => ({ oferta_id: i.ofertaId, pedido: i.pedido })),
      }),
    onSuccess: (resultado) => {
      void consultas.invalidateQueries({ queryKey: ['vitrine'] })
      void consultas.invalidateQueries({ queryKey: ['oferta'] })
      void consultas.invalidateQueries({ queryKey: ['pedidos'] })
      if (resultado.status === 'tudo_esgotado') {
        setEsgotouTudo(resultado.itens) // os itens continuam no carrinho, agora marcados como esgotados
        return
      }
      const { pedido } = resultado
      // Os confirmados (inteiros ou em parte) saem do carrinho; os recusados ficam, marcados.
      carrinho.tirar(...pedido.itens.filter((i) => i.reserva_id !== null).map((i) => i.oferta_id))
      consultas.setQueryData(['pedido', pedido.id], pedido)
      navegar(`/pedidos/${pedido.id}/resultado`, { state: pedido })
    },
  })

  function aoConfirmar(grupo: GrupoLoja) {
    if (!token) {
      // Confirmar exige conta; o carrinho do visitante passa para ela e a pessoa volta para cá.
      navegar(`/entrar?voltar=${encodeURIComponent(rota.pathname)}`)
      return
    }
    confirmar.mutate(grupo)
  }

  const voltar = () => (rota.key === 'default' ? navegar('/vitrine') : navegar(-1))

  if (esgotouTudo) return <NadaSobrou aoVoltar={() => setEsgotouTudo(null)} />

  return (
    <div className={styles.pilha}>
      <header className={styles.cabecalhoPedido}>
        <BotaoIcone rotulo="Voltar" onClick={voltar}>
          <IconeVoltar />
        </BotaoIcone>
        <div>
          <h1 className={styles.tituloTela}>Meu pedido</h1>
          <span className={styles.texto}>Um código por loja</span>
        </div>
      </header>

      {carrinho.itens.length === 0 ? (
        <EstadoVazio
          icone={<IconeSacola />}
          frase="Seu pedido está vazio"
          detalhe="Abra uma oferta e toque em “Adicionar ao pedido”."
          acao={{ rotulo: 'Ver ofertas', aoClicar: () => navegar('/vitrine') }}
        />
      ) : (
        <>
          <Mensagem tipo="atencao">
            Os itens só ficam guardados para você quando você <strong>confirma</strong> o pedido da loja.
          </Mensagem>
          {confirmar.isError && <MensagemErro erro={confirmar.error} />}
          {agruparPorLoja(carrinho.itens).map((grupo) => (
            <CartaoLoja
              key={grupo.lojaId}
              grupo={grupo}
              distancia={distanciaDaLoja(consultas, grupo.lojaId)}
              ofertaDe={ofertaDe}
              confirmando={confirmar.isPending && confirmar.variables?.lojaId === grupo.lojaId}
              bloqueado={confirmar.isPending}
              aoConfirmar={() => aoConfirmar(grupo)}
            />
          ))}
        </>
      )}
    </div>
  )
}

/** Esgotou ou a oferta terminou (só sabemos depois que a oferta carrega). */
const esgotado = (o: OfertaPublica | undefined) => o !== undefined && (o.estado !== 'ativa' || o.livre === 0)

interface CartaoLojaProps {
  grupo: GrupoLoja
  distancia: number | null
  ofertaDe: (ofertaId: number) => OfertaPublica | undefined
  confirmando: boolean
  bloqueado: boolean
  aoConfirmar: () => void
}

function CartaoLoja({ grupo, distancia, ofertaDe, confirmando, bloqueado, aoConfirmar }: CartaoLojaProps) {
  const valendo = grupo.itens.filter((i) => !esgotado(ofertaDe(i.ofertaId)))
  // PRÉVIA: o total oficial é o que a API devolve ao confirmar (pode haver parcial).
  const total = somarDinheiro(valendo.map((i) => previaTotal(ofertaDe(i.ofertaId)?.preco ?? i.preco, i.pedido)))

  return (
    <section className={styles.cartaoLoja} aria-label={grupo.lojaNome}>
      <div className={styles.topoLoja}>
        <h2 className={styles.tituloLista}>{grupo.lojaNome}</h2>
        {distancia !== null && <span className={styles.texto}>{formatarDistancia(distancia)}</span>}
      </div>
      {grupo.itens.map((item) => (
        <LinhaItem key={item.ofertaId} item={item} oferta={ofertaDe(item.ofertaId)} />
      ))}
      <div className={styles.totalLoja}>
        <span>Total na loja</span>
        <strong>{formatarDinheiro(total)}</strong>
      </div>
      <Botao
        onClick={aoConfirmar}
        disabled={valendo.length === 0 || bloqueado}
        carregando={confirmando}
        textoCarregando="Confirmando…"
      >
        Confirmar pedido nesta loja
      </Botao>
    </section>
  )
}

function LinhaItem({ item, oferta }: { item: ItemCarrinho; oferta: OfertaPublica | undefined }) {
  const carrinho = useCarrinho()
  const acabou = esgotado(oferta)
  const preco = oferta?.preco ?? item.preco
  const livre = oferta?.livre

  return (
    <div className={classes(styles.itemPedido, acabou && styles.itemEsgotado)}>
      <div className={styles.linhaItem}>
        <div className={styles.nomeItem}>
          <strong>{item.produto}</strong>
          {acabou ? (
            <span className={styles.avisoEsgotou}>Esgotou depois que você adicionou</span>
          ) : (
            <span className={styles.texto}>
              {formatarDinheiro(preco)} cada
              {livre !== undefined && ` · ${livre} ${livre === 1 ? 'disponível' : 'disponíveis'}`}
            </span>
          )}
        </div>
        {!acabou && (
          <Contador
            valor={item.pedido}
            min={1}
            max={Math.max(livre ?? item.pedido, 1)}
            aoMudar={(n) => carrinho.alterar(item.ofertaId, n)}
            rotulo={`Quantidade de ${item.produto}`}
          />
        )}
      </div>
      {!acabou && livre !== undefined && item.pedido > livre && (
        <span className={styles.texto}>
          Agora {livre === 1 ? 'resta 1' : `restam ${livre}`}. Ao confirmar, reservamos o que tiver.
        </span>
      )}
      <button
        type="button"
        className={styles.botaoRemover}
        aria-label={`Remover ${item.produto}`}
        onClick={() => carrinho.tirar(item.ofertaId)}
      >
        Remover
      </button>
    </div>
  )
}
