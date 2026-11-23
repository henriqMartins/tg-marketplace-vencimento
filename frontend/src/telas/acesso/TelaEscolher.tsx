import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useSessao } from '../../app/contextos'
import { inicioDaLoja } from '../../app/destino'
import { lembrarEscolha, type EscolhaLembrada } from '../../app/escolha'
import { interesseEmAberto } from '../../app/parceria'
import { useEhDesktop } from '../../app/tela'
import { CaixaSelecao } from '../../componentes/CaixaSelecao'
import { IconeCasa, IconeEtiqueta, IconePainel, IconeVitrine } from '../../componentes/icones'
import { Selo } from '../../componentes/Selo'
import { classes } from '../../util/classes'
import styles from './TelaEscolher.module.css'

/**
 * A4 · Escolher como entrar. Aparece sempre depois de entrar (docs/parceria.md, seção 2).
 * Blocos: Comprar → Minhas lojas (com vínculo) → Equipe da plataforma (eu.plataforma) →
 * Tenho um mercado. Celular: tela cheia; computador: coluna de 560 px.
 */
export function TelaEscolher() {
  const { eu } = useSessao()
  const desktop = useEhDesktop()
  const [lembrar, setLembrar] = useState(false)

  if (!eu) return null // a rota está atrás do ExigeLogin

  const escolher = (escolha: EscolhaLembrada | null) => () => {
    if (lembrar && escolha) lembrarEscolha(eu.id, escolha)
  }
  const primeiroNome = eu.nome.split(' ')[0]
  const qtd = eu.vinculos.length
  const pedidoEmAberto = interesseEmAberto(eu)

  return (
    <div className={classes(styles.tela, desktop && styles.telaComputador)}>
      <div className={styles.cabecalho}>
        <span className={styles.ola}>Olá, {primeiroNome}</span>
        <h1 className={styles.titulo}>Como você quer entrar?</h1>
        <p className={styles.texto}>
          {qtd > 0
            ? `Sua conta tem vínculo com ${qtd === 1 ? 'uma loja' : `${qtd} lojas`}. Você pode trocar depois no Perfil.`
            : 'Você pode trocar depois no Perfil.'}
        </p>
      </div>

      <Cartao
        para="/vitrine"
        aoEscolher={escolher({ tipo: 'comprar' })}
        icone={<IconeVitrine tamanho={26} />}
        titulo="Comprar com desconto"
        detalhe={<span className={styles.detalhe}>Ver ofertas perto de mim e reservar</span>}
      />

      {qtd > 0 && (
        <>
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
                    v.papel === 'responsavel' ? (
                      <Selo variante="primary">Responsável</Selo>
                    ) : (
                      <Selo variante="neutral">Funcionário</Selo>
                    )
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {eu.plataforma && (
        <Cartao
          para="/plataforma"
          aoEscolher={escolher({ tipo: 'plataforma' })}
          icone={<IconePainel tamanho={26} />}
          iconeForte
          titulo="Equipe da plataforma"
          detalhe={<span className={styles.detalhe}>Interessados, lojas e convites</span>}
        />
      )}

      {pedidoEmAberto ? (
          <Cartao
            para="/parceiro"
            aoEscolher={escolher(null)}
            icone={<IconeEtiqueta tamanho={26} />}
            titulo="Pedido de parceria recebido"
            detalhe={<Selo variante="pending">Entraremos em contato</Selo>}
          />
        ) : (
          <Cartao
            para="/parceiro"
            aoEscolher={escolher(null)}
            icone={<IconeEtiqueta tamanho={26} />}
            titulo="Tenho um mercado"
            detalhe={<span className={styles.detalhe}>Quero vender meus produtos perto do vencimento aqui</span>}
          />
      )}

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
