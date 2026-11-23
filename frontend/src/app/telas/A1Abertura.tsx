import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { useApi, useSessao } from '../contextos'
import { destinoAposEntrar } from '../destino'
import { lerEscolha } from '../escolha'
import { LIMITE_SERVIDOR_MS, useLimiteEspera } from '../espera'
import { NOME_DO_APP, SLOGAN } from '../marca'
import { useEhDesktop } from '../tela'
import styles from './A1Abertura.module.css'

/**
 * A1 · Abertura: espera o servidor acordar (GET /health) e decide o destino.
 *   sem token            → A2 (/entrar)
 *   com token            → destinoAposEntrar (escolha lembrada, A4, loja ou vitrine)
 *   90 s sem resposta    → "O servidor não respondeu. Tentar de novo"
 */
export function A1Abertura() {
  const api = useApi()
  const { token, eu, erroEu, recarregarEu } = useSessao()
  // O TanStack não aceita consulta que devolve undefined: devolve true quando o servidor responde.
  const saude = useQuery({
    queryKey: ['saude'],
    queryFn: async () => {
      await api.servidor.saude()
      return true
    },
  })
  const [reinicio, setReinicio] = useState(0)
  const desktop = useEhDesktop()

  const esperando = saude.isPending || (token !== null && !eu && !erroEu)
  const passouDoLimite = useLimiteEspera(esperando, LIMITE_SERVIDOR_MS, reinicio)
  const falhou = passouDoLimite || saude.isError || (token !== null && !!erroEu)

  if (saude.isSuccess && !token) return <Navigate to="/entrar" replace />
  if (saude.isSuccess && eu) {
    return <Navigate to={destinoAposEntrar(eu, { desktop, escolhaLembrada: lerEscolha(eu.id) })} replace />
  }

  function tentarDeNovo() {
    setReinicio((n) => n + 1)
    void saude.refetch()
    if (token) recarregarEu()
  }

  return (
    <div className={styles.abertura}>
      <div className={styles.centro}>
        <img className={styles.selo} src="/icons/abertura-selo.svg" alt="" width={104} height={104} />
        <h1 className={styles.nome}>{NOME_DO_APP}</h1>
        <p className={styles.slogan}>{SLOGAN}</p>
      </div>

      <div className={styles.rodape}>
        {falhou ? (
          <div className={styles.faixa} role="alert">
            <p className={styles.textos}>
              <strong>O servidor não respondeu.</strong>
              <span>Confira a internet e tente de novo.</span>
            </p>
            <button type="button" className={styles.tentar} onClick={tentarDeNovo}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <div className={styles.faixa} role="status">
            <span className={styles.giro} aria-hidden="true" />
            <p className={styles.textos}>
              <strong>Conectando ao servidor…</strong>
              <span>Na primeira abertura do dia pode levar até 1 minuto</span>
            </p>
          </div>
        )}
        <Link to="/entrar" className={styles.pular}>
          Pular para o login
        </Link>
      </div>
    </div>
  )
}
