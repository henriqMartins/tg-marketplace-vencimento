import type { Estoque } from '../api'
import styles from './Estoque.module.css'

const PARTES = [
  { chave: 'retirado', rotulo: 'Retirado', classe: styles.retirado },
  { chave: 'reservado', rotulo: 'Reservado', classe: styles.reservado },
  { chave: 'livre', rotulo: 'Livre', classe: styles.livre },
  { chave: 'perdaAjuste', rotulo: 'Perda / ajuste', classe: styles.perda },
] as const

/** Barra empilhada (L9). Decorativa: o resumo em texto ao lado diz os mesmos números. */
export function BarraEstoque({ estoque }: { estoque: Estoque }) {
  const valores = {
    retirado: estoque.retirado,
    reservado: estoque.reservado,
    livre: estoque.livre,
    perdaAjuste: estoque.perda + estoque.ajustado,
  }
  return (
    <span className={styles.barra} aria-hidden="true">
      {PARTES.map((p) =>
        valores[p.chave] > 0 ? (
          <span key={p.chave} className={p.classe} style={{ flexGrow: valores[p.chave] }} />
        ) : null,
      )}
    </span>
  )
}

export function LegendaEstoque() {
  return (
    <ul className={styles.legenda} aria-label="Legenda da barra de estoque">
      {PARTES.map((p) => (
        <li key={p.chave}>
          <span className={`${styles.ponto} ${p.classe}`} aria-hidden="true" />
          {p.rotulo}
        </li>
      ))}
    </ul>
  )
}

/** As 5 caixas da L10 + a fórmula da conservação, com os números que vieram da API. */
export function CaixasEstoque({ estoque: e }: { estoque: Estoque }) {
  const caixas = [
    { rotulo: 'Livre', valor: e.livre, classe: styles.livre },
    { rotulo: 'Reservado', valor: e.reservado, classe: styles.reservado },
    { rotulo: 'Retirado', valor: e.retirado, classe: styles.retirado },
    { rotulo: 'Ajustado', valor: e.ajustado, classe: styles.perda },
    { rotulo: 'Perda', valor: e.perda, classe: styles.perda },
  ]
  return (
    <div className={styles.caixasEstoque}>
      <p className={styles.separado}>
        Unidades separadas: <strong>{e.separado}</strong>
      </p>
      <dl className={styles.caixas}>
        {caixas.map((c) => (
          <div key={c.rotulo} className={styles.caixa}>
            <span className={`${styles.faixaCor} ${c.classe}`} aria-hidden="true" />
            <dt>{c.rotulo}</dt>
            <dd>{c.valor}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.formula}>
        Separado = livre + reservado + retirado + ajustado + perda
        <br />
        <span className={styles.numeros}>
          {e.separado} = {e.livre} + {e.reservado} + {e.retirado} + {e.ajustado} + {e.perda}
        </span>
      </p>
    </div>
  )
}
