import styles from './App.module.css'

// Nome do app ainda em aberto (especificação, "Ainda em aberto").
export const NOME_DO_APP = '[Nome do app]'

// Esqueleto da etapa F0: a casca com rotas e layouts entra na F3.
export default function App() {
  return (
    <main className={styles.app}>
      <h1 className={styles.titulo}>{NOME_DO_APP}</h1>
      <p className={styles.legenda}>Produtos perto do vencimento, com desconto, no seu bairro.</p>
    </main>
  )
}
