import { useNavigate, useSearchParams } from 'react-router'
import { useLojaAtual } from '../../app/loja'
import { BotaoIcone } from '../../componentes/Botao'
import { IconeVoltar } from '../../componentes/icones'
import { FormLote } from './FormLote'
import styles from './Loja.module.css'

/** L3 · Cadastro do lote (celular). A L2 devolve para cá com ?produto=id. */
export function L3Lote() {
  const navegar = useNavigate()
  const { lojaId } = useLojaAtual()
  const [parametros] = useSearchParams()
  const produto = Number(parametros.get('produto')) || null
  const base = `/loja/${lojaId}`

  return (
    <FormLote
      // Trocar de produto pela URL (volta da L2) recomeça o formulário.
      key={produto ?? 'sem-produto'}
      lojaId={lojaId}
      produtoInicial={produto}
      aoNovoProduto={(busca) => navegar(`${base}/produtos/novo${busca ? `?nome=${encodeURIComponent(busca)}` : ''}`)}
      aoVerLotes={() => navegar(`${base}/lotes`)}
      cabecalho={
        <header className={styles.cabecalhoDetalhe}>
          <BotaoIcone rotulo="Voltar para lotes e fitas" onClick={() => navegar(`${base}/lotes`)}>
            <IconeVoltar />
          </BotaoIcone>
          <h1 className={styles.tituloTela}>Cadastrar lote</h1>
        </header>
      }
    />
  )
}
