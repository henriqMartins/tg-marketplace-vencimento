import { Link } from 'react-router'
import type { OfertaVitrine } from '../api'
import { formatarDataCurta, formatarDinheiro, formatarDistancia } from '../util/formatar'
import styles from './CartaoOferta.module.css'
import { IconeSacola } from './icones'

/** Selo laranja "−30%" (texto branco sobre `discount`). */
export function SeloDesconto({ desconto, grande = false }: { desconto: number; grande?: boolean }) {
  return (
    <span className={grande ? `${styles.desconto} ${styles.descontoGrande}` : styles.desconto}>
      <span aria-hidden="true">−{desconto}%</span>
      <span className="so-leitor">{desconto}% de desconto</span>
    </span>
  )
}

/** Preço com desconto em destaque e o original riscado (lido como "antes"). */
export function Preco({ preco, original, tamanho = 18 }: { preco: string; original: string; tamanho?: number }) {
  return (
    <span className={styles.preco} style={{ fontSize: tamanho }}>
      {formatarDinheiro(preco)}{' '}
      <s className={styles.original}>
        <span className="so-leitor">antes </span>
        {formatarDinheiro(original)}
      </s>
    </span>
  )
}

/** Card da vitrine (C2). Tudo vem pronto da API; o card só formata. */
export function CartaoOferta({ oferta }: { oferta: OfertaVitrine }) {
  const { produto, loja } = oferta
  return (
    <Link to={`/oferta/${oferta.id}`} className={styles.cartao}>
      <span className={styles.imagem} aria-hidden="true">
        <IconeSacola tamanho={30} />
      </span>
      <span className={styles.seloNaImagem}>
        <SeloDesconto desconto={oferta.desconto} />
      </span>
      <span className={styles.corpo}>
        <span className={styles.nome}>{produto.nome}</span>
        <span className={styles.loja}>
          {loja.nome}
          {oferta.distancia_km !== null && ` · ${formatarDistancia(oferta.distancia_km)}`}
        </span>
        <Preco preco={oferta.preco} original={oferta.preco_original} />
        <span className={styles.rodape}>
          Vence {formatarDataCurta(oferta.validade)} ·{' '}
          {oferta.livre > 0 ? (
            <>
              <strong>{oferta.livre}</strong> {oferta.livre === 1 ? 'disponível' : 'disponíveis'}
            </>
          ) : (
            <strong>Esgotado</strong>
          )}
        </span>
      </span>
    </Link>
  )
}
