import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ContextoToast, DURACAO_TOAST_MS, type DadosToast } from './contexto'
import styles from './Toast.module.css'

/**
 * Mostra um toast por vez, no rodapé, por 4 s. A região "status" existe sempre
 * (mesmo vazia) para o leitor de tela anunciar a mensagem quando ela aparece.
 */
export function ProvedorToast({ children }: { children: ReactNode }) {
  const [atual, setAtual] = useState<(DadosToast & { id: number }) | null>(null)

  const mostrar = useCallback((toast: DadosToast | string) => {
    const dados = typeof toast === 'string' ? { mensagem: toast } : toast
    setAtual({ ...dados, id: Date.now() + Math.random() })
  }, [])

  useEffect(() => {
    if (!atual) return
    const timer = window.setTimeout(() => setAtual(null), DURACAO_TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [atual])

  return (
    <ContextoToast.Provider value={mostrar}>
      {children}
      <div className={styles.regiao} role="status" aria-live="polite">
        {atual && (
          <div key={atual.id} className={styles.toast}>
            <span>{atual.mensagem}</span>
            {atual.acao && (
              <button
                type="button"
                className={styles.acao}
                onClick={() => {
                  atual.acao!.aoClicar()
                  setAtual(null)
                }}
              >
                {atual.acao.rotulo}
              </button>
            )}
          </div>
        )}
      </div>
    </ContextoToast.Provider>
  )
}
