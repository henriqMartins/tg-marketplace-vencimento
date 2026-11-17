import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { BotaoIcone } from '../../componentes/Botao'
import { IconeVoltar } from '../../componentes/icones'
import { FormAjuste } from './FormAjuste'
import styles from './Loja.module.css'

/** L11 · Ajuste de estoque (celular). O formulário é o mesmo do modal da G4. */
export function L11Ajuste() {
  const api = useApi()
  const navegar = useNavigate()
  const { lojaId } = useLojaAtual()
  const id = Number(useParams().ofertaId)
  // Mesma chave do formulário: só lê o nome do produto do cache.
  const oferta = useQuery({ queryKey: ['loja-oferta', lojaId, id], queryFn: () => api.operacao.obterOferta(lojaId, id) })
  const voltar = () => navegar(`/loja/${lojaId}/ofertas/${id}`)

  const cabecalho = (
    <header className={styles.cabecalhoDetalhe}>
      <BotaoIcone rotulo="Voltar para a oferta" onClick={voltar}>
        <IconeVoltar />
      </BotaoIcone>
      <div className={styles.textosCabecalho}>
        <h1 className={styles.tituloTela}>Ajustar estoque</h1>
        {oferta.data && <span className={styles.texto}>{oferta.data.produto.nome}</span>}
      </div>
    </header>
  )

  return <FormAjuste lojaId={lojaId} ofertaId={id} aoConcluir={voltar} cabecalho={cabecalho} />
}
