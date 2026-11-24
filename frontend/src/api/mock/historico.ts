/*
 * Histórico fingido do Mercadinho Vila Nova (loja 1): ~35 dias de ofertas já encerradas,
 * com reservas, recusas e parciais — para o Painel (G1) e o Histórico (G3) terem o que mostrar.
 * Decidido 13/11/2026 (F7, decisão 1a).
 *
 * DETERMINÍSTICO: o sorteio usa uma semente fixa, então o mesmo "agora" gera sempre o mesmo
 * histórico (os testes podem contar com os números). As datas são relativas ao "agora",
 * como o resto da semente.
 */
import type { Categoria, Dinheiro } from '../tipos'
import { dataBrasilia, fimDoDia, somarDias, somarMinutos } from './datas'
import { calcularExpiraEm, quantidadeReservada } from './regras-fingidas'
import type { OfertaMock, RecusaMock, ReservaMock } from './semente'

/** Sorteio com semente (mulberry32): mesma semente → mesma sequência. */
function sorteador(semente: number): () => number {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PRODUTOS: { nome: string; categoria: Categoria; preco: Dinheiro; preco_original: Dinheiro; desconto: number }[] = [
  { nome: 'Leite UHT integral 1 L', categoria: 'leite', preco: '3.35', preco_original: '4.79', desconto: 30 },
  { nome: 'Queijo prato fatiado 150 g', categoria: 'frios', preco: '5.34', preco_original: '8.90', desconto: 40 },
  { nome: 'Molho de tomate 300 g', categoria: 'mercearia', preco: '1.79', preco_original: '2.98', desconto: 40 },
  { nome: 'Iogurte de morango 170 g', categoria: 'laticinios', preco: '3.14', preco_original: '4.49', desconto: 30 },
  { nome: 'Biscoito maisena 200 g', categoria: 'doces', preco: '2.24', preco_original: '3.20', desconto: 30 },
  { nome: 'Ervilha em lata 200 g', categoria: 'enlatados', preco: '1.99', preco_original: '3.98', desconto: 50 },
]

const CLIENTES = ['Bruno M.', 'Carla R.', 'Diego P.', 'Elisa T.', 'Fábio N.', 'Helena P.', 'Lucas F.', 'Marcos T.', 'Paulo M.', 'Rita C.', 'Júlia R.', 'Sônia A.']

const JANELA_HORAS = 4
const QUANTAS_OFERTAS = 12
const DURACAO_DIAS = 3

export interface HistoricoMock {
  ofertas: OfertaMock[]
  reservas: ReservaMock[]
  recusas: RecusaMock[]
}

/**
 * Gera as ofertas encerradas entre 1 e ~35 dias atrás. Ids: ofertas a partir de 50,
 * reservas a partir de 1000 (a semente usa 1–6 e 31–38).
 */
export function gerarHistorico(agora: Date): HistoricoMock {
  const sortear = sorteador(20261022)
  const entre = (min: number, max: number) => min + Math.floor(sortear() * (max - min + 1))
  const hoje = dataBrasilia(agora)
  const ofertas: OfertaMock[] = []
  const reservas: ReservaMock[] = []
  const recusas: RecusaMock[] = []
  let proximaReserva = 1000

  for (let i = 0; i < QUANTAS_OFERTAS; i++) {
    const produto = PRODUTOS[i % PRODUTOS.length]
    const ultimoDia = somarDias(hoje, -(1 + i * 3))
    const fim = fimDoDia(ultimoDia)
    const inicio = somarMinutos(fim, -DURACAO_DIAS * 24 * 60 + 8 * 60) // começou às 8h, 3 dias antes
    const separado = entre(10, 18)
    const estoque = { separado, livre: separado, reservado: 0, retirado: 0, ajustado: 0, perda: 0 }

    // Tentativas de reserva com a loja aberta (8h–21h), em ordem de chegada.
    const chegadas = Array.from({ length: entre(10, 15) }, () =>
      somarMinutos(inicio, entre(0, DURACAO_DIAS - 1) * 24 * 60 + sortear() * 13 * 60),
    )
      .sort((a, b) => a.getTime() - b.getTime())

    for (const criada_em of chegadas) {
      const cliente = entre(0, CLIENTES.length - 1)
      const pedido = entre(1, 3)
      const quantidade = quantidadeReservada(pedido, estoque.livre)
      if (quantidade === 0) {
        recusas.push({ ofertaId: 50 + i, usuarioId: 20 + cliente, cliente: CLIENTES[cliente], pedido, criada_em })
        continue
      }
      const expira_em = calcularExpiraEm(criada_em, JANELA_HORAS, fim)
      const prazoMin = (expira_em.getTime() - criada_em.getTime()) / 60_000
      const desfecho = sortear()
      // Simplificação do mock: o desfecho já é decidido na chegada (e o estoque devolvido na hora).
      const estado = desfecho < 0.7 ? 'retirada' : desfecho < 0.86 ? 'expirada' : 'cancelada'
      const encerrada_em =
        estado === 'retirada'
          ? somarMinutos(criada_em, prazoMin * (0.15 + sortear() * 0.8))
          : estado === 'cancelada'
            ? somarMinutos(criada_em, prazoMin * sortear() * 0.5)
            : expira_em
      if (estado === 'retirada') {
        estoque.livre -= quantidade
        estoque.retirado += quantidade
      }
      const id = proximaReserva++
      reservas.push({
        id,
        pedidoId: id, // grupo J: cada reserva antiga é um pedido de 1 item
        ofertaId: 50 + i,
        usuarioId: 20 + cliente,
        cliente: CLIENTES[cliente],
        quantidade,
        pedido,
        codigo: String(entre(100000, 999999)),
        estado,
        criada_em,
        expira_em,
        encerrada_em,
      })
    }

    // Fim da oferta: a sobra livre vira perda.
    estoque.perda = estoque.livre
    estoque.livre = 0
    ofertas.push({
      id: 50 + i,
      lojaId: 1,
      produto: { nome: produto.nome, categoria: produto.categoria },
      validade: somarDias(ultimoDia, 1), // margem de 1 dia
      inicio,
      fim,
      preco: produto.preco,
      preco_original: produto.preco_original,
      desconto: produto.desconto,
      janela_horas: JANELA_HORAS,
      estado: 'encerrada',
      estoque,
    })
  }

  return { ofertas, reservas, recusas }
}
