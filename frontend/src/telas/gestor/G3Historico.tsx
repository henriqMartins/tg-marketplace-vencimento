import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDeferredValue } from 'react'
import { useSearchParams } from 'react-router'
import type { EstadoHistorico } from '../../api'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { Chip } from '../../componentes/Chip'
import { Esqueleto } from '../../componentes/Esqueleto'
import { IconeBusca } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import { SeloHistorico } from '../../componentes/Selo'
import { classes } from '../../util/classes'
import { formatarData, formatarDataHoraCurta } from '../../util/formatar'
import { ControlePeriodo } from './ControlePeriodo'
import { usePeriodoDaUrl } from './periodo'
import styles from './Gestor.module.css'

const FILTROS: { estado: EstadoHistorico | null; rotulo: string }[] = [
  { estado: null, rotulo: 'Todas' },
  { estado: 'reservada', rotulo: 'Reservadas' },
  { estado: 'retirada', rotulo: 'Retiradas' },
  { estado: 'expirada', rotulo: 'Expiradas' },
  { estado: 'cancelada', rotulo: 'Canceladas' },
  { estado: 'recusa', rotulo: 'Recusas' },
]

const lerEstado = (texto: string | null): EstadoHistorico | null =>
  FILTROS.find((f) => f.estado === texto)?.estado ?? null

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/**
 * G3 · Histórico de reservas (tabelas Reserva e Recusa). Período, estado e busca ficam
 * na URL (?periodo=&estado=&q=) — a G4 abre esta tela já filtrada pelo produto.
 */
export function G3Historico() {
  const api = useApi()
  const { lojaId } = useLojaAtual()
  const { periodo, de, ate, trocar } = usePeriodoDaUrl()
  const [parametros, setParametros] = useSearchParams()
  const estado = lerEstado(parametros.get('estado'))
  const busca = parametros.get('q') ?? ''
  const buscaAdiada = useDeferredValue(busca.trim()) // digita sem esperar cada resposta

  const historico = useQuery({
    queryKey: ['historico', lojaId, de, ate, estado, buscaAdiada],
    queryFn: () => api.gestor.historico(lojaId, { de, ate, estado: estado ?? undefined, q: buscaAdiada || undefined }),
    placeholderData: keepPreviousData, // a tabela não pisca a cada letra
  })

  function mudarParametro(chave: 'estado' | 'q', valor: string | null) {
    setParametros(
      (atual) => {
        const proximos = new URLSearchParams(atual)
        if (valor) proximos.set(chave, valor)
        else proximos.delete(chave)
        return proximos
      },
      { replace: true },
    )
  }

  const h = historico.data
  return (
    <div className={styles.tela}>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Reservas</h1>
          <p className={styles.subtitulo}>
            {formatarData(de)} a {formatarData(ate)}
            {h && ` · ${plural(h.total_reservas, 'reserva', 'reservas')} · ${plural(h.total_recusas, 'recusa', 'recusas')}`}
          </p>
        </div>
        <ControlePeriodo periodo={periodo} aoTrocar={trocar} />
      </header>

      <div className={styles.filtros}>
        <label className={styles.busca}>
          <IconeBusca tamanho={18} />
          <input
            type="search"
            aria-label="Buscar por produto ou código"
            placeholder="Produto ou final do código"
            value={busca}
            onChange={(e) => mudarParametro('q', e.target.value)}
          />
        </label>
        <div role="group" aria-label="Filtrar por estado" className={styles.chips}>
          {FILTROS.map((f) => (
            <Chip key={f.rotulo} ativo={f.estado === estado} onClick={() => mudarParametro('estado', f.estado)}>
              {f.rotulo}
            </Chip>
          ))}
        </div>
      </div>

      <section className={styles.cartaoSecao} aria-label="Histórico de reservas">
        {historico.isError ? (
          <MensagemErro erro={historico.error} />
        ) : !h ? (
          <Esqueleto altura={240} />
        ) : h.itens.length === 0 ? (
          <p className={styles.vazio}>Nada encontrado com esses filtros.</p>
        ) : (
          <div className={styles.rolagem}>
            <table className={classes(styles.tabela, historico.isPlaceholderData && styles.atualizando)}>
              <thead>
                <tr>
                  <th scope="col">Criada em</th>
                  <th scope="col">Código</th>
                  <th scope="col">Produto</th>
                  <th scope="col" className={styles.numero}>
                    Reservado / pedido
                  </th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Encerrada em</th>
                </tr>
              </thead>
              <tbody>
                {h.itens.map((item, indice) => (
                  // Recusa não tem id nem código: a posição + o momento identificam a linha.
                  <tr key={`${item.tipo}-${item.criada_em}-${indice}`}>
                    <td className={styles.data}>{formatarDataHoraCurta(item.criada_em)}</td>
                    <td className={styles.codigo}>{item.codigo_final ? `••• ${item.codigo_final}` : '—'}</td>
                    <td>{item.produto}</td>
                    <td className={classes(styles.numero, item.quantidade < item.pedido && styles.parcial)}>
                      {item.quantidade} / {item.pedido}
                    </td>
                    <td>{item.cliente}</td>
                    <td>
                      <SeloHistorico estado={item.estado} />
                    </td>
                    <td className={styles.data}>{item.encerrada_em ? formatarDataHoraCurta(item.encerrada_em) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.nota}>
        Recusa = tentativa de reservar com estoque livre zero. Compradores bloqueados = recusas + reservas parciais
        (reservado menor que o pedido, como "2 / 3").
      </p>
    </div>
  )
}
