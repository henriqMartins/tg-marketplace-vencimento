import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { RECARGA_30S } from '../../app/consultas'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { Esqueleto } from '../../componentes/Esqueleto'
import { IconeAvisos, IconeConfig, IconeEtiqueta, IconeLotes, IconeMais, IconePainel, IconeRetirada, IconeTrocar } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import { classes } from '../../util/classes'
import styles from './Loja.module.css'

/** "Sexta, 23 de outubro" — a data do aparelho, só para o cabeçalho. */
function dataDeHoje(): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
  const semFeira = texto.replace('-feira', '')
  return semFeira.charAt(0).toUpperCase() + semFeira.slice(1)
}

/** L1 · Início da loja. Os números vêm prontos do resumo do dia (GET …/resumo-do-dia). */
export function L1Inicio() {
  const api = useApi()
  const { lojaId, nome, papel } = useLojaAtual()
  const resumo = useQuery({ queryKey: ['resumo', lojaId], queryFn: () => api.operacao.resumoDoDia(lojaId), ...RECARGA_30S })
  const base = `/loja/${lojaId}`
  const responsavel = papel === 'responsavel'

  return (
    <div className={styles.tela}>
      <header className={styles.cabecalhoLoja}>
        <div className={styles.linhaCabecalho}>
          <span className={styles.data}>{dataDeHoje()}</span>
          <span className={styles.acoesCabecalho}>
            {responsavel && (
              <Link to={`${base}/config`} className={styles.botaoClaro} aria-label="Configurações da loja" title="Configurações da loja">
                <IconeConfig />
              </Link>
            )}
            <Link to="/escolher" className={styles.botaoClaro} aria-label="Trocar perfil" title="Trocar perfil">
              <IconeTrocar />
            </Link>
          </span>
        </div>
        <h1 className={styles.nomeLoja}>{nome}</h1>
        <span className={styles.seloClaro}>{responsavel ? 'Responsável' : 'Funcionário'}</span>
      </header>

      {resumo.isError ? (
        <MensagemErro erro={resumo.error} />
      ) : (
        <dl className={styles.indicadores}>
          <Indicador rotulo="Aguardando retirada" valor={resumo.data?.aguardando_retirada} />
          <Indicador rotulo="Expiram em menos de 1 h" valor={resumo.data?.expiram_em_1h} urgente />
          <Indicador rotulo="Ofertas ativas" valor={resumo.data?.ofertas_ativas} />
        </dl>
      )}

      <Link to={`${base}/retirada`} className={styles.botaoValidar}>
        <IconeRetirada tamanho={30} />
        Validar retirada
      </Link>

      <nav aria-label="Atalhos da loja" className={styles.atalhos}>
        <Atalho para={`${base}/lotes/novo`} icone={<IconeMais />} titulo="Cadastrar lote" />
        <Atalho
          para={`${base}/avisos`}
          icone={<IconeAvisos />}
          titulo="Avisos de validade"
          detalhe={resumo.data ? `${resumo.data.avisos_para_conferir} para conferir` : undefined}
        />
        <Atalho para={`${base}/ofertas`} icone={<IconeEtiqueta />} titulo="Ofertas" />
        <Atalho para={`${base}/lotes`} icone={<IconeLotes />} titulo="Lotes e fitas" />
      </nav>

      {responsavel && (
        <Link to={`${base}/painel`} className={styles.faixaPainel}>
          <IconePainel />
          <span>
            <strong>Painel e projeção</strong>
            <span className={styles.detalheAtalho}> (melhor no computador)</span>
          </span>
        </Link>
      )}
    </div>
  )
}

function Indicador({ rotulo, valor, urgente = false }: { rotulo: string; valor: number | undefined; urgente?: boolean }) {
  return (
    <div className={styles.indicador}>
      <dt className={styles.rotuloIndicador}>{rotulo}</dt>
      <dd className={classes(styles.valorIndicador, urgente && valor ? styles.urgente : undefined)}>
        {valor === undefined ? <Esqueleto largura={36} altura={30} /> : valor}
      </dd>
    </div>
  )
}

function Atalho({ para, icone, titulo, detalhe }: { para: string; icone: ReactNode; titulo: string; detalhe?: string }) {
  return (
    <Link to={para} className={styles.atalho}>
      <span className={styles.iconeAtalho} aria-hidden="true">
        {icone}
      </span>
      <span className={styles.tituloAtalho}>{titulo}</span>
      {detalhe && <span className={styles.detalheAtalho}>{detalhe}</span>}
    </Link>
  )
}

