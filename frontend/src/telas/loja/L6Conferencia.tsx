import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { AvisoDetalhe, MotivoDescarte } from '../../api'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { useEhDesktop } from '../../app/tela'
import { useAgora } from '../../app/tempo'
import { AmostraFita } from '../../componentes/AmostraFita'
import { Botao, BotaoIcone } from '../../componentes/Botao'
import { Contador } from '../../componentes/Contador'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { IconeVoltar } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import { useToast } from '../../componentes/toast/contexto'
import { classes } from '../../util/classes'
import { nomeDaCor } from '../../util/fita'
import { formatarData, formatarDataCurta, formatarHorario } from '../../util/formatar'
import { hojeEmBrasilia, somarDias } from '../../util/periodo'
import { chaveAviso, invalidarAvisos } from './avisos'
import styles from './Lotes.module.css'

/**
 * L6 · Conferência na gôndola (Figura 3). Aqui SÓ se conta (decidido 05/11/2026): preço e
 * desconto ficam na L7. Daqui também se adia (L8) ou se encerra sem oferta.
 */
export function L6Conferencia() {
  const api = useApi()
  const navegar = useNavigate()
  const { lojaId } = useLojaAtual()
  const avisoId = Number(useParams().avisoId)
  const aviso = useQuery({ queryKey: chaveAviso(lojaId, avisoId), queryFn: () => api.lotes.obterAviso(lojaId, avisoId) })
  const [contagem, setContagem] = useState(1)
  const [folha, setFolha] = useState<'adiar' | 'descartar' | null>(null)
  const base = `/loja/${lojaId}`

  const cabecalho = (
    <header className={styles.cabecalho}>
      <BotaoIcone rotulo="Voltar para os avisos" onClick={() => navegar(`${base}/avisos`)}>
        <IconeVoltar />
      </BotaoIcone>
      <h1 className={styles.tituloTela}>Conferência na gôndola</h1>
    </header>
  )

  if (aviso.isPending) return <EsqueletoLista quantidade={2} rotulo="Carregando aviso…" />
  if (aviso.isError) {
    // 404: outra pessoa já publicou ou encerrou este aviso.
    return (
      <div className={styles.tela}>
        {cabecalho}
        <MensagemErro erro={aviso.error} />
        <Botao variante="secundario" onClick={() => navegar(`${base}/avisos`)}>
          Ver os avisos
        </Botao>
      </div>
    )
  }

  const { grupo } = aviso.data
  const recebido = grupo.recebido ?? 1
  const cor = nomeDaCor(grupo.fita.cor)
  return (
    <div className={styles.tela}>
      {cabecalho}
      <section className={styles.cartao} aria-label="Produto">
        <span className={styles.nomeProduto}>{grupo.produto.nome}</span>
        <AmostraFita fita={grupo.fita} data={grupo.referencia} rotuloData="data mais próxima" />
        <span className={styles.ajuda}>
          Zona <strong>{cor}</strong> · {grupo.fita.bimestre} · {recebido} un. recebidas
        </span>
      </section>
      <p className={styles.instrucao}>Vá à zona {cor} da gôndola e conte as unidades que vão para a oferta.</p>
      <Contador
        valor={contagem}
        min={1}
        max={recebido}
        rotulo="Unidades separadas"
        tamanho="conferencia"
        aoMudar={setContagem}
      />
      {contagem === recebido && <p className={styles.ajuda}>Máximo: {recebido}, o que foi recebido nos lotes.</p>}

      <div className={styles.acoes}>
        <Botao onClick={() => navegar(`${base}/avisos/${avisoId}/publicar?separado=${contagem}`)}>Continuar para publicar</Botao>
        <Botao variante="secundario" onClick={() => setFolha('adiar')}>
          Adiar aviso
        </Botao>
        <button type="button" className={styles.link} onClick={() => setFolha('descartar')}>
          Não vai para oferta
        </button>
      </div>

      <FolhaAdiar aberta={folha === 'adiar'} aviso={aviso.data} aoFechar={() => setFolha(null)} />
      <FolhaDescartar aberta={folha === 'descartar'} aviso={aviso.data} aoFechar={() => setFolha(null)} />
    </div>
  )
}

// ---------- L8 · Adiar ----------

function FolhaAdiar({ aberta, aviso, aoFechar }: { aberta: boolean; aviso: AvisoDetalhe; aoFechar: () => void }) {
  const api = useApi()
  const consultas = useQueryClient()
  const navegar = useNavigate()
  const mostrarToast = useToast()
  const desktop = useEhDesktop()
  const { lojaId } = useLojaAtual()
  const hoje = hojeEmBrasilia(useAgora(60_000))
  const limite = aviso.adiar_ate_max
  const opcoes = [
    { rotulo: 'Amanhã', data: somarDias(hoje, 1) },
    { rotulo: 'Em 2 dias', data: somarDias(hoje, 2) },
    { rotulo: 'Em 3 dias', data: somarDias(hoje, 3) },
  ]
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [outraData, setOutraData] = useState('')
  const [escolhendoData, setEscolhendoData] = useState(false)
  const ate = escolhendoData ? outraData : escolhida
  const { grupo } = aviso

  const adiar = useMutation({
    mutationFn: (data: string) => api.lotes.adiarAviso(lojaId, grupo.id, data),
    onSuccess: (_g, data) => {
      invalidarAvisos(consultas, lojaId)
      mostrarToast(`Aviso adiado para ${formatarDataCurta(data)}.`)
      navegar(`/loja/${lojaId}/avisos`)
    },
  })

  return (
    <FolhaInferior forma={desktop ? 'modal' : 'folha'} aberta={aberta} titulo="Lembrar de novo quando?" aoFechar={aoFechar}>
      <p className={styles.ajuda}>
        {grupo.produto.nome} · zona {nomeDaCor(grupo.fita.cor)} · vence {formatarData(grupo.referencia)}
      </p>
      <div role="group" aria-label="Adiar até" className={styles.gradeOpcoes}>
        {opcoes.map((o) => {
          const depoisDoLimite = o.data > limite // o limite vem da API (véspera do último dia)
          return (
            <button
              key={o.rotulo}
              type="button"
              disabled={depoisDoLimite}
              aria-pressed={!escolhendoData && escolhida === o.data}
              className={classes(styles.ladrilho, !escolhendoData && escolhida === o.data && styles.ladrilhoAtivo)}
              onClick={() => {
                setEscolhendoData(false)
                setEscolhida(o.data)
                adiar.reset()
              }}
            >
              {o.rotulo}
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={escolhendoData}
          disabled={somarDias(hoje, 1) > limite}
          className={classes(styles.ladrilho, escolhendoData && styles.ladrilhoAtivo)}
          onClick={() => {
            setEscolhendoData(true)
            adiar.reset()
          }}
        >
          Escolher data
        </button>
      </div>
      {escolhendoData && (
        <label className={styles.campo}>
          <span className={styles.rotulo}>Data</span>
          <input
            type="date"
            className={styles.busca}
            min={somarDias(hoje, 1)}
            max={limite}
            value={outraData}
            onChange={(e) => setOutraData(e.target.value)}
          />
        </label>
      )}
      <p className={styles.ajuda}>
        Até {formatarDataCurta(limite)}. Depois disso não dá tempo de ofertar: a oferta sai da vitrine{' '}
        {formatarHorario(aviso.fim_previsto)}.
      </p>
      {adiar.isError && <MensagemErro erro={adiar.error} />}
      <Botao disabled={!ate} carregando={adiar.isPending} textoCarregando="Adiando…" onClick={() => ate && adiar.mutate(ate)}>
        Adiar aviso
      </Botao>
    </FolhaInferior>
  )
}

// ---------- Não vai para oferta ----------

const MOTIVOS: { valor: MotivoDescarte; rotulo: string }[] = [
  { valor: 'sem_unidades', rotulo: 'Não sobrou nenhuma unidade' },
  { valor: 'outro_destino', rotulo: 'Outro destino' },
]

function FolhaDescartar({ aberta, aviso, aoFechar }: { aberta: boolean; aviso: AvisoDetalhe; aoFechar: () => void }) {
  const api = useApi()
  const consultas = useQueryClient()
  const navegar = useNavigate()
  const mostrarToast = useToast()
  const desktop = useEhDesktop()
  const { lojaId } = useLojaAtual()
  const [motivo, setMotivo] = useState<MotivoDescarte | null>(null)

  const descartar = useMutation({
    mutationFn: (m: MotivoDescarte) => api.lotes.descartarAviso(lojaId, aviso.grupo.id, m),
    onSuccess: () => {
      invalidarAvisos(consultas, lojaId)
      mostrarToast('Aviso encerrado sem oferta.')
      navegar(`/loja/${lojaId}/avisos`)
    },
  })

  return (
    <FolhaInferior forma={desktop ? 'modal' : 'folha'} aberta={aberta} titulo="Não vai para oferta" aoFechar={aoFechar}>
      <p className={styles.ajuda}>{aviso.grupo.produto.nome}</p>
      <fieldset className={styles.semBorda}>
        <legend className={styles.rotulo}>Motivo</legend>
        {MOTIVOS.map((m) => (
          <label key={m.valor} className={styles.opcao}>
            <input type="radio" name="motivo-descarte" checked={motivo === m.valor} onChange={() => setMotivo(m.valor)} />
            {m.rotulo}
          </label>
        ))}
      </fieldset>
      <p className={styles.ajuda}>O aviso é encerrado sem criar oferta. Isso não conta como perda no painel.</p>
      {descartar.isError && <MensagemErro erro={descartar.error} />}
      <Botao
        variante="perigo"
        disabled={!motivo}
        carregando={descartar.isPending}
        textoCarregando="Encerrando…"
        onClick={() => motivo && descartar.mutate(motivo)}
      >
        Encerrar aviso
      </Botao>
    </FolhaInferior>
  )
}
