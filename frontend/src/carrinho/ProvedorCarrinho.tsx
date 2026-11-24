import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useSessao } from '../app/contextos'
import { alterar, CHAVE_VISITANTE, chaveDaConta, colocar, juntar, lerTexto, tirar, type ItemCarrinho } from './carrinho'
import { ContextoCarrinho, type Carrinho } from './contexto'

// ---------- O localStorage como "loja" observável (useSyncExternalStore) ----------

const ouvintes = new Set<() => void>()

function assinar(aoMudar: () => void) {
  ouvintes.add(aoMudar)
  // Outra aba mexeu no carrinho: atualiza esta também.
  const aoGuardar = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith('tg.carrinho.')) aoMudar()
  }
  window.addEventListener('storage', aoGuardar)
  return () => {
    ouvintes.delete(aoMudar)
    window.removeEventListener('storage', aoGuardar)
  }
}

function lerGuardado(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave)
  } catch {
    return null // armazenamento bloqueado: carrinho vazio
  }
}

function gravar(chave: string, itens: ItemCarrinho[]) {
  try {
    if (itens.length) window.localStorage.setItem(chave, JSON.stringify(itens))
    else window.localStorage.removeItem(chave)
  } catch {
    /* bloqueado: segue sem guardar */
  }
  ouvintes.forEach((f) => f())
}

/**
 * Carrinho da conta logada (ou do visitante). Enquanto o "eu" carrega, a chave é null:
 * a tela mostra vazio em vez de arriscar o carrinho de outra pessoa.
 */
export function ProvedorCarrinho({ children }: { children: ReactNode }) {
  const { token, eu } = useSessao()
  const usuarioId = token !== null ? eu?.id : undefined
  const chave = token === null ? CHAVE_VISITANTE : usuarioId !== undefined ? chaveDaConta(usuarioId) : null

  // O texto (não a lista) é o "retrato": texto igual = mesma lista, sem renderizar à toa.
  const texto = useSyncExternalStore(assinar, () => (chave ? lerGuardado(chave) : null))
  const itens = useMemo(() => lerTexto(texto), [texto])

  // Entrou na conta com itens montados como visitante: passam para a conta.
  useEffect(() => {
    if (usuarioId === undefined) return
    const doVisitante = lerTexto(lerGuardado(CHAVE_VISITANTE))
    if (!doVisitante.length) return
    const daConta = chaveDaConta(usuarioId)
    gravar(daConta, juntar(lerTexto(lerGuardado(daConta)), doVisitante))
    gravar(CHAVE_VISITANTE, [])
  }, [usuarioId])

  const carrinho = useMemo<Carrinho>(() => {
    // Lê de novo antes de gravar: outra aba pode ter mudado desde o último retrato.
    const mudar = (f: (lista: ItemCarrinho[]) => ItemCarrinho[]) => {
      if (chave) gravar(chave, f(lerTexto(lerGuardado(chave))))
    }
    return {
      itens,
      itemDa: (ofertaId) => itens.find((i) => i.ofertaId === ofertaId),
      colocar: (item) => mudar((l) => colocar(l, item)),
      alterar: (ofertaId, pedido) => mudar((l) => alterar(l, ofertaId, pedido)),
      tirar: (...ofertaIds) => mudar((l) => tirar(l, ofertaIds)),
    }
  }, [itens, chave])

  return <ContextoCarrinho.Provider value={carrinho}>{children}</ContextoCarrinho.Provider>
}
