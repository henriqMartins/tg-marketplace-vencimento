import type { CSSProperties } from 'react'
import styles from './Esqueleto.module.css'

export interface EsqueletoProps {
  largura?: CSSProperties['width']
  altura?: CSSProperties['height']
  raio?: CSSProperties['borderRadius']
}

/** Bloco cinza que pulsa no lugar do conteúdo. Decorativo: quem anuncia "carregando" é a lista. */
export function Esqueleto({ largura = '100%', altura = 14, raio }: EsqueletoProps) {
  return <span className={styles.bloco} style={{ width: largura, height: altura, borderRadius: raio }} aria-hidden="true" />
}

/** Formato do card de oferta: imagem de 84 px + 3 linhas. */
export function EsqueletoCartao() {
  return (
    <div className={styles.cartao} aria-hidden="true">
      <Esqueleto largura={84} altura={84} raio={12} />
      <div className={styles.linhas}>
        <Esqueleto largura="80%" altura={14} />
        <Esqueleto largura="55%" altura={12} />
        <Esqueleto largura="40%" altura={16} />
      </div>
    </div>
  )
}

/** Lista de cartões-esqueleto com um único aviso "Carregando…" para leitor de tela. */
export function EsqueletoLista({ quantidade = 3, rotulo = 'Carregando…' }: { quantidade?: number; rotulo?: string }) {
  return (
    <div className={styles.lista} role="status">
      <span className="so-leitor">{rotulo}</span>
      {Array.from({ length: quantidade }, (_, i) => (
        <EsqueletoCartao key={i} />
      ))}
    </div>
  )
}
