import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSessao } from '../../app/contextos'
import { inicioDaLoja } from '../../app/destino'
import { esquecerEscolha, lerEscolha } from '../../app/escolha'
import { instalar, useInstalacao } from '../../app/instalacao'
import { useEhDesktop } from '../../app/tela'
import { classes } from '../../util/classes'
import { Botao } from '../../componentes/Botao'
import { IconeInstalar, IconePino } from '../../componentes/icones'
import { Interruptor } from '../../componentes/Interruptor'
import { Selo } from '../../componentes/Selo'
import { useLocal } from '../../localizacao/contexto'
import styles from './Consumidor.module.css'

/** "Ana Souza" → "AS". */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

/** C9 · Perfil e preferências (com o "Instalar na tela inicial" da PWA). */
export function C9Perfil() {
  const { eu, sair } = useSessao()
  const { local } = useLocal()
  const desktop = useEhDesktop()
  const navegar = useNavigate()
  const [saindo, setSaindo] = useState(false)

  if (!eu) return null // rota atrás do ExigeLogin

  const escolha = lerEscolha(eu.id)
  const lojaLembrada = escolha?.tipo === 'loja' ? eu.vinculos.find((v) => v.loja.id === escolha.lojaId) : undefined
  const comoAbre =
    escolha?.tipo === 'comprar' ? 'Comprar com desconto' : lojaLembrada ? lojaLembrada.loja.nome : 'Perguntar sempre'

  function escolherDeNovo() {
    esquecerEscolha(eu!.id)
    navegar('/escolher')
  }

  async function sairDaConta() {
    setSaindo(true)
    await sair()
    navegar('/entrar', { replace: true })
  }

  return (
    <div className={styles.reserva}>
      <header className={styles.cabecalhoPerfil}>
        <span className={styles.avatar} aria-hidden="true">
          {iniciais(eu.nome)}
        </span>
        <span className={styles.textosPerfil}>
          <h1 className={styles.tituloTela}>{eu.nome}</h1>
          <span className={styles.texto}>{eu.email}</span>
        </span>
      </header>

      <section className={styles.secaoPerfil} aria-labelledby="preferencias">
        <h2 id="preferencias" className={styles.sobrelinha}>
          Preferências
        </h2>
        <Link to="/boas-vindas?voltar=%2Fperfil" className={styles.linhaLink}>
          <IconePino tamanho={20} />
          <span className={styles.textosPerfil}>
            <span className={styles.rotulo}>Localização</span>
            <span className={styles.texto}>{local ? local.rotulo : 'Não definida'} · não fica gravada</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
        {/* Push só desenhado (briefing): grupo H do contrato fica para depois de 09/11/2026. */}
        <Interruptor ligado={false} aoMudar={() => {}} desabilitado detalhe="Em breve: aviso quando uma loja publicar uma oferta">
          Avisos de oferta nova
        </Interruptor>
        <InstalarApp />
      </section>

      {eu.vinculos.length > 0 && (
        <section className={styles.secaoPerfil} aria-labelledby="minhas-lojas">
          <h2 id="minhas-lojas" className={styles.sobrelinha}>
            Minhas lojas
          </h2>
          <ul className={styles.lista}>
            {eu.vinculos.map((v) => (
              <li key={v.loja.id} className={styles.cartaoDetalhe}>
                <span className={styles.linhaTopo}>
                  <strong>{v.loja.nome}</strong>
                  {v.papel === 'responsavel' ? <Selo variante="primary">Responsável</Selo> : <Selo variante="neutral">Funcionário</Selo>}
                </span>
                <Link to={inicioDaLoja(v.loja.id, v.papel, desktop)} className={styles.linkForte}>
                  Entrar como loja
                </Link>
              </li>
            ))}
          </ul>
          <div className={styles.linhaComoAbre}>
            <span>
              <span className={styles.texto}>Ao abrir o app: </span>
              <strong>{comoAbre}</strong>
            </span>
            <button type="button" className={styles.linkBotao} onClick={escolherDeNovo}>
              Escolher de novo
            </button>
          </div>
        </section>
      )}

      <Botao variante="perigo" carregando={saindo} textoCarregando="Saindo…" onClick={sairDaConta}>
        Sair da conta
      </Botao>
    </div>
  )
}

/**
 * "Instalar na tela inicial": no Android/Chrome, abre o pedido do navegador; já instalado,
 * só informa; no iPhone (sem o pedido), ensina o caminho pelo Compartilhar (decisão 3a da F9).
 */
function InstalarApp() {
  const situacao = useInstalacao()
  const conteudo = (detalhe: string) => (
    <>
      <IconeInstalar tamanho={20} />
      <span className={styles.textosPerfil}>
        <span className={styles.rotulo}>Instalar na tela inicial</span>
        <span className={styles.texto}>{detalhe}</span>
      </span>
    </>
  )
  if (situacao === 'pode_instalar') {
    return (
      <button type="button" className={classes(styles.linhaLink, styles.linhaBotao)} onClick={() => void instalar()}>
        {conteudo('Abre como um app, sem a barra do navegador')}
      </button>
    )
  }
  return (
    <div className={classes(styles.linhaLink, styles.linhaInformativa)}>
      {situacao === 'instalado'
        ? conteudo('App instalado neste aparelho')
        : conteudo('No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início"')}
    </div>
  )
}
