import { onlineManager } from '@tanstack/react-query'
import { useEffect, useState, useSyncExternalStore } from 'react'

/** A faixa "Conectando…" só aparece se a resposta demorar mais que isto (decidido 11/11/2026). */
export const ATRASO_FAIXA_MS = 2_000

/** Depois disto sem resposta: "O servidor não respondeu. Tentar de novo" (especificação, A1). */
export const LIMITE_SERVIDOR_MS = 90_000

/**
 * true quando `ativo` ficou ligado sem parar por `limiteMs`.
 * Mudar `reinicio` zera a contagem (botão "Tentar de novo").
 */
export function useLimiteEspera(ativo: boolean, limiteMs: number, reinicio = 0): boolean {
  // Cada vez que `ativo` liga começa um "período" novo (padrão do React para guardar
  // o valor anterior durante o render, sem efeito extra).
  const [anterior, setAnterior] = useState(ativo)
  const [periodo, setPeriodo] = useState(0)
  if (ativo !== anterior) {
    setAnterior(ativo)
    if (ativo) setPeriodo((p) => p + 1)
  }

  const chave = `${periodo}:${reinicio}`
  const [estouradoEm, setEstouradoEm] = useState<string | null>(null)

  useEffect(() => {
    if (!ativo) return
    const timer = window.setTimeout(() => setEstouradoEm(chave), limiteMs)
    return () => window.clearTimeout(timer)
  }, [ativo, limiteMs, chave])

  return ativo && estouradoEm === chave
}

/** O navegador está com internet? (o TanStack pausa as consultas quando não está) */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (avisar) => onlineManager.subscribe(avisar),
    () => onlineManager.isOnline(),
  )
}
