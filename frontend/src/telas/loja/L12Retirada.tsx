import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import type { PedidoNoBalcao, RetiradaFeita } from '../../api'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { useAgora } from '../../app/tempo'
import { AmostraFita } from '../../componentes/AmostraFita'
import { Botao } from '../../componentes/Botao'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { Selo } from '../../componentes/Selo'
import { classes } from '../../util/classes'
import { codigoDoErro } from '../../util/erros'
import { nomeDaCor } from '../../util/fita'
import { formatarDinheiro, formatarHorario, formatarTempoRestante } from '../../util/formatar'
import styles from './Retirada.module.css'

const TAMANHO = 6

type Fase =
  | { tipo: 'digitando' }
  | { tipo: 'encontrada'; previa: PedidoNoBalcao }
  | { tipo: 'nao_encontrada' }
  | { tipo: 'confirmada'; feita: RetiradaFeita }

/** A prévia (grupo J) diz "nao_encontrado"; a retirada, "nao_encontrada". Para a tela, é o mesmo. */
const naoAchou = (erro: unknown) => ['nao_encontrado', 'nao_encontrada'].includes(codigoDoErro(erro) ?? '')

/**
 * L12 · Validar retirada e L13 · resultado (mesma rota). Retirada é por LOJA + CÓDIGO:
 * o funcionário digita o que o cliente mostra; não escolhe a reserva numa lista.
 * Grupo J: o código é do PEDIDO; a L13 lista os itens ativos e a retirada leva todos.
 */
export function L12Retirada() {
  const api = useApi()
  const consultas = useQueryClient()
  const { lojaId } = useLojaAtual()
  const [digitos, setDigitos] = useState('')
  const [fase, setFase] = useState<Fase>({ tipo: 'digitando' })

  const resumo = useQuery({ queryKey: ['resumo', lojaId], queryFn: () => api.operacao.resumoDoDia(lojaId) })

  const buscar = useMutation({
    mutationFn: (codigo: string) => api.pedidos.previaNoBalcao(lojaId, codigo),
    onSuccess: (previa) => setFase({ tipo: 'encontrada', previa }),
    onError: (erro) => {
      if (naoAchou(erro)) setFase({ tipo: 'nao_encontrada' })
    },
  })

  const confirmar = useMutation({
    mutationFn: (previa: PedidoNoBalcao) => api.operacao.retirar(lojaId, previa.codigo),
    onSuccess: (feita) => {
      void consultas.invalidateQueries({ queryKey: ['resumo', lojaId] })
      void consultas.invalidateQueries({ queryKey: ['loja-ofertas', lojaId] })
      for (const item of feita.itens) {
        void consultas.invalidateQueries({ queryKey: ['loja-oferta', lojaId, item.oferta.id] })
      }
      setFase({ tipo: 'confirmada', feita })
    },
    onError: (erro) => {
      if (naoAchou(erro)) setFase({ tipo: 'nao_encontrada' })
    },
  })

  function recomecar() {
    setDigitos('')
    buscar.reset()
    confirmar.reset()
    setFase({ tipo: 'digitando' })
  }

  if (fase.tipo === 'encontrada') {
    return <Encontrada previa={fase.previa} confirmar={confirmar} aoVoltar={recomecar} />
  }
  if (fase.tipo === 'nao_encontrada') return <NaoEncontrada aoDigitarDeNovo={recomecar} />
  if (fase.tipo === 'confirmada') return <Confirmada feita={fase.feita} aoValidarOutro={recomecar} />

  return (
    <Digitacao
      digitos={digitos}
      setDigitos={setDigitos}
      aguardando={resumo.data?.aguardando_retirada}
      buscando={buscar.isPending}
      erro={buscar.isError && !naoAchou(buscar.error) ? buscar.error : null}
      aoBuscar={() => buscar.mutate(digitos)}
    />
  )
}

// ---------- L12 ----------

function Digitacao(props: {
  digitos: string
  setDigitos: (atualizar: (d: string) => string) => void
  aguardando: number | undefined
  buscando: boolean
  erro: unknown
  aoBuscar: () => void
}) {
  const { digitos, setDigitos, aguardando, buscando, erro, aoBuscar } = props
  const faltam = TAMANHO - digitos.length
  const completo = faltam === 0

  const digitar = (d: string) => setDigitos((atual) => (atual.length < TAMANHO ? atual + d : atual))
  const apagar = () => setDigitos((atual) => atual.slice(0, -1))
  const limpar = () => setDigitos(() => '')

  // No computador, o teclado físico também funciona (números, ⌫, Enter).
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) digitar(e.key)
      else if (e.key === 'Backspace') apagar()
      else if (e.key === 'Enter' && completo && !buscando) aoBuscar()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  return (
    <div className={styles.tela}>
      <h1 className={styles.titulo}>
        Validar retirada
        {aguardando !== undefined && (
          <>
            {' '}
            <span className={styles.aguardando}>· {aguardando} aguardando</span>
          </>
        )}
      </h1>
      <p className={styles.texto}>Digite o código de 6 dígitos que o cliente mostra no celular.</p>

      <div className={styles.caixas} aria-hidden="true">
        {Array.from({ length: TAMANHO }, (_, i) => (
          <span key={i} className={classes(styles.caixa, i === digitos.length && styles.atual, i === 2 && styles.fimGrupo)}>
            {digitos[i] ?? ''}
          </span>
        ))}
      </div>
      <p className="so-leitor" role="status">
        {digitos ? `Código digitado: ${digitos.split('').join(' ')}` : 'Nenhum dígito digitado'}
      </p>

      {/* Teclado próprio: nenhum campo de texto, então o teclado do celular não abre. */}
      <div className={styles.teclado} role="group" aria-label="Teclado numérico">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className={styles.tecla} onClick={() => digitar(d)} disabled={completo}>
            {d}
          </button>
        ))}
        <button type="button" className={classes(styles.tecla, styles.teclaAcao)} onClick={limpar} disabled={!digitos}>
          Limpar
        </button>
        <button type="button" className={styles.tecla} onClick={() => digitar('0')} disabled={completo}>
          0
        </button>
        <button type="button" className={classes(styles.tecla, styles.teclaAcao)} onClick={apagar} disabled={!digitos} aria-label="Apagar">
          ⌫
        </button>
      </div>

      {Boolean(erro) && <MensagemErro erro={erro} />}

      <Botao disabled={!completo} carregando={buscando} textoCarregando="Buscando…" onClick={aoBuscar}>
        {completo ? 'Buscar reserva' : `Faltam ${faltam} ${faltam === 1 ? 'dígito' : 'dígitos'}`}
      </Botao>
    </div>
  )
}

// ---------- L13 ----------

const contarItens = (n: number) => (n === 1 ? '1 item' : `${n} itens`)

function Encontrada({
  previa: p,
  confirmar,
  aoVoltar,
}: {
  previa: PedidoNoBalcao
  confirmar: { mutate: (p: PedidoNoBalcao) => void; isPending: boolean; isError: boolean; error: unknown }
  aoVoltar: () => void
}) {
  const agora = useAgora(30_000)
  // O primeiro item a vencer manda no aviso: depois dele, a retirada já não leva tudo.
  const prazo = Math.min(...p.itens.map((i) => new Date(i.reserva.expira_em).getTime()))
  const restante = prazo - agora.getTime()
  const umItem = p.itens.length === 1
  const quantidade = p.itens[0].reserva.quantidade

  return (
    <div className={styles.tela}>
      <h1 className={styles.titulo}>Pedido encontrado</h1>
      <section className={styles.cartao}>
        <p className={styles.codigo}>
          Código {p.codigo.slice(0, 3)} {p.codigo.slice(3)}
        </p>
        <p>
          Cliente: <strong>{p.cliente}</strong> · Pedido · {contarItens(p.itens.length)}
        </p>
        <Selo variante="pending">Reservado · expira em {restante > 0 ? formatarTempoRestante(restante) : 'instantes'}</Selo>
      </section>

      <ul className={styles.itens} aria-label="Itens a entregar">
        {p.itens.map((item) => (
          <li key={item.reserva.id} className={styles.cartao}>
            <p>
              <strong>
                {item.reserva.quantidade} × {item.produto}
              </strong>
            </p>
            <AmostraFita fita={item.fita} data={item.validade} />
            <p className={styles.texto}>Zona {nomeDaCor(item.fita.cor)} · área de reservas</p>
          </li>
        ))}
      </ul>

      <p className={styles.cobrar}>
        Cobrar no caixa: <strong>{formatarDinheiro(p.total)}</strong>
      </p>
      {umItem ? (
        <Mensagem tipo="atencao" titulo="Retirada tudo ou nada:">
          entregue {quantidade === 1 ? 'a unidade' : `as ${quantidade} unidades`}. Se o cliente quiser menos, ele cancela
          no app e reserva de novo.
        </Mensagem>
      ) : (
        <Mensagem tipo="atencao" titulo="Retirada do pedido inteiro:">
          entregue os {p.itens.length} itens. Se o cliente desistir de um, ele cancela o item no app e você digita o
          código de novo.
        </Mensagem>
      )}

      {confirmar.isError && <MensagemErro erro={confirmar.error} />}

      <Botao carregando={confirmar.isPending} textoCarregando="Registrando…" onClick={() => confirmar.mutate(p)}>
        Entreguei e cobrei · confirmar
      </Botao>
      <Botao variante="secundario" onClick={aoVoltar}>
        {confirmar.isError ? 'Digitar outro código' : 'Voltar'}
      </Botao>
    </div>
  )
}

function NaoEncontrada({ aoDigitarDeNovo }: { aoDigitarDeNovo: () => void }) {
  return (
    <div className={styles.tela}>
      <h1 className={styles.titulo}>Código não encontrado</h1>
      <Mensagem tipo="erro" titulo="Nenhum pedido ativo com esse código nesta loja.">
        Pode ter sido:
        <ul className={styles.causas}>
          <li>digitado errado;</li>
          <li>pedido que já expirou ou foi cancelado;</li>
          <li>pedido de outra loja.</li>
        </ul>
      </Mensagem>
      <p className={styles.texto}>Peça para o cliente abrir “Minhas reservas” e conferir o código e a loja.</p>
      <p className={styles.aviso}>Não entregue o produto sem validar.</p>
      <Botao onClick={aoDigitarDeNovo}>Digitar de novo</Botao>
    </div>
  )
}

function Confirmada({ feita, aoValidarOutro }: { feita: RetiradaFeita; aoValidarOutro: () => void }) {
  const navegar = useNavigate()
  const { lojaId } = useLojaAtual()
  const [primeiro] = feita.itens
  const umItem = feita.itens.length === 1
  const quando = primeiro.reserva.encerrada_em
  const { estoque } = primeiro.oferta
  const oQue = umItem
    ? `${primeiro.reserva.quantidade} × ${primeiro.produto}`
    : `${contarItens(feita.itens.length)} (${feita.itens.map((i) => `${i.produto} ×${i.reserva.quantidade}`).join(', ')})`

  return (
    <div className={classes(styles.tela, styles.centro)}>
      <span className={styles.circulo} aria-hidden="true">
        ✓
      </span>
      <h1 className={styles.titulo}>Retirada registrada</h1>
      <section className={styles.cartao}>
        <p>
          <strong>{oQue}</strong> · {formatarDinheiro(feita.total)}
        </p>
        <p className={styles.texto}>
          {quando && `${formatarHorario(quando)} · `}Registrada por {feita.retirada_por}
        </p>
        {umItem ? (
          <p>
            A oferta agora tem {estoque.livre} {estoque.livre === 1 ? 'livre' : 'livres'} e {estoque.reservado}{' '}
            {estoque.reservado === 1 ? 'reservada' : 'reservadas'}.
          </p>
        ) : (
          <p>Os estoques das {feita.itens.length} ofertas já foram atualizados.</p>
        )}
      </section>
      <Botao onClick={aoValidarOutro}>Validar outro código</Botao>
      <Botao variante="secundario" onClick={() => navegar(`/loja/${lojaId}`)}>
        Início
      </Botao>
    </div>
  )
}
