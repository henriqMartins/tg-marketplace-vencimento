import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { Convite, LojaPlataforma } from '../../api'
import { useApi } from '../../app/contextos'
import { linkDoConvite } from '../../app/parceria'
import { useEhDesktop } from '../../app/tela'
import { Botao } from '../../componentes/Botao'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { MensagemErro } from '../../componentes/Mensagem'
import { Selo } from '../../componentes/Selo'
import { useToast } from '../../componentes/toast/contexto'
import { mascararCnpj } from '../../util/cnpj'
import { formatarDataCurta } from '../../util/formatar'
import { CompartilharConvite } from './CompartilharConvite'
import styles from './Plataforma.module.css'

/** P2 · Plataforma · Lojas: todas as lojas, com o CNPJ e a situação do convite. */
export function P2Lojas() {
  const api = useApi()
  const consultas = useQueryClient()
  const mostrarToast = useToast()
  const desktop = useEhDesktop()
  const navegar = useNavigate()
  const [novo, setNovo] = useState<{ convite: Convite; nomeLoja: string } | null>(null)

  const lojas = useQuery({ queryKey: ['plataforma', 'lojas'], queryFn: () => api.parceria.listarLojas() })

  const gerar = useMutation({
    mutationFn: (loja: LojaPlataforma) => api.parceria.novoConvite(loja.id),
    onSuccess: (convite, loja) => {
      void consultas.invalidateQueries({ queryKey: ['plataforma', 'lojas'] })
      setNovo({ convite, nomeLoja: loja.nome })
    },
  })

  async function copiarLink(codigo: string) {
    try {
      await navigator.clipboard.writeText(linkDoConvite(codigo))
      mostrarToast('Link copiado.')
    } catch {
      mostrarToast('O navegador não deixou copiar. Gere o convite de novo para ver o link.')
    }
  }

  /** Só loja sem responsável tem convite para copiar ou renovar. */
  const acoes = (l: LojaPlataforma) =>
    !l.responsavel && l.convite ? (
      <div className={styles.acoes}>
        {l.convite.codigo && (
          <Botao variante="secundario" larguraTotal={false} onClick={() => copiarLink(l.convite!.codigo!)}>
            Copiar link do convite
          </Botao>
        )}
        <Botao
          variante="secundario"
          larguraTotal={false}
          carregando={gerar.isPending && gerar.variables?.id === l.id}
          textoCarregando="Gerando…"
          onClick={() => gerar.mutate(l)}
        >
          Gerar novo convite
        </Botao>
      </div>
    ) : null

  let conteudo
  if (lojas.isPending) conteudo = <EsqueletoLista quantidade={3} rotulo="Carregando lojas…" />
  else if (lojas.isError) conteudo = <MensagemErro erro={lojas.error} />
  else if (lojas.data.length === 0) conteudo = <p className={styles.nota}>Nenhuma loja cadastrada.</p>
  else if (desktop) {
    conteudo = (
      <table className={styles.tabela}>
        <thead>
          <tr>
            <th scope="col">Loja</th>
            <th scope="col">CNPJ</th>
            <th scope="col">Responsável</th>
            <th scope="col">Cadastro</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {lojas.data.map((l) => (
            <tr key={l.id}>
              <td>
                <span className={styles.principal}>{l.nome}</span>
                <span className={styles.secundario}>{l.endereco}</span>
              </td>
              <td>
                <Cnpj loja={l} />
              </td>
              <td>
                <Responsavel loja={l} />
              </td>
              <td>{formatarDataCurta(l.criada_em)}</td>
              <td>{acoes(l)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  } else {
    conteudo = (
      <ul className={styles.lista}>
        {lojas.data.map((l) => (
          <li key={l.id} className={styles.cartao}>
            <span className={styles.linhaTopo}>
              <span>
                <span className={styles.principal}>{l.nome}</span>
                <span className={styles.secundario}>{l.endereco}</span>
              </span>
              <span className={styles.secundario}>{formatarDataCurta(l.criada_em)}</span>
            </span>
            <Cnpj loja={l} />
            <Responsavel loja={l} />
            {acoes(l)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className={styles.tela}>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Lojas</h1>
          <p className={styles.subtitulo}>A loja aparece na vitrine quando o responsável publica a primeira oferta.</p>
        </div>
        <Botao larguraTotal={false} onClick={() => navegar('/plataforma/lojas/nova')}>
          + Cadastrar loja
        </Botao>
      </header>
      {gerar.isError && <MensagemErro erro={gerar.error} />}
      {conteudo}
      <FolhaInferior aberta={novo !== null} titulo="Novo convite gerado" aoFechar={() => setNovo(null)} forma="modal">
        {novo && (
          <>
            <p className={styles.nota}>O link anterior deixou de valer. Mande este para {novo.nomeLoja}.</p>
            <CompartilharConvite convite={novo.convite} nomeLoja={novo.nomeLoja} />
          </>
        )}
      </FolhaInferior>
    </div>
  )
}

function Cnpj({ loja }: { loja: LojaPlataforma }) {
  if (!loja.cnpj) return <span className={styles.secundario}>Sem CNPJ</span>
  return (
    <span>
      {mascararCnpj(loja.cnpj)} {!loja.cnpj_verificado && <Selo variante="warn">não verificado</Selo>}
    </span>
  )
}

function Responsavel({ loja }: { loja: LojaPlataforma }) {
  if (loja.responsavel) {
    return (
      <span>
        <span className={styles.principal}>{loja.responsavel.nome}</span>
        <span className={styles.secundario}>{loja.responsavel.email}</span>
      </span>
    )
  }
  if (loja.convite?.estado === 'pendente') {
    return (
      <span>
        <Selo variante="pending">Convite pendente · vence {formatarDataCurta(loja.convite.expira_em)}</Selo>
        <span className={styles.secundario}>{loja.convite.email}</span>
      </span>
    )
  }
  if (loja.convite?.estado === 'vencido') return <Selo variante="danger">Convite vencido</Selo>
  return <span className={styles.secundario}>—</span>
}
