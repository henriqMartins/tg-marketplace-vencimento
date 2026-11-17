import { useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { useSessao } from '../../app/contextos'
import { inicioDaLoja } from '../../app/destino'
import { lembrarEscolha, type EscolhaLembrada } from '../../app/escolha'
import { useEhDesktop } from '../../app/tela'
import { CaixaSelecao } from '../../componentes/CaixaSelecao'
import { IconeCasa, IconeVitrine } from '../../componentes/icones'
import { Selo } from '../../componentes/Selo'
import styles from './TelaEscolher.module.css'

/** A4 · Escolher como entrar. Só para quem tem vínculo com alguma loja. */
export function TelaEscolher() {
  const { eu } = useSessao()
  const desktop = useEhDesktop()
  // Desmarcado por padrão: trocar a escolha (C9, L1) só existe a partir da F5/F6.
  const [lembrar, setLembrar] = useState(false)

  if (!eu) return null // a rota está atrás do ExigeLogin
  if (eu.vinculos.length === 0) return <Navigate to="/vitrine" replace />

  const escolher = (escolha: EscolhaLembrada) => () => {
    if (lembrar) lembrarEscolha(eu.id, escolha)
  }
  const primeiroNome = eu.nome.split(' ')[0]
  const qtd = eu.vinculos.length

  return (
    <div className={styles.tela}>
      <div className={styles.cabecalho}>
        <span className={styles.ola}>Olá, {primeiroNome}</span>
        <h1 className={styles.titulo}>Como você quer entrar?</h1>
        <p className={styles.texto}>
          Sua conta tem vínculo com {qtd === 1 ? 'uma loja' : `${qtd} lojas`}. Você pode trocar depois no Perfil.
        </p>
      </div>

      <Cartao
        para="/vitrine"
        aoEscolher={escolher({ tipo: 'comprar' })}
        icone={<IconeVitrine tamanho={26} />}
        titulo="Comprar com desconto"
        detalhe={<span className={styles.detalhe}>Ver ofertas perto de mim e reservar</span>}
      />

      <h2 className={styles.sobrelinha}>Minhas lojas</h2>
      <ul className={styles.lista}>
        {eu.vinculos.map((v) => (
          <li key={v.loja.id}>
            <Cartao
              para={inicioDaLoja(v.loja.id, v.papel, desktop)}
              aoEscolher={escolher({ tipo: 'loja', lojaId: v.loja.id })}
              icone={<IconeCasa tamanho={26} />}
              iconeForte={v.papel === 'responsavel'}
              titulo={v.loja.nome}
              detalhe={
                v.papel === 'responsavel' ? <Selo variante="primary">Responsável</Selo> : <Selo variante="neutral">Funcionário</Selo>
              }
            />
          </li>
        ))}
      </ul>

      <div className={styles.rodape}>
        <CaixaSelecao checked={lembrar} onChange={(e) => setLembrar(e.target.checked)}>
          Lembrar minha escolha neste aparelho
        </CaixaSelecao>
      </div>
    </div>
  )
}

function Cartao(props: {
  para: string
  aoEscolher: () => void
  icone: ReactNode
  iconeForte?: boolean
  titulo: string
  detalhe: ReactNode
}) {
  return (
    <Link to={props.para} onClick={props.aoEscolher} className={styles.cartao}>
      <span className={props.iconeForte ? styles.iconeForte : styles.icone} aria-hidden="true">
        {props.icone}
      </span>
      <span className={styles.corpoCartao}>
        <span className={styles.tituloCartao}>{props.titulo}</span>
        {props.detalhe}
      </span>
    </Link>
  )
}
