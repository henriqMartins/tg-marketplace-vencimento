/*
 * ⚠ REGRAS FINGIDAS — SÓ DO MOCK.
 *
 * No sistema real, tudo aqui é calculado SÓ no backend (pacote `dominio/`):
 * reserva parcial, expira_em, expiração, fim da oferta, cor da fita, código único.
 * Existem aqui apenas para as telas terem o que mostrar enquanto a API não está pronta.
 * Nenhuma tela pode importar este arquivo (regra no .oxlintrc.json).
 */
import type { CorFita, Data, Dinheiro, EstadoReserva, Fita, Indicadores, ResultadoCadastroLote, SituacaoGrupo, Taxa } from '../tipos'
import { dataBrasilia, fimDoDia, somarDias } from './datas'
import type { BancoMock, GrupoMock, OfertaMock, ReservaMock } from './semente'

// ---------- Fita: uma cor por bimestre de vencimento, ciclo anual ----------

const FITAS: readonly [CorFita, string][] = [
  ['vermelho', 'jan–fev'],
  ['amarelo', 'mar–abr'],
  ['verde', 'mai–jun'],
  ['azul', 'jul–ago'],
  ['branco', 'set–out'],
  ['preto', 'nov–dez'],
]

export function fitaDe(validade: Data): Fita {
  const [ano, mes] = validade.split('-').map(Number)
  const [cor, bimestre] = FITAS[Math.floor((mes - 1) / 2)]
  return { cor, bimestre, ano }
}

// ---------- Oferta ----------

/** Fim da oferta: 23:59 do dia (validade − margem). */
export function fimDaOferta(validade: Data, margemDias: number): Date {
  return fimDoDia(somarDias(validade, -margemDias))
}

// ---------- Reserva ----------

/** Parcial automática: min(pedido, livre). Livre 0 → 0 (recusa). */
export function quantidadeReservada(pedido: number, livre: number): number {
  return Math.max(0, Math.min(pedido, livre))
}

/** expira_em = mín(agora + janela, fim da oferta). */
export function calcularExpiraEm(agora: Date, janelaHoras: number, fim: Date): Date {
  const limite = new Date(agora.getTime() + janelaHoras * 3600_000)
  return limite < fim ? limite : fim
}

/** 6 dígitos, único entre os códigos ativos da mesma loja. */
export function novoCodigo(ativos: ReadonlySet<string>, sortear: () => number = Math.random): string {
  for (;;) {
    const codigo = String(Math.floor(100000 + sortear() * 900000))
    if (!ativos.has(codigo)) return codigo
  }
}

/**
 * Expiração "preguiçosa", como o backend faz em toda leitura:
 * reserva vencida → expirada e devolve ao livre; oferta no fim → encerrada e a sobra vira perda.
 * Muda o estado, então rodar duas vezes não devolve em dobro.
 */
export function processarVencimentos(banco: BancoMock, agora: Date): void {
  for (const r of banco.reservas) {
    if (r.estado !== 'reservada' || r.expira_em > agora) continue
    const oferta = banco.ofertas.find((o) => o.id === r.ofertaId)
    r.estado = 'expirada'
    r.encerrada_em = r.expira_em
    if (oferta) {
      oferta.estoque.reservado -= r.quantidade
      oferta.estoque.livre += r.quantidade
    }
  }
  for (const o of banco.ofertas) {
    if (o.estado !== 'ativa' || o.fim > agora) continue
    o.estado = 'encerrada'
    o.estoque.perda += o.estoque.livre
    o.estoque.livre = 0
  }
}

// ---------- Dinheiro (em centavos, para não errar arredondamento) ----------

const centavos = (valor: Dinheiro) => Math.round(Number(valor) * 100)
const paraDinheiro = (c: number): Dinheiro => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`

export function multiplicar(valor: Dinheiro, quantidade: number): Dinheiro {
  return paraDinheiro(centavos(valor) * quantidade)
}

export function economia(precoOriginal: Dinheiro, preco: Dinheiro, quantidade: number): Dinheiro {
  return paraDinheiro((centavos(precoOriginal) - centavos(preco)) * quantidade)
}

// ---------- Indicadores do gestor (G1) ----------

/** Segunda-feira da semana de uma data (semanas de segunda a domingo). */
export function segundaDaSemana(data: Data): Data {
  const [ano, mes, dia] = data.split('-').map(Number)
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay() // 0 = domingo
  return somarDias(data, -((diaDaSemana + 6) % 7))
}

const taxa = (parte: number, total: number): Taxa => (total === 0 ? null : Math.round((parte / total) * 1000) / 1000)

/**
 * Definições de 04/11/2026 (especificação, G1):
 * - base = reservas CRIADAS no período; taxas sobre as que já encerraram;
 * - bloqueados = recusas + parciais (quantidade < pedido);
 * - perda = sobra livre das ofertas encerradas com fim no período;
 * - semanas: desfecho das encerradas, pela semana em que foram criadas.
 */
export function calcularIndicadores(banco: BancoMock, lojaId: number, de: Data, ate: Data): Indicadores {
  const noPeriodo = (d: Date) => {
    const dia = dataBrasilia(d)
    return dia >= de && dia <= ate
  }
  const daLoja = new Set(banco.ofertas.filter((o) => o.lojaId === lojaId).map((o) => o.id))
  const criadas = banco.reservas.filter((r) => daLoja.has(r.ofertaId) && noPeriodo(r.criada_em))
  const encerradas = criadas.filter((r) => r.estado !== 'reservada')
  const contar = (lista: ReservaMock[], estado: EstadoReserva) => lista.filter((r) => r.estado === estado).length
  const retiradas = contar(encerradas, 'retirada')
  const expiradas = contar(encerradas, 'expirada')
  const recusas = banco.recusas.filter((x) => daLoja.has(x.ofertaId) && noPeriodo(x.criada_em)).length
  const parciais = criadas.filter((r) => r.quantidade < r.pedido).length

  const semanas: Indicadores['semanas'] = []
  for (let inicio = segundaDaSemana(de); inicio <= ate; inicio = somarDias(inicio, 7)) {
    const fimSemana = somarDias(inicio, 6)
    const daSemana = encerradas.filter((r) => {
      const dia = dataBrasilia(r.criada_em)
      return dia >= inicio && dia <= fimSemana
    })
    semanas.push({
      inicio,
      retiradas: contar(daSemana, 'retirada'),
      expiradas: contar(daSemana, 'expirada'),
      canceladas: contar(daSemana, 'cancelada'),
    })
  }

  return {
    de,
    ate,
    reservas_criadas: criadas.length,
    encerradas: { total: encerradas.length, retiradas, expiradas, canceladas: contar(encerradas, 'cancelada') },
    taxa_retirada: taxa(retiradas, encerradas.length),
    taxa_expiracao: taxa(expiradas, encerradas.length),
    bloqueados: { total: recusas + parciais, recusas, parciais },
    perda_unidades: banco.ofertas
      .filter((o) => o.lojaId === lojaId && o.estado === 'encerrada' && noPeriodo(o.fim))
      .reduce((soma, o) => soma + o.estoque.perda, 0),
    semanas,
  }
}

// ---------- Lote, grupo de fita e aviso (backend/ofertas/fita.py, calendario.py, servico_lotes.py) ----------

/**
 * Situação que a TELA vê: a gravada + a data de hoje. "conferir" nunca é gravado:
 * aguardando vira conferir quando o dia do aviso chega; adiado, quando o dia de voltar chega.
 */
export function situacaoExibida(g: GrupoMock, oferta: OfertaMock | undefined, hoje: Data): SituacaoGrupo {
  if (g.situacao === 'em_oferta') return oferta?.estado === 'encerrada' ? 'encerrado' : 'em_oferta'
  if (g.situacao === 'encerrado') return 'encerrado'
  if (g.situacao === 'adiado') return g.adiado_ate! <= hoje ? 'conferir' : 'adiado'
  return g.aviso_em <= hoje ? 'conferir' : 'aguardando'
}

/** O aviso é o grupo em "conferir" ou "adiado". */
export const ehAviso = (s: SituacaoGrupo) => s === 'conferir' || s === 'adiado'

/** Véspera do último dia da oferta. Ex.: validade 05/11, margem 1 → último dia 04/11 → adiar até 03/11. */
export const adiarAteMax = (referencia: Data, margemDias: number) => somarDias(referencia, -margemDias - 1)

/**
 * Onde entra um lote novo. `ativos` = grupos do produto que não estão encerrados;
 * `aberto` = ainda não virou oferta (pode receber lote).
 *   1. grupo ABERTO da mesma cor e do mesmo ano → agrupado nele;
 *   2. senão, grupo ativo da mesma cor e de OUTRO ano → colisão (grupo novo, com aviso);
 *   3. senão → novo.
 */
export function classificarLote(
  validade: Data,
  ativos: { grupo: GrupoMock; aberto: boolean }[],
): { resultado: ResultadoCadastroLote; grupo: GrupoMock | null; colisao: Data | null } {
  const minha = fitaDe(validade)
  for (const { grupo, aberto } of ativos) {
    const f = fitaDe(grupo.referencia)
    if (aberto && f.cor === minha.cor && f.ano === minha.ano) return { resultado: 'agrupado', grupo, colisao: null }
  }
  for (const { grupo } of ativos) {
    const f = fitaDe(grupo.referencia)
    if (f.cor === minha.cor && f.ano !== minha.ano) return { resultado: 'colisao', grupo: null, colisao: grupo.referencia }
  }
  return { resultado: 'novo', grupo: null, colisao: null }
}

/** Valor positivo com até 2 casas ("6.99" ou 6.99), abaixo de 100 milhões; senão null. */
export function lerDinheiro(valor: unknown): Dinheiro | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null
  const texto = String(valor).trim()
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return null
  const c = centavos(texto)
  return c <= 0 || c >= 1e10 ? null : paraDinheiro(c)
}

/** preco = original × (1 − desconto/100), em centavos, meio para cima. Conta inteira, sem erro de float. */
export function precoComDesconto(original: Dinheiro, desconto: number): Dinheiro {
  return paraDinheiro(Math.floor((centavos(original) * (100 - desconto) + 50) / 100))
}
