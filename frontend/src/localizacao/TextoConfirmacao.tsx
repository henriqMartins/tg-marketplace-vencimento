import type { ConfirmacaoLocal } from './useBuscaNoMapa'
import styles from './BuscaNoMapa.module.css'

/** "Localização encontrada: …. É aqui?" ou "Não encontramos…", com o crédito do OpenStreetMap (ODbL). */
export function TextoConfirmacao({ confirmacao }: { confirmacao: ConfirmacaoLocal }) {
  return (
    <>
      {confirmacao.tipo === 'encontrado' ? (
        <span>
          <strong>Localização encontrada:</strong> {confirmacao.local.descricao}. É aqui?
        </span>
      ) : (
        <span>
          <strong>Não encontramos esse endereço no mapa.</strong> Sem localização, a loja aparece no fim da lista ordenada
          por distância.
        </span>
      )}
      <small className={styles.credito}>Mapa: © colaboradores do OpenStreetMap</small>
    </>
  )
}
