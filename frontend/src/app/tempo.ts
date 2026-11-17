import { useEffect, useState } from 'react'

/** A hora do aparelho, atualizada a cada `intervaloMs`. Só para EXIBIR contagens. */
export function useAgora(intervaloMs = 1000): Date {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setAgora(new Date()), intervaloMs)
    return () => window.clearInterval(timer)
  }, [intervaloMs])
  return agora
}
