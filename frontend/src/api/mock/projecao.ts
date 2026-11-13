/*
 * Projeção (grupo G) no mock: soma as células do resumo pré-calculado e divide — a média
 * exata das rodadas filtradas, como o backend fará (contrato, "De onde vêm os números").
 */
import type { FaixaLote, FaixaProcura, Projecao } from '../tipos'
import { JANELAS_PROJECAO, RESUMO_PROJECAO } from './projecao-resumo'

const umaCasa = (n: number) => Math.round(n * 10) / 10

export function calcularProjecao(lote: FaixaLote | null, procura: FaixaProcura | null): Projecao {
  const celulas = Object.entries(RESUMO_PROJECAO)
    .filter(([chave]) => {
      const [l, p] = chave.split('|')
      return (!lote || l === lote) && (!procura || p === procura)
    })
    .map(([, somas]) => somas)

  const janelas = JANELAS_PROJECAO.map((janela_horas, i) => {
    const t = [0, 0, 0, 0, 0]
    for (const somas of celulas) somas[i].forEach((v, k) => (t[k] += v))
    const [rodadas, perda, comCompra, bloqueados, retirada] = t
    return {
      janela_horas,
      perda_pct: rodadas ? umaCasa((perda / rodadas) * 100) : 0,
      bloqueados_pct: comCompra ? umaCasa((bloqueados / comCompra) * 100) : 0,
      retirada_pct: comCompra ? umaCasa((retirada / comCompra) * 100) : 0,
      rodadas,
    }
  })

  return {
    // Cada rodada simula as 7 janelas: a contagem é a mesma em todas.
    rodadas: janelas[0].rodadas,
    filtro: { lote, procura, chegada: 2 },
    janelas: janelas.map(({ rodadas: _r, ...j }) => j),
  }
}
