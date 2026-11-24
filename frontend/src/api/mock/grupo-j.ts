/*
 * Grupo J (Pedido) no mock — mesma ordem de conferência e mesmas frases do backend
 * (backend/ofertas/servico_pedidos.py, api_pedidos.py e api_loja.py).
 *
 * O pedido não tem tabela aqui: é o conjunto das reservas com o mesmo `pedidoId`
 * (todas da mesma pessoa e loja, com o mesmo código). O backend guarda um Pedido, mas
 * o estado dele também é calculado pelos itens; o efeito para a tela é o mesmo.
 */
import type { ApiPedidos } from '../cliente'
import type { ErroApi } from '../erros'
import type { EstadoPedido, ItemPedido, LojaResumo, Pedido, ReservaLoja, RetiradaFeita } from '../tipos'
import { isoBrasilia } from './datas'
import { calcularExpiraEm, fitaDe, multiplicar, novoCodigo, quantidadeReservada } from './regras-fingidas'
import type { BancoMock, OfertaMock, ReservaMock, UsuarioMock } from './semente'

interface Dependencias {
  banco: () => BancoMock
  agora: () => Date
  responder: <T>(executar: () => T) => Promise<T>
  erro: (status: number, codigo: string, frase: string, extra?: object) => ErroApi
  usuarioLogado: () => UsuarioMock
  vinculoCom: (lojaId: number) => { usuario: UsuarioMock }
  lojaResumo: (lojaId: number) => LojaResumo
  paraReservaLoja: (r: ReservaMock) => ReservaLoja
  /** 409 venceu (nas últimas 24 h) ou 404, como o balcão do grupo C. */
  naoAchou: (lojaId: number, codigo: string) => ErroApi
  abreviar: (nome: string) => string
}

const somar = (valores: string[]) => {
  const centavos = valores.reduce((s, v) => s + Math.round(Number(v) * 100), 0)
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`
}

export function criarApiPedidos(d: Dependencias): ApiPedidos & {
  retirarPedido(lojaId: number, codigo: string): RetiradaFeita
} {
  const ofertaDe = (r: ReservaMock) => d.banco().ofertas.find((o) => o.id === r.ofertaId)!
  const itensDo = (pedidoId: number) =>
    d.banco().reservas.filter((r) => r.pedidoId === pedidoId).sort((a, b) => a.id - b.id)

  function estadoDe(itens: ReservaMock[]): EstadoPedido {
    if (itens.some((r) => r.estado === 'reservada')) return 'ativo'
    return itens.some((r) => r.estado === 'retirada') ? 'retirado' : 'encerrado'
  }

  function paraItem(r: ReservaMock): ItemPedido {
    const o = ofertaDe(r)
    return {
      reserva_id: r.id,
      oferta_id: o.id,
      produto: o.produto.nome,
      pedido: r.pedido,
      quantidade: r.quantidade,
      status: r.quantidade < r.pedido ? 'parcial' : 'confirmada',
      motivo: null,
      estado: r.estado,
      expira_em: isoBrasilia(r.expira_em),
      encerrada_em: r.encerrada_em ? isoBrasilia(r.encerrada_em) : null,
      preco: o.preco,
      subtotal: multiplicar(o.preco, r.quantidade),
    }
  }

  function itemRecusado(o: OfertaMock, pedido: number, motivo: 'esgotada' | 'oferta_encerrada'): ItemPedido {
    return {
      reserva_id: null, oferta_id: o.id, produto: o.produto.nome, pedido, quantidade: 0,
      status: 'recusada', motivo, estado: null, expira_em: null, encerrada_em: null,
      preco: o.preco, subtotal: '0.00',
    }
  }

  /** `itensDaResposta`: só no POST, na ordem enviada (inclui os recusados). */
  function paraPedido(pedidoId: number, itensDaResposta?: ItemPedido[]): Pedido {
    const itens = itensDo(pedidoId)
    const primeiro = itens[0]
    const estado = estadoDe(itens)
    const ativos = itens.filter((r) => r.estado === 'reservada')
    const conta = estado === 'ativo' ? 'reservada' : estado === 'retirado' ? 'retirada' : null
    const proximo = ativos.reduce<Date | null>((m, r) => (m && m < r.expira_em ? m : r.expira_em), null)
    return {
      id: pedidoId,
      codigo: primeiro.codigo,
      loja: d.lojaResumo(ofertaDe(primeiro).lojaId),
      estado,
      criado_em: isoBrasilia(itens.reduce((m, r) => (r.criada_em < m ? r.criada_em : m), primeiro.criada_em)),
      expira_em_proximo: proximo ? isoBrasilia(proximo) : null,
      total: somar(itens.filter((r) => r.estado === conta).map((r) => multiplicar(ofertaDe(r).preco, r.quantidade))),
      itens: itensDaResposta ?? itens.map(paraItem),
    }
  }

  /** O próprio pedido; de outra pessoa (ou inexistente) = 404. */
  function meuPedido(id: number): ReservaMock[] {
    const usuario = d.usuarioLogado()
    const itens = itensDo(id)
    if (!itens.length || itens[0].usuarioId !== usuario.id) {
      throw d.erro(404, 'nao_encontrado', 'Pedido não encontrado.')
    }
    return itens
  }

  function cancelar(r: ReservaMock) {
    const o = ofertaDe(r)
    r.estado = 'cancelada'
    r.encerrada_em = d.agora()
    o.estoque.reservado -= r.quantidade
    o.estoque.livre += r.quantidade
  }

  const codigosAtivosDa = (lojaId: number) =>
    new Set(d.banco().reservas.filter((r) => r.estado === 'reservada' && ofertaDe(r).lojaId === lojaId).map((r) => r.codigo))

  /** Itens ativos do pedido com esse código, na loja da rota (o código é único entre os ativos da loja). */
  function ativosPorCodigo(lojaId: number, codigo: unknown): ReservaMock[] {
    if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) return []
    const achado = d.banco().reservas.find(
      (r) => r.estado === 'reservada' && r.codigo === codigo && ofertaDe(r).lojaId === lojaId,
    )
    return achado ? itensDo(achado.pedidoId).filter((r) => r.estado === 'reservada') : []
  }

  return {
    confirmar: ({ loja_id, itens }) =>
      d.responder(() => {
        const usuario = d.usuarioLogado()
        const outraLoja = () => d.erro(400, 'oferta_de_outra_loja', 'Uma das ofertas não é desta loja.')
        if (!Number.isInteger(loja_id)) throw outraLoja()
        if (!Array.isArray(itens) || itens.length === 0) throw d.erro(400, 'itens_vazios', 'O pedido está vazio.')
        const vistos = new Set<number>()
        for (const item of itens) {
          if (!Number.isInteger(item?.oferta_id)) throw outraLoja()
          if (!Number.isInteger(item.pedido) || item.pedido < 1) {
            throw d.erro(400, 'pedido_invalido', 'Escolha pelo menos 1 unidade de cada item.')
          }
          if (vistos.has(item.oferta_id)) throw d.erro(400, 'item_repetido', 'A mesma oferta apareceu duas vezes.')
          vistos.add(item.oferta_id)
        }
        const ofertas = itens.map(({ oferta_id }) => d.banco().ofertas.find((o) => o.id === oferta_id))
        if (ofertas.some((o) => !o || o.lojaId !== loja_id)) throw outraLoja()

        const momento = d.agora()
        const pedidoId = d.banco().proximoId++
        const codigo = novoCodigo(codigosAtivosDa(loja_id))
        const resposta: ItemPedido[] = []
        itens.forEach(({ pedido }, i) => {
          const o = ofertas[i]!
          if (o.estado !== 'ativa') {
            resposta.push(itemRecusado(o, pedido, 'oferta_encerrada')) // não grava Recusa, como hoje
            return
          }
          const quantidade = quantidadeReservada(pedido, o.estoque.livre)
          if (quantidade === 0) {
            d.banco().recusas.push({ ofertaId: o.id, usuarioId: usuario.id, cliente: d.abreviar(usuario.nome), pedido, criada_em: momento })
            resposta.push(itemRecusado(o, pedido, 'esgotada'))
            return
          }
          const reserva: ReservaMock = {
            id: d.banco().proximoId++,
            pedidoId,
            ofertaId: o.id,
            usuarioId: usuario.id,
            cliente: d.abreviar(usuario.nome),
            quantidade,
            pedido,
            codigo,
            estado: 'reservada',
            criada_em: momento,
            expira_em: calcularExpiraEm(momento, o.janela_horas, o.fim),
            encerrada_em: null,
          }
          o.estoque.livre -= quantidade
          o.estoque.reservado += quantidade
          d.banco().reservas.push(reserva)
          resposta.push(paraItem(reserva))
        })
        if (!resposta.some((i) => i.reserva_id !== null)) {
          // Nada sobrou: sem código; as recusas ficam gravadas. O cliente devolve como resultado.
          return { status: 'tudo_esgotado' as const, erro: 'Esgotou tudo agora há pouco.', itens: resposta }
        }
        return { status: 'criado' as const, pedido: paraPedido(pedidoId, resposta) }
      }),

    listar: (estado) =>
      d.responder(() => {
        const usuario = d.usuarioLogado()
        if (estado !== undefined && estado !== 'ativo' && estado !== 'encerrado') {
          throw d.erro(400, 'parametro_invalido', 'Use estado=ativo ou estado=encerrado.')
        }
        const ids = [...new Set(d.banco().reservas.filter((r) => r.usuarioId === usuario.id).map((r) => r.pedidoId))]
        const pedidos = ids.map((id) => paraPedido(id))
        const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0)
        const ultimoFim = (p: Pedido) => Math.max(...p.itens.map((i) => ms(i.encerrada_em)))
        const ativos = pedidos.filter((p) => p.estado === 'ativo').sort((a, b) => ms(a.expira_em_proximo) - ms(b.expira_em_proximo))
        const outros = pedidos.filter((p) => p.estado !== 'ativo').sort((a, b) => ultimoFim(b) - ultimoFim(a))
        return estado === 'ativo' ? ativos : estado === 'encerrado' ? outros : [...ativos, ...outros]
      }),

    obter: (id) => d.responder(() => (meuPedido(id), paraPedido(id))),

    cancelar: (id) =>
      d.responder(() => {
        const ativos = meuPedido(id).filter((r) => r.estado === 'reservada')
        if (!ativos.length) throw d.erro(409, 'nada_ativo', 'Este pedido não tem itens ativos.')
        ativos.forEach(cancelar)
        return paraPedido(id)
      }),

    cancelarItem: (id, reservaId) =>
      d.responder(() => {
        const r = meuPedido(id).find((x) => x.id === reservaId)
        if (!r) throw d.erro(404, 'nao_encontrado', 'Item não encontrado neste pedido.')
        if (r.estado !== 'reservada') throw d.erro(409, 'ja_encerrado', 'Este item não está mais ativo.')
        cancelar(r)
        return paraPedido(id)
      }),

    previaNoBalcao: (lojaId, codigo) =>
      d.responder(() => {
        d.vinculoCom(lojaId)
        const ativos = ativosPorCodigo(lojaId, codigo)
        if (!ativos.length) {
          const motivo = d.naoAchou(lojaId, codigo)
          if (motivo.status === 409) throw motivo
          throw d.erro(404, 'nao_encontrado', 'Nenhum pedido ativo com esse código nesta loja.')
        }
        return {
          pedido_id: ativos[0].pedidoId,
          codigo: ativos[0].codigo,
          cliente: ativos[0].cliente,
          total: somar(ativos.map((r) => multiplicar(ofertaDe(r).preco, r.quantidade))),
          itens: ativos.map((r) => {
            const o = ofertaDe(r)
            return {
              reserva: d.paraReservaLoja(r),
              produto: o.produto.nome,
              fita: fitaDe(o.validade),
              validade: o.validade,
              total: multiplicar(o.preco, r.quantidade),
            }
          }),
        }
      }),

    /** POST …/retiradas (grupo C, que o J mudou): tudo ou nada, os itens ativos do pedido. Chamar dentro do responder. */
    retirarPedido(lojaId, codigo) {
      const { usuario } = d.vinculoCom(lojaId)
      const ativos = ativosPorCodigo(lojaId, codigo)
      if (!ativos.length) throw d.naoAchou(lojaId, codigo)
      const itens = ativos.map((r) => {
        const o = ofertaDe(r)
        r.estado = 'retirada'
        r.encerrada_em = d.agora()
        o.estoque.reservado -= r.quantidade
        o.estoque.retirado += r.quantidade
        return { reserva: d.paraReservaLoja(r), produto: o.produto.nome, total: multiplicar(o.preco, r.quantidade) }
      })
      // O estoque sai depois de retirar todos: duas linhas da mesma oferta mostram o valor final.
      const comEstoque = itens.map((item, i) => {
        const o = ofertaDe(ativos[i])
        return { ...item, oferta: { id: o.id, estoque: { ...o.estoque } } }
      })
      return {
        codigo: ativos[0].codigo,
        cliente: ativos[0].cliente,
        total: somar(itens.map((i) => i.total)),
        retirada_por: usuario.nome,
        itens: comEstoque,
        reserva: comEstoque[0].reserva,
        oferta: comEstoque[0].oferta,
      }
    },
  }
}
