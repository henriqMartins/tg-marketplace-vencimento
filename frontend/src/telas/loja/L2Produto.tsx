import { useNavigate, useSearchParams } from 'react-router'
import { useLojaAtual } from '../../app/loja'
import { BotaoIcone } from '../../componentes/Botao'
import { IconeVoltar } from '../../componentes/icones'
import { FormProduto } from './FormProduto'
import styles from './Loja.module.css'

/** L2 · Novo produto (celular). Salvar volta para a L3 com o produto já escolhido. */
export function L2Produto() {
  const navegar = useNavigate()
  const { lojaId } = useLojaAtual()
  const [parametros] = useSearchParams()
  const voltar = `/loja/${lojaId}/lotes/novo`

  return (
    <FormProduto
      lojaId={lojaId}
      nomeInicial={parametros.get('nome') ?? ''}
      aoSalvar={(p) => navegar(`${voltar}?produto=${p.id}`, { replace: true })}
      cabecalho={
        <header className={styles.cabecalhoDetalhe}>
          <BotaoIcone rotulo="Voltar para o cadastro do lote" onClick={() => navegar(voltar)}>
            <IconeVoltar />
          </BotaoIcone>
          <h1 className={styles.tituloTela}>Novo produto</h1>
        </header>
      }
    />
  )
}
