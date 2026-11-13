/*
 * Gera src/api/mock/projecao-resumo.ts a partir de simulacao/resultados_n5000/rodadas.csv.
 * SÓ LÊ o CSV (nada da simulação é alterado). Rodar: npm run mock:projecao
 *
 * Mesma ideia do contrato (grupo G, "De onde vêm os números"): para cada faixa de lote ×
 * faixa de procura × janela, guarda SOMAS e CONTAGENS — não médias. Quem consulta soma as
 * células escolhidas e divide, o que dá a média exata das rodadas filtradas.
 * O rodadas.csv só tem a chegada de 2 h (mediana_tempo_chegada = 2.0).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const ORIGEM = resolve(aqui, '../../simulacao/resultados_n5000/rodadas.csv')
const DESTINO = resolve(aqui, '../src/api/mock/projecao-resumo.ts')

// Faixas do contrato. Lote: inteiros, fechadas nas duas pontas. Procura (÷ lote): [a, b), a última fechada.
const LOTES = [['5-14', 5, 14], ['15-24', 15, 24], ['25-34', 25, 34], ['35-44', 35, 44], ['45-60', 45, 60]]
const PROCURAS = [['0.3-0.8', 0.3, 0.8], ['0.8-1.3', 0.8, 1.3], ['1.3-1.8', 1.3, 1.8], ['1.8-2.3', 1.8, 2.3], ['2.3-3.0', 2.3, 3.0]]
const JANELAS = [0.5, 1, 2, 4, 8, 12, 24]

const faixaLote = (lote) => LOTES.find(([, a, b]) => lote >= a && lote <= b)?.[0]
const faixaProcura = (razao) =>
  PROCURAS.find(([, a, b], i) => razao >= a && (razao < b || (i === PROCURAS.length - 1 && razao <= b)))?.[0]

const linhas = readFileSync(ORIGEM, 'utf8').trim().split(/\r?\n/)
const cab = linhas[0].split(',')
const col = (nome) => {
  const i = cab.indexOf(nome)
  if (i < 0) throw new Error(`coluna ${nome} não encontrada`)
  return i
}
const [iJanela, iLote, iRazao, iChegada, iPerda, iBloq, iRet] = [
  'janela', 'lote', 'razao', 'mediana_tempo_chegada', 'perda_pct', 'bloqueados_pct', 'taxa_retirada',
].map(col)

/** celulas["5-14|0.3-0.8"][indiceJanela] = [rodadas, somaPerda, rodadasComCompra, somaBloqueados, somaRetirada] */
const celulas = {}
for (const [l] of LOTES) for (const [p] of PROCURAS) celulas[`${l}|${p}`] = JANELAS.map(() => [0, 0, 0, 0, 0])

for (const linha of linhas.slice(1)) {
  const c = linha.split(',')
  if (Number(c[iChegada]) !== 2) throw new Error('rodadas.csv deveria ter só chegada 2 h')
  const l = faixaLote(Number(c[iLote]))
  const p = faixaProcura(Number(c[iRazao]))
  const j = JANELAS.indexOf(Number(c[iJanela]))
  if (!l || !p || j < 0) throw new Error(`linha fora das faixas: ${linha}`)
  const soma = celulas[`${l}|${p}`][j]
  soma[0] += 1
  soma[1] += Number(c[iPerda])
  // Rodada sem comprador não tem taxa de bloqueados nem de retirada ("nan"): contagem própria.
  if (c[iBloq] !== 'nan' && c[iRet] !== 'nan') {
    soma[2] += 1
    soma[3] += Number(c[iBloq])
    soma[4] += Number(c[iRet])
  }
}

const arredondar = (n) => Math.round(n * 1e6) / 1e6
const corpo = Object.entries(celulas)
  .map(([chave, js]) => `  '${chave}': [${js.map((s) => `[${s.map(arredondar).join(', ')}]`).join(', ')}],`)
  .join('\n')

writeFileSync(
  DESTINO,
  `/*
 * GERADO por scripts/resumir-rodadas.mjs a partir de simulacao/resultados_n5000/rodadas.csv
 * (${linhas.length - 1} linhas, chegada 2 h). Não editar à mão: rode \`npm run mock:projecao\`.
 *
 * RESUMO_PROJECAO["lote|procura"][i] corresponde a JANELAS_PROJECAO[i] e guarda
 * [rodadas, somaPerda, rodadasComCompra, somaBloqueados, somaRetirada] (frações de 0 a 1).
 */
export const JANELAS_PROJECAO = [${JANELAS.join(', ')}] as const

export type SomasJanela = readonly [number, number, number, number, number]

export const RESUMO_PROJECAO: Record<string, readonly SomasJanela[]> = {
${corpo}
}
`,
)
console.log(`resumo gravado em ${DESTINO}`)
