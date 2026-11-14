import { useEffect } from 'react'
import { useToast } from '../componentes/toast/contexto'
import { useVersaoNova } from './servico'

/** Versão nova do app baixada: avisa com o toast e só recarrega quando a pessoa tocar em "Atualizar". */
export function AvisoVersaoNova() {
  const mostrarToast = useToast()
  const atualizar = useVersaoNova()
  useEffect(() => {
    if (atualizar) mostrarToast({ mensagem: 'Nova versão disponível.', acao: { rotulo: 'Atualizar', aoClicar: () => void atualizar() } })
  }, [atualizar, mostrarToast])
  return null
}
