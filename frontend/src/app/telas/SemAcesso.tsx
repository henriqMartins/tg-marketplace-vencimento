import { useNavigate } from 'react-router'
import { EstadoVazio } from '../../componentes/EstadoVazio'
import { IconeLotes } from '../../componentes/icones'
import styles from './Pagina.module.css'

export function SemAcesso({
  frase = 'Sem acesso a esta loja',
  detalhe = 'Sua conta não tem vínculo com esta loja, ou esta tela é só do responsável.',
}: { frase?: string; detalhe?: string }) {
  const navegar = useNavigate()
  return (
    <div className={styles.pagina}>
      <EstadoVazio
        icone={<IconeLotes tamanho={40} />}
        frase={frase}
        detalhe={detalhe}
        acao={{ rotulo: 'Voltar ao início', aoClicar: () => navegar('/') }}
      />
    </div>
  )
}
