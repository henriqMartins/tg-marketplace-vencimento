/*
 * Endereço → localização, com confirmação (L14/G6 e P3). Extraído da L14 em 18/11/2026.
 * Uma busca por ação da pessoa (política de uso do Nominatim: nada de autocompletar);
 * depois, ela confirma onde o mapa achou ou segue sem localização.
 */
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocal } from './contexto'
import type { LocalDoEndereco } from './endereco'

export type ConfirmacaoLocal = { tipo: 'encontrado'; local: LocalDoEndereco } | { tipo: 'nao_encontrado' }

export function useBuscaNoMapa() {
  const { geocodificarEndereco } = useLocal()
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoLocal | null>(null)
  const busca = useMutation({
    mutationFn: (endereco: string) => geocodificarEndereco(endereco),
    onSuccess: (local) => setConfirmacao(local ? { tipo: 'encontrado', local } : { tipo: 'nao_encontrado' }),
  })

  return {
    /** Busca o endereço no mapa (uma chamada por clique). */
    buscar: (endereco: string) => busca.mutate(endereco.trim()),
    /** null enquanto não buscou (ou depois de limpar). */
    confirmacao,
    buscando: busca.isPending,
    /** Falha do serviço (ErroEndereco: sem rede etc.). */
    erro: busca.isError ? busca.error : null,
    /** Endereço mudou ou a pessoa quer corrigir: esquece a busca anterior. */
    limpar: () => {
      busca.reset()
      setConfirmacao(null)
    },
    /** latitude/longitude para mandar à API (null quando não achou). */
    coordenadas: (c: ConfirmacaoLocal) =>
      c.tipo === 'encontrado'
        ? { latitude: c.local.latitude, longitude: c.local.longitude }
        : { latitude: null, longitude: null },
  }
}
