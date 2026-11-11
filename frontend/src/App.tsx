import styles from './App.module.css'
import { ProvedorToast } from './componentes/toast/ProvedorToast'
import { Galeria } from './galeria/Galeria'

// Nome do app ainda em aberto (especificação, "Ainda em aberto").
export const NOME_DO_APP = '[Nome do app]'

// Até a F3 (casca com rotas), o App mostra a galeria de componentes.
export default function App() {
  return (
    <ProvedorToast>
      <main className={styles.app}>
        <h1 className={styles.titulo}>{NOME_DO_APP}</h1>
        <p className={styles.legenda}>Produtos perto do vencimento, com desconto, no seu bairro.</p>
        <Galeria />
      </main>
    </ProvedorToast>
  )
}
