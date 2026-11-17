import type { Indicadores } from '../../api'
import { formatarDataCurta } from '../../util/formatar'
import styles from './Gestor.module.css'

type Semana = Indicadores['semanas'][number]

/** Ordem de baixo para cima na pilha; cores da especificação (G1). */
const SERIES = [
  { chave: 'retiradas', rotulo: 'Retiradas', classe: styles.serieRetiradas },
  { chave: 'expiradas', rotulo: 'Expiradas', classe: styles.serieExpiradas },
  { chave: 'canceladas', rotulo: 'Canceladas', classe: styles.serieCanceladas },
] as const

const ALTURA_PX = 180

const descrever = (s: Semana) =>
  `Semana de ${formatarDataCurta(s.inicio)}: ${s.retiradas} retiradas, ${s.expiradas} expiradas, ${s.canceladas} canceladas`

/**
 * Barras empilhadas por semana, sem biblioteca (decisão 3a). A ALTURA é só desenho
 * (valor ÷ maior total); os números exibidos são os que a API mandou.
 * Acessível sem a cor: legenda, total sobre cada barra, dica no foco e tabela equivalente.
 */
export function GraficoSemanas({ semanas }: { semanas: Semana[] }) {
  const total = (s: Semana) => s.retiradas + s.expiradas + s.canceladas
  const maior = Math.max(1, ...semanas.map(total))

  return (
    <section className={styles.cartaoSecao} aria-labelledby="titulo-grafico">
      <div className={styles.cabecalhoSecao}>
        <h2 id="titulo-grafico" className={styles.tituloSecao}>
          Desfecho das reservas por semana
        </h2>
        <ul className={styles.legenda} aria-label="Legenda">
          {SERIES.map((serie) => (
            <li key={serie.chave}>
              <span className={`${styles.amostra} ${serie.classe}`} aria-hidden="true" />
              {serie.rotulo}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.areaGrafico} style={{ gridTemplateColumns: `repeat(${semanas.length}, minmax(0, 1fr))` }}>
        {semanas.map((s) => (
          // Foco pelo teclado mostra a mesma dica do mouse.
          <div key={s.inicio} className={styles.coluna} tabIndex={0} role="img" aria-label={descrever(s)}>
            <span className={styles.totalColuna} aria-hidden="true">
              {total(s)}
            </span>
            <div className={styles.pilha} style={{ height: ALTURA_PX }} aria-hidden="true">
              {/* De cima para baixo: o primeiro filho recebe o canto arredondado. */}
              {[...SERIES].reverse().map((serie) =>
                s[serie.chave] > 0 ? (
                  <div
                    key={serie.chave}
                    className={`${styles.fatia} ${serie.classe}`}
                    style={{ height: Math.max(2, Math.round((s[serie.chave] / maior) * ALTURA_PX)) }}
                  />
                ) : null,
              )}
            </div>
            <div className={styles.dica} aria-hidden="true">
              <strong>Semana de {formatarDataCurta(s.inicio)}</strong>
              {SERIES.map((serie) => (
                <span key={serie.chave}>
                  {serie.rotulo}: {s[serie.chave]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.eixo} style={{ gridTemplateColumns: `repeat(${semanas.length}, minmax(0, 1fr))` }} aria-hidden="true">
        {semanas.map((s) => (
          <span key={s.inicio}>sem. {formatarDataCurta(s.inicio)}</span>
        ))}
      </div>

      <details className={styles.verTabela}>
        <summary>Ver como tabela</summary>
        <table className={styles.tabela}>
          <caption className="so-leitor">Desfecho das reservas por semana</caption>
          <thead>
            <tr>
              <th scope="col">Semana de</th>
              {SERIES.map((serie) => (
                <th key={serie.chave} scope="col" className={styles.numero}>
                  {serie.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanas.map((s) => (
              <tr key={s.inicio}>
                <th scope="row">{formatarDataCurta(s.inicio)}</th>
                {SERIES.map((serie) => (
                  <td key={serie.chave} className={styles.numero}>
                    {s[serie.chave]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
