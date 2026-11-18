/*
 * Para onde a pessoa vai depois de entrar (e na abertura, A1). Uma regra só, em um lugar só.
 */
import type { Eu, Papel } from '../api'
import type { EscolhaLembrada } from './escolha'

export interface OpcoesDestino {
  /** De onde veio (?voltar=…), se foi barrada numa tela protegida. */
  voltar?: string | null
  /** Tela ≥ 1024 px (o responsável abre a loja no painel). */
  desktop: boolean
  escolhaLembrada?: EscolhaLembrada | null
}

/**
 * Só aceita caminho DENTRO do app: começa com "/" e não com "//" nem "/\".
 * Sem isso, "?voltar=//site-falso.com" mandaria a pessoa, logada, para fora (open redirect).
 */
export function caminhoInternoSeguro(caminho: string | null | undefined): string | null {
  if (!caminho || !caminho.startsWith('/') || caminho.startsWith('//') || caminho.startsWith('/\\')) return null
  return caminho
}

/** Página inicial de uma loja: no computador o responsável abre no painel (A5 → G1); o resto na L1. */
export function inicioDaLoja(lojaId: number, papel: Papel, desktop: boolean): string {
  return desktop && papel === 'responsavel' ? `/loja/${lojaId}/painel` : `/loja/${lojaId}`
}

/**
 * Depois de entrar, sempre a A4 (decidido 18/11/2026, docs/parceria.md): inclusive sem vínculo
 * e no computador. Só pula com ?voltar= ou com a escolha lembrada neste aparelho.
 */
export function destinoAposEntrar(eu: Eu, { voltar, desktop, escolhaLembrada }: OpcoesDestino): string {
  // 1. Voltar para onde estava.
  const seguro = caminhoInternoSeguro(voltar)
  if (seguro) return seguro

  // 2. Escolha lembrada neste aparelho (se ainda vale).
  if (escolhaLembrada?.tipo === 'comprar') return '/vitrine'
  if (escolhaLembrada?.tipo === 'plataforma' && eu.plataforma) return '/plataforma'
  if (escolhaLembrada?.tipo === 'loja') {
    const vinculo = eu.vinculos.find((v) => v.loja.id === escolhaLembrada.lojaId)
    if (vinculo) return inicioDaLoja(vinculo.loja.id, vinculo.papel, desktop)
  }

  // 3. Escolher como entrar (A4).
  return '/escolher'
}
