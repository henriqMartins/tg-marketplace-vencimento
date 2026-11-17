/** Junta nomes de classe, ignorando os falsos: classes('a', cond && 'b') → "a b". */
export function classes(...nomes: (string | false | null | undefined)[]): string {
  return nomes.filter(Boolean).join(' ')
}
