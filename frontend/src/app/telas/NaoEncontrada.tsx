import { useNavigate } from 'react-router'
import { EstadoVazio } from '../../componentes/EstadoVazio'
import { IconeSacola } from '../../componentes/icones'
import styles from './Pagina.module.css'

export function NaoEncontrada() {
  const navegar = useNavigate()
  return (
    <div className={styles.pagina}>
      <EstadoVazio
        icone={<IconeSacola />}
        frase="Página não encontrada"
        detalhe="O endereço pode ter mudado ou estar incompleto."
        acao={{ rotulo: 'Ir para a vitrine', aoClicar: () => navegar('/vitrine') }}
      />
    </div>
  )
}
