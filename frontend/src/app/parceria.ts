/* Regras de exibição da parceria (docs/parceria.md) usadas por mais de uma tela. */
import type { Eu } from '../api'

/** Interesse em aberto = a equipe ainda vai responder (novo ou em conversa). */
export function interesseEmAberto(eu: Eu): boolean {
  return eu.interesse?.estado === 'novo' || eu.interesse?.estado === 'em_conversa'
}

/** O link do convite é montado no front (contrato, grupo I): `${origem do app}/convite/${codigo}`. */
export function linkDoConvite(codigo: string, origem = window.location.origin): string {
  return `${origem}/convite/${encodeURIComponent(codigo)}`
}
