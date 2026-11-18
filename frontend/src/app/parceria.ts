/* Regras de exibição da parceria (docs/parceria.md) usadas por mais de uma tela. */
import type { Eu } from '../api'
import { formatarDataCurta } from '../util/formatar'

/** Interesse em aberto = a equipe ainda vai responder (novo ou em conversa). */
export function interesseEmAberto(eu: Eu): boolean {
  return eu.interesse?.estado === 'novo' || eu.interesse?.estado === 'em_conversa'
}

/** O link do convite é montado no front (contrato, grupo I): `${origem do app}/convite/${codigo}`. */
export function linkDoConvite(codigo: string, origem = window.location.origin): string {
  return `${origem}/convite/${encodeURIComponent(codigo)}`
}

/** "marcos@example.com" → "m…@example.com": diz qual conta usar sem expor o e-mail inteiro. */
export function mascararEmail(email: string): string {
  const [nome, dominio] = email.split('@')
  return dominio ? `${nome.slice(0, 1)}…@${dominio}` : '…'
}

/** Mensagem pronta para o WhatsApp (docs/parceria.md, P3). */
export function mensagemDoConvite({ nomeLoja, link, expiraEm, email }: { nomeLoja: string; link: string; expiraEm: string; email: string }): string {
  return (
    `Olá! Sua loja ${nomeLoja} está pronta na plataforma. ` +
    `Para ativar, abra: ${link} (vale até ${formatarDataCurta(expiraEm)}). ` +
    `Entre ou crie a conta com ${email}.`
  )
}
