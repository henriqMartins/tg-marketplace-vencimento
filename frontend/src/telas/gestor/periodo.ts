import { useSearchParams } from 'react-router'
import { useAgora } from '../../app/tempo'
import { intervaloDo, lerPeriodo, PERIODO_PADRAO, type Periodo } from '../../util/periodo'

/**
 * Período do gestor guardado na URL (?periodo=7d|30d), para sobreviver à recarga e ao
 * "voltar". Mês atual é o padrão e não aparece na URL.
 */
export function usePeriodoDaUrl() {
  const [parametros, setParametros] = useSearchParams()
  const periodo = lerPeriodo(parametros.get('periodo'))
  const agora = useAgora(60_000) // vira o dia → o intervalo acompanha
  const { de, ate } = intervaloDo(periodo, agora)

  function trocar(novo: Periodo) {
    setParametros(
      (atual) => {
        const proximos = new URLSearchParams(atual)
        if (novo === PERIODO_PADRAO) proximos.delete('periodo')
        else proximos.set('periodo', novo)
        return proximos
      },
      { replace: true },
    )
  }

  return { periodo, de, ate, trocar }
}
