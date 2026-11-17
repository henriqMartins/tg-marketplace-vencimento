import type { ReactNode } from 'react'
import type { EstadoHistorico, EstadoOferta, EstadoReserva, SituacaoGrupo } from '../api/tipos'
import { classes } from '../util/classes'
import styles from './Selo.module.css'

export type VarianteSelo = 'pending' | 'success' | 'neutral' | 'danger' | 'warn' | 'primary' | 'bloqueio'

/** Pílula 12/700. Sempre com texto: a cor nunca é o único sinal. */
export function Selo({ variante, children }: { variante: VarianteSelo; children: ReactNode }) {
  return <span className={classes(styles.selo, styles[variante])}>{children}</span>
}

// Cores e textos da especificação, seção 0, "Selos de estado".
const RESERVA: Record<EstadoReserva, [string, VarianteSelo]> = {
  reservada: ['Reservada', 'pending'],
  retirada: ['Retirada', 'success'],
  expirada: ['Expirada', 'neutral'],
  cancelada: ['Cancelada', 'danger'],
}

const OFERTA: Record<EstadoOferta, [string, VarianteSelo]> = {
  ativa: ['Oferta ativa', 'success'],
  encerrada: ['Oferta encerrada', 'neutral'],
}

const GRUPO: Record<SituacaoGrupo, [string, VarianteSelo]> = {
  aguardando: ['Aguardando aviso', 'primary'],
  conferir: ['Conferir', 'danger'],
  adiado: ['Aviso adiado', 'warn'],
  em_oferta: ['Em oferta', 'success'],
  encerrado: ['Encerrado', 'neutral'],
}

export function SeloReserva({ estado }: { estado: EstadoReserva }) {
  const [texto, variante] = RESERVA[estado]
  return <Selo variante={variante}>{texto}</Selo>
}

/** Histórico do gestor (G3): os 4 estados da reserva + a recusa. */
export function SeloHistorico({ estado }: { estado: EstadoHistorico }) {
  if (estado === 'recusa') return <Selo variante="bloqueio">Recusa</Selo>
  return <SeloReserva estado={estado} />
}

export function SeloOferta({ estado }: { estado: EstadoOferta }) {
  const [texto, variante] = OFERTA[estado]
  return <Selo variante={variante}>{texto}</Selo>
}

export function SeloGrupo({ situacao }: { situacao: SituacaoGrupo }) {
  const [texto, variante] = GRUPO[situacao]
  return <Selo variante={variante}>{texto}</Selo>
}
