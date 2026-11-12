import { Botao } from '../../componentes/Botao'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { Mensagem } from '../../componentes/Mensagem'
import styles from './Consumidor.module.css'

/**
 * C1, tela 2: avisos de oferta nova (Web Push). SÓ DESENHADO (briefing): o push é implementado
 * depois de 09/11/2026 (grupo H do contrato). Nada pede permissão ao navegador.
 */
export function FolhaAvisos({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  return (
    <FolhaInferior aberta={aberta} titulo="Quer saber das ofertas novas?" aoFechar={aoFechar}>
      <p className={styles.texto}>
        Avisamos só quando uma loja publicar uma oferta. Nada de lembrete de reserva nem propaganda.
      </p>
      <Mensagem tipo="info">No iPhone, antes adicione o app à Tela de Início.</Mensagem>
      <Botao disabled>Ativar avisos · em breve</Botao>
      <Botao variante="secundario" onClick={aoFechar}>
        Agora não
      </Botao>
    </FolhaInferior>
  )
}
