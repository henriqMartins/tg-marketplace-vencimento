/*
 * Onde o token da sessão fica guardado no aparelho.
 *   lembrar = true  → localStorage (continua conectado ao reabrir; padrão no celular)
 *   lembrar = false → sessionStorage (sai ao fechar a aba; "Manter conectado" desmarcado na A5)
 * Fora do React de propósito: o tratamento global de 401 (consultas.ts) limpa a sessão daqui.
 */

type Guarda = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const CHAVE = 'tg.token'

export interface ArmazemSessao {
  obterToken(): string | null
  definir(token: string, lembrar: boolean): void
  limpar(): void
  /** Para o React acompanhar (useSyncExternalStore). Devolve a função de cancelar. */
  assinar(ouvinte: () => void): () => void
}

function acessar(obter: () => Guarda): Guarda | null {
  try {
    return obter() // pode lançar com armazenamento bloqueado (aba anônima, configurações)
  } catch {
    return null
  }
}

export function criarArmazemSessao(
  local: Guarda | null = acessar(() => window.localStorage),
  sessao: Guarda | null = acessar(() => window.sessionStorage),
): ArmazemSessao {
  const ouvintes = new Set<() => void>()
  let emMemoria: string | null = null // reserva, se o navegador não deixar gravar

  const ler = (guarda: Guarda | null) => {
    try {
      return guarda?.getItem(CHAVE) ?? null
    } catch {
      return null
    }
  }
  const apagarTudo = () => {
    for (const guarda of [local, sessao]) {
      try {
        guarda?.removeItem(CHAVE)
      } catch {
        /* nada a fazer */
      }
    }
    emMemoria = null
  }
  const avisar = () => ouvintes.forEach((ouvinte) => ouvinte())

  return {
    obterToken: () => ler(sessao) ?? ler(local) ?? emMemoria,
    definir(token, lembrar) {
      apagarTudo()
      const alvo = lembrar ? local : sessao
      try {
        alvo?.setItem(CHAVE, token)
      } catch {
        /* cai na memória abaixo */
      }
      if (ler(alvo) !== token) emMemoria = token
      avisar()
    },
    limpar() {
      apagarTudo()
      avisar()
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },
  }
}
