import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { EstadoInteresse, Interesse } from '../../api'
import { useApi } from '../../app/contextos'
import { useEhDesktop } from '../../app/tela'
import { Abas } from '../../componentes/Abas'
import { idAba, idPainel } from '../../componentes/abasIds'
import { Botao } from '../../componentes/Botao'
import { CampoTexto } from '../../componentes/Campo'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { MensagemErro } from '../../componentes/Mensagem'
import { useToast } from '../../componentes/toast/contexto'
import { formatarDataCurta } from '../../util/formatar'
import styles from './Plataforma.module.css'

const ABAS: { id: EstadoInteresse; rotulo: string }[] = [
  { id: 'novo', rotulo: 'Novos' },
  { id: 'em_conversa', rotulo: 'Em conversa' },
  { id: 'virou_loja', rotulo: 'Viraram loja' },
  { id: 'descartado', rotulo: 'Descartados' },
]

const VAZIO: Record<EstadoInteresse, string> = {
  novo: 'Nenhum pedido novo.',
  em_conversa: 'Nenhum pedido em conversa.',
  virou_loja: 'Nenhum pedido virou loja ainda.',
  descartado: 'Nenhum pedido descartado.',
}

const PREFIXO = 'interessados'

/** P1 · Plataforma · Interessados: os pedidos da A6, por estado (aba na URL: ?estado=). */
export function P1Interessados() {
  const api = useApi()
  const consultas = useQueryClient()
  const mostrarToast = useToast()
  const desktop = useEhDesktop()
  const navegar = useNavigate()
  const [parametros, setParametros] = useSearchParams()
  const estado = (ABAS.find((a) => a.id === parametros.get('estado'))?.id ?? 'novo') as EstadoInteresse
  const [descartando, setDescartando] = useState<Interesse | null>(null)

  const lista = useQuery({
    queryKey: ['plataforma', 'interesses', estado],
    queryFn: () => api.parceria.listarInteresses(estado),
  })

  const marcarEmConversa = useMutation({
    mutationFn: (id: number) => api.parceria.atualizarInteresse(id, { estado: 'em_conversa' }),
    onSuccess: (i) => {
      void consultas.invalidateQueries({ queryKey: ['plataforma', 'interesses'] })
      mostrarToast(`${i.nome_mercado} está em conversa.`)
    },
  })

  const acoes = (i: Interesse) =>
    i.estado === 'novo' || i.estado === 'em_conversa' ? (
      <div className={styles.acoes}>
        <Botao larguraTotal={false} onClick={() => navegar(`/plataforma/lojas/nova?interesse=${i.id}`)}>
          Cadastrar loja
        </Botao>
        {i.estado === 'novo' && (
          <Botao
            variante="secundario"
            larguraTotal={false}
            carregando={marcarEmConversa.isPending && marcarEmConversa.variables === i.id}
            textoCarregando="Salvando…"
            onClick={() => marcarEmConversa.mutate(i.id)}
          >
            Marcar em conversa
          </Botao>
        )}
        <Botao variante="perigo" larguraTotal={false} onClick={() => setDescartando(i)}>
          Descartar
        </Botao>
      </div>
    ) : i.estado === 'virou_loja' ? (
      <Link to="/plataforma/lojas">Ver em Lojas</Link>
    ) : (
      <span className={styles.secundario}>Motivo: {i.motivo_descarte ?? '—'}</span>
    )

  let conteudo
  if (lista.isPending) conteudo = <EsqueletoLista quantidade={3} rotulo="Carregando pedidos…" />
  else if (lista.isError) conteudo = <MensagemErro erro={lista.error} />
  else if (lista.data.length === 0) conteudo = <p className={styles.nota}>{VAZIO[estado]}</p>
  else if (desktop) {
    conteudo = (
      <table className={styles.tabela}>
        <thead>
          <tr>
            <th scope="col">Mercado</th>
            <th scope="col">Telefone</th>
            <th scope="col">Quem pediu</th>
            <th scope="col">Data</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {lista.data.map((i) => (
            <tr key={i.id}>
              <td>
                <span className={styles.principal}>{i.nome_mercado}</span>
                <span className={styles.secundario}>{i.cidade}</span>
                {i.mensagem && <span className={styles.secundario}>“{i.mensagem}”</span>}
              </td>
              <td>
                <a href={`tel:${i.telefone}`}>{i.telefone}</a>
              </td>
              <td>
                <span className={styles.principal}>{i.pessoa.nome}</span>
                <span className={styles.secundario}>{i.pessoa.email}</span>
              </td>
              <td>{formatarDataCurta(i.criado_em)}</td>
              <td>{acoes(i)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  } else {
    conteudo = (
      <ul className={styles.lista}>
        {lista.data.map((i) => (
          <li key={i.id} className={styles.cartao}>
            <span className={styles.linhaTopo}>
              <span>
                <span className={styles.principal}>{i.nome_mercado}</span>
                <span className={styles.secundario}>{i.cidade}</span>
              </span>
              <span className={styles.secundario}>{formatarDataCurta(i.criado_em)}</span>
            </span>
            <span className={styles.secundario}>
              {i.pessoa.nome} · {i.pessoa.email} · <a href={`tel:${i.telefone}`}>{i.telefone}</a>
            </span>
            {i.mensagem && <span className={styles.secundario}>“{i.mensagem}”</span>}
            {acoes(i)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className={styles.tela}>
      <header className={styles.cabecalho}>
        <div>
          <h1 className={styles.titulo}>Interessados</h1>
          <p className={styles.subtitulo}>Pedidos de parceria feitos no app. Converse, visite e, com o acordo feito, cadastre a loja.</p>
        </div>
      </header>
      {marcarEmConversa.isError && <MensagemErro erro={marcarEmConversa.error} />}
      <Abas
        prefixo={PREFIXO}
        abas={ABAS}
        ativa={estado}
        rotulo="Estado do pedido"
        aoTrocar={(id) => setParametros(id === 'novo' ? {} : { estado: id }, { replace: true })}
      />
      <div role="tabpanel" id={idPainel(PREFIXO, estado)} aria-labelledby={idAba(PREFIXO, estado)}>
        {conteudo}
      </div>
      <FolhaDescartar interesse={descartando} aoFechar={() => setDescartando(null)} />
    </div>
  )
}

/** "Descartar" pede um motivo curto (fica registrado no pedido). */
function FolhaDescartar({ interesse, aoFechar }: { interesse: Interesse | null; aoFechar: () => void }) {
  const api = useApi()
  const consultas = useQueryClient()
  const mostrarToast = useToast()
  const [motivo, setMotivo] = useState('')
  const [faltando, setFaltando] = useState(false)

  const descartar = useMutation({
    mutationFn: (i: Interesse) => api.parceria.atualizarInteresse(i.id, { estado: 'descartado', motivo: motivo.trim() }),
    onSuccess: (i) => {
      void consultas.invalidateQueries({ queryKey: ['plataforma', 'interesses'] })
      mostrarToast(`Pedido de ${i.nome_mercado} descartado.`)
      fechar()
    },
  })

  function fechar() {
    setMotivo('')
    setFaltando(false)
    descartar.reset()
    aoFechar()
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!interesse) return
    if (!motivo.trim()) {
      setFaltando(true)
      return
    }
    descartar.mutate(interesse)
  }

  return (
    <FolhaInferior aberta={interesse !== null} titulo={`Descartar ${interesse?.nome_mercado ?? ''}`} aoFechar={fechar} forma="modal">
      <form className={styles.formulario} onSubmit={enviar} noValidate>
        {descartar.isError && <MensagemErro erro={descartar.error} />}
        <CampoTexto
          rotulo="Motivo"
          rows={2}
          maxLength={200}
          dica="Curto. Ex.: fora da região, não vende embalados."
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value)
            setFaltando(false)
          }}
          erro={faltando ? 'Diga o motivo em poucas palavras.' : null}
        />
        <Botao type="submit" variante="perigoSolido" carregando={descartar.isPending} textoCarregando="Descartando…">
          Descartar pedido
        </Botao>
        <Botao variante="secundario" onClick={fechar}>
          Cancelar
        </Botao>
      </form>
    </FolhaInferior>
  )
}
