import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useApi } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { Botao, BotaoIcone } from '../../componentes/Botao'
import { Campo } from '../../componentes/Campo'
import { Contador } from '../../componentes/Contador'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { IconeVoltar } from '../../componentes/icones'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { useToast } from '../../componentes/toast/contexto'
import { codigoDoErro } from '../../util/erros'
import styles from './Loja.module.css'

const MOTIVOS = ['Danificada', 'Extraviada', 'Vendida no balcão', 'Outro'] as const
type Motivo = (typeof MOTIVOS)[number]

/** L11 · Ajuste de estoque: só tira do LIVRE, com motivo. O 409 da API vira mensagem aqui mesmo. */
export function L11Ajuste() {
  const api = useApi()
  const consultas = useQueryClient()
  const navegar = useNavigate()
  const mostrarToast = useToast()
  const { lojaId } = useLojaAtual()
  const id = Number(useParams().ofertaId)
  const [quantidade, setQuantidade] = useState(1)
  const [motivo, setMotivo] = useState<Motivo | null>(null)
  const [outro, setOutro] = useState('')
  // Livre informado pelo 409; vale só até a próxima resposta da API sobre a oferta.
  const [doErro, setDoErro] = useState<{ livre: number; em: number } | null>(null)

  const consulta = useQuery({ queryKey: ['loja-oferta', lojaId, id], queryFn: () => api.operacao.obterOferta(lojaId, id) })
  const voltar = () => navegar(`/loja/${lojaId}/ofertas/${id}`)

  const ajustar = useMutation({
    mutationFn: (entrada: { quantidade: number; motivo: string }) => api.operacao.ajustar(lojaId, id, entrada),
    onSuccess: (_resposta, entrada) => {
      void consultas.invalidateQueries({ queryKey: ['loja-oferta', lojaId, id] })
      void consultas.invalidateQueries({ queryKey: ['loja-ofertas', lojaId] })
      void consultas.invalidateQueries({ queryKey: ['resumo', lojaId] })
      mostrarToast(`Ajuste registrado: ${entrada.quantidade} un. (${entrada.motivo}).`)
      voltar()
    },
    onError: (erro) => {
      if (codigoDoErro(erro) === 'acima_do_livre') {
        // Alguém reservou enquanto a pessoa contava: o corpo do 409 traz o livre de agora.
        const corpo = (erro as { corpo?: { livre?: number } }).corpo
        if (typeof corpo?.livre === 'number') setDoErro({ livre: corpo.livre, em: Date.now() })
        void consultas.invalidateQueries({ queryKey: ['loja-oferta', lojaId, id] })
      }
    },
  })

  const cabecalho = (
    <header className={styles.cabecalhoDetalhe}>
      <BotaoIcone rotulo="Voltar para a oferta" onClick={voltar}>
        <IconeVoltar />
      </BotaoIcone>
      <div className={styles.textosCabecalho}>
        <h1 className={styles.tituloTela}>Ajustar estoque</h1>
        {consulta.data && <span className={styles.texto}>{consulta.data.produto.nome}</span>}
      </div>
    </header>
  )

  if (consulta.isPending) return <EsqueletoLista quantidade={1} rotulo="Carregando oferta…" />
  if (consulta.isError) {
    return (
      <div className={styles.tela}>
        {cabecalho}
        <MensagemErro erro={consulta.error} />
      </div>
    )
  }

  const { estoque } = consulta.data
  const livre = doErro && consulta.dataUpdatedAt < doErro.em ? Math.min(estoque.livre, doErro.livre) : estoque.livre
  if (consulta.data.estado !== 'ativa' || livre === 0) {
    return (
      <div className={styles.tela}>
        {cabecalho}
        <Mensagem tipo="info">
          {consulta.data.estado !== 'ativa' ? 'Esta oferta já terminou.' : 'Não há unidades livres para ajustar agora.'}
        </Mensagem>
      </div>
    )
  }

  const qtd = Math.max(1, Math.min(quantidade, livre))
  const textoMotivo = motivo === 'Outro' ? outro.trim() : motivo
  const podeEnviar = Boolean(textoMotivo)

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (textoMotivo) ajustar.mutate({ quantidade: qtd, motivo: textoMotivo })
  }

  return (
    <form className={styles.tela} onSubmit={enviar} noValidate>
      {cabecalho}
      <Mensagem tipo="info">
        Só dá para tirar do estoque livre ({livre} un.).{' '}
        {estoque.reservado > 0 &&
          `As ${estoque.reservado} unidades reservadas estão prometidas a clientes e não entram no ajuste.`}
      </Mensagem>

      <Contador valor={qtd} min={1} max={livre} aoMudar={setQuantidade} rotulo="Unidades a tirar" tamanho="ajuste" />
      {qtd === livre && <p className={styles.texto}>Máximo: {livre}, o estoque livre agora.</p>}

      <fieldset className={styles.grupoMotivo}>
        <legend className={styles.rotuloForm}>Motivo (obrigatório)</legend>
        <div className={styles.gradeMotivo}>
          {MOTIVOS.map((m) => (
            <label key={m} className={styles.opcaoMotivo}>
              <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} />
              {m}
            </label>
          ))}
        </div>
      </fieldset>
      {motivo === 'Outro' && (
        <Campo rotulo="Qual o motivo?" value={outro} onChange={(e) => setOutro(e.target.value)} maxLength={120} />
      )}

      {ajustar.isError && <MensagemErro erro={ajustar.error} />}

      <div className={styles.rodapeAjuste}>
        {/* Prévia, como na C4: o estoque oficial é o que a API devolve depois. */}
        <p className={styles.texto}>
          Depois do ajuste: livre {livre - qtd} · ajustado {estoque.ajustado + qtd}
        </p>
        <Botao type="submit" disabled={!podeEnviar} carregando={ajustar.isPending} textoCarregando="Registrando…">
          Registrar ajuste de {qtd} un.
        </Botao>
      </div>
    </form>
  )
}
