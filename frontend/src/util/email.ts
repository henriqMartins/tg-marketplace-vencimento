/** "marcos@example.com" → "m…@example.com": diz qual conta usar sem expor o e-mail inteiro. */
export function mascararEmail(email: string): string {
  const [nome, dominio] = email.split('@')
  return dominio ? `${nome.slice(0, 1)}…@${dominio}` : '…'
}
