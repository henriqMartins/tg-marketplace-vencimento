/*
 * ⚠ REGRAS FINGIDAS — SÓ DO MOCK.
 *
 * No sistema real, tudo aqui é calculado SÓ no backend (pacote `dominio/`):
 * reserva parcial, expira_em, expiração, fim da oferta, cor da fita, código único.
 * Existem aqui apenas para as telas terem o que mostrar enquanto a API não está pronta.
 * Nenhuma tela pode importar este arquivo (regra no .oxlintrc.json).
 */
import type { CorFita, Data, Dinheiro, Fita } from '../tipos'
import { fimDoDia, somarDias } from './datas'
import type { BancoMock } from './semente'

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
