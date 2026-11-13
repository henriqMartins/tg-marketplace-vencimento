import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import type { Aviso } from '../../api'
import { RECARGA_30S } from '../../app/consultas'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { useAgora } from '../../app/tempo'
import { AmostraFita } from '../../componentes/AmostraFita'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { EstadoVazio } from '../../componentes/EstadoVazio'
import { IconeAvisos } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import { classes } from '../../util/classes'
import { formatarDataCurta } from '../../util/formatar'
import { hojeEmBrasilia, somarDias } from '../../util/periodo'
import styles from './Lotes.module.css'

/** L5 · Avisos de validade (Figura 3): grupos em "conferir" ou "adiado", o que vence antes primeiro. */
export function L5Avisos() {
  const api = useApi()
  const navegar = useNavigate()
  const { lojaId } = useLojaAtual()
  const lista = useQuery({ queryKey: ['avisos', lojaId], queryFn: () => api.lotes.listarAvisos(lojaId), ...RECARGA_30S })

  if (lista.isPending) return <EsqueletoLista quantidade={4} rotulo="Carregando avisos…" />
  if (lista.isError) return <MensagemErro erro={lista.error} />

  const { avisos, antecedencia_dias: antecedencia } = lista.data
  return (
    <div className={styles.tela}>
      <header>
        <h1 className={styles.titulo}>Avisos</h1>
        <p className={styles.ajuda}>
          {avisos.length} {avisos.length === 1 ? 'aviso' : 'avisos'} · antecedência da loja: {antecedencia}{' '}
          {antecedencia === 1 ? 'dia' : 'dias'}
        </p>
      </header>
      {avisos.length === 0 ? (
        <EstadoVazio
          icone={<IconeAvisos tamanho={40} />}
          frase="Nenhum aviso agora"
          detalhe="Você será avisado conforme a antecedência configurada."
          acao={{ rotulo: 'Ver lotes e fitas', aoClicar: () => navegar(`/loja/${lojaId}/lotes`) }}
        />
      ) : (
        <ul className={styles.lista}>
          {avisos.map((a) => (
            <li key={a.id}>
              <Link to={`/loja/${lojaId}/avisos/${a.id}`} className={styles.cartaoGrupo}>
                <span className={styles.nomeProduto}>{a.grupo.produto.nome}</span>
                <AmostraFita fita={a.grupo.fita} data={a.grupo.referencia} />
                <Prazo aviso={a} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Urgente (até 7 dias, decidido pela API) em vermelho; adiado em âmbar; o resto em cinza. */
function Prazo({ aviso: a }: { aviso: Aviso }) {
  const hoje = hojeEmBrasilia(useAgora(60_000))
  if (a.grupo.situacao === 'adiado' && a.grupo.adiado_ate) {
    const volta = a.grupo.adiado_ate === somarDias(hoje, 1) ? 'amanhã' : `em ${formatarDataCurta(a.grupo.adiado_ate)}`
    return <span className={classes(styles.prazo, styles.prazoAdiado)}>Adiado · volta {volta}</span>
  }
  const dias = a.vence_em_dias
  const texto = dias <= 0 ? 'Vence hoje' : dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`
  return <span className={classes(styles.prazo, a.urgente && styles.prazoUrgente)}>{texto}</span>
}
