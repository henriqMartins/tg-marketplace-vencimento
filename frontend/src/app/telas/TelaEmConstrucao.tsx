import styles from './TelaEmConstrucao.module.css'

/** Marca o lugar de uma tela que ainda vai ser feita (cada uma entra na sua etapa). */
export function TelaEmConstrucao({ codigo, titulo, etapa }: { codigo: string; titulo: string; etapa: string }) {
  return (
    <section className={styles.tela}>
      <p className={styles.codigo}>{codigo}</p>
      <h1 className={styles.titulo}>{titulo}</h1>
      <p className={styles.texto}>Esta tela entra na etapa {etapa}.</p>
    </section>
  )
}
