/*
 * Semente do grupo D (loja 1): os avisos e grupos do protótipo (Main.dc.html, `avisos` e
 * `grupos`), com as datas RELATIVAS a hoje como o resto do mock. Cores e anos não são
 * escritos aqui: saem da validade (regras-fingidas.ts), como no backend.
 */
import type { Categoria, Data, Dinheiro } from '../tipos'
import { somarDias } from './datas'
import { fitaDe } from './regras-fingidas'
import type { GrupoMock, LoteMock, ProdutoMock, SituacaoGravada } from './semente'

interface ItemSemente {
  nome: string
  categoria: Categoria
  preco_anterior: Dinheiro | null
  /** Sem grupo: produto do catálogo que só aparece na busca da L3. */
  grupo?: {
    venceEm: number
    situacao: SituacaoGravada
    /** Quantidades dos lotes (o primeiro vence na referência; os outros, dias depois). */
    lotes: number[]
    /** Adiado: volta em N dias. */
    voltaEm?: number
    /** Colisão de ciclo: há um lote da mesma cor do ano anterior. */
    colisao?: boolean
    ofertaId?: number
  }
}

const ITENS: ItemSemente[] = [
  // Avisos (L5): conferir = o dia do aviso já chegou (referência − antecedência ≤ hoje).
  { nome: 'Leite condensado 395 g', categoria: 'mercearia', preco_anterior: '6.99', grupo: { venceEm: 6, situacao: 'aguardando', lotes: [24, 12] } },
  { nome: 'Creme de leite 200 g', categoria: 'mercearia', preco_anterior: '3.49', grupo: { venceEm: 8, situacao: 'aguardando', lotes: [20] } },
  { nome: 'Salsicha hot dog 500 g', categoria: 'frios', preco_anterior: '9.80', grupo: { venceEm: 10, situacao: 'aguardando', lotes: [15] } },
  { nome: 'Chocolate ao leite 90 g', categoria: 'doces', preco_anterior: '5.49', grupo: { venceEm: 10, situacao: 'aguardando', lotes: [20] } },
  {
    nome: 'Achocolatado em pó 400 g',
    categoria: 'mercearia',
    preco_anterior: '8.90',
    grupo: { venceEm: 9, situacao: 'adiado', voltaEm: 1, colisao: true, lotes: [24] },
  },
  // Grupos que viraram as ofertas da semente (ids 1, 2, 5 e 6).
  { nome: 'Iogurte natural 170 g', categoria: 'laticinios', preco_anterior: null, grupo: { venceEm: 6, situacao: 'em_oferta', lotes: [18], ofertaId: 1 } },
  { nome: 'Presunto fatiado 200 g', categoria: 'frios', preco_anterior: null, grupo: { venceEm: 8, situacao: 'em_oferta', lotes: [8], ofertaId: 2 } },
  { nome: 'Queijo minas frescal 250 g', categoria: 'laticinios', preco_anterior: null, grupo: { venceEm: 2, situacao: 'em_oferta', lotes: [8], ofertaId: 5 } },
  { nome: 'Requeijão cremoso 200 g', categoria: 'laticinios', preco_anterior: null, grupo: { venceEm: -1, situacao: 'em_oferta', lotes: [10], ofertaId: 6 } },
  // Aguardando o dia do aviso.
  { nome: 'Feijão carioca 1 kg', categoria: 'mercearia', preco_anterior: null, grupo: { venceEm: 116, situacao: 'aguardando', lotes: [20, 20] } },
  { nome: 'Macarrão espaguete 500 g', categoria: 'mercearia', preco_anterior: null, grupo: { venceEm: 149, situacao: 'aguardando', lotes: [30] } },
  // Só no catálogo (busca da L3).
  { nome: 'Milho verde em lata 200 g', categoria: 'enlatados', preco_anterior: null },
  { nome: 'Leite UHT integral 1 L', categoria: 'leite', preco_anterior: null },
]

/** Mesmo dia e mês do ano anterior (dia até 28, por causa de 29/02): mesma cor, outro ano. */
const anoAnterior = (data: Data) => `${Number(data.slice(0, 4)) - 1}-${data.slice(5, 8)}${String(Math.min(28, Number(data.slice(8)))).padStart(2, '0')}`

/** Todos os lotes de um grupo têm a mesma cor: se a data passou do bimestre, fica a referência. */
function mesmaCor(referencia: Data, validade: Data): Data {
  const [a, b] = [fitaDe(referencia), fitaDe(validade)]
  return a.cor === b.cor && a.ano === b.ano ? validade : referencia
}

export function sementeLotes(hoje: Data, antecedenciaDias: number) {
  const produtos: ProdutoMock[] = []
  const grupos: GrupoMock[] = []
  const lotes: LoteMock[] = []

  ITENS.forEach((item, i) => {
    const produtoId = 201 + i
    produtos.push({ id: produtoId, lojaId: 1, nome: item.nome, categoria: item.categoria, margem_fim_dias: null, preco_anterior: item.preco_anterior })
    const g = item.grupo
    if (!g) return
    const grupoId = 301 + i
    const referencia = somarDias(hoje, g.venceEm)
    grupos.push({
      id: grupoId,
      produtoId,
      referencia,
      situacao: g.situacao,
      aviso_em: somarDias(referencia, -antecedenciaDias),
      adiado_ate: g.voltaEm ? somarDias(hoje, g.voltaEm) : null,
      colisao_validade: g.colisao ? anoAnterior(referencia) : null,
      motivo_descarte: null,
      ofertaId: g.ofertaId ?? null,
    })
    g.lotes.forEach((quantidade, k) => {
      lotes.push({
        id: 401 + i * 10 + k,
        grupoId,
        validade: mesmaCor(referencia, somarDias(referencia, k * 3)),
        quantidade,
        recebido_em: somarDias(hoje, -(20 + k * 4)),
      })
    })
  })
  return { produtos, grupos, lotes }
}
