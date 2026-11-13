import type { QueryClient } from '@tanstack/react-query'

/** Mesma chave na L6 e na L7: a L7 abre na hora com o que a L6 já buscou. */
export const chaveAviso = (lojaId: number, avisoId: number) => ['aviso', lojaId, avisoId] as const

/** Depois de adiar, descartar ou publicar, as listas que mostram o grupo mudam. */
export function invalidarAvisos(consultas: QueryClient, lojaId: number) {
  for (const chave of ['avisos', 'aviso', 'grupos', 'resumo']) void consultas.invalidateQueries({ queryKey: [chave, lojaId] })
}
