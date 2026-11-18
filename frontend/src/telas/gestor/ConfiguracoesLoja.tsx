import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import type { LojaConfig, Papel, VinculoLoja } from '../../api'
import { useApi, useSessao } from '../../app/contextos'
import { useLojaAtual } from '../../app/loja'
import { useEhDesktop } from '../../app/tela'
import { Botao } from '../../componentes/Botao'
import { Campo } from '../../componentes/Campo'
import { Contador } from '../../componentes/Contador'
import { Esqueleto, EsqueletoLista } from '../../componentes/Esqueleto'
import { FolhaInferior } from '../../componentes/FolhaInferior'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { Selo } from '../../componentes/Selo'
import { useToast } from '../../componentes/toast/contexto'
import { TextoConfirmacao, useBuscaNoMapa } from '../../localizacao/BuscaNoMapa'
import { classes } from '../../util/classes'
import { codigoDoErro } from '../../util/erros'
import styles from './Configuracoes.module.css'

const JANELAS = [1, 2, 4, 8, 12, 24] as const
const PAPEIS: { valor: Papel; rotulo: string }[] = [
  { valor: 'funcionario', rotulo: 'Funcionário' },
  { valor: 'responsavel', rotulo: 'Responsável' },
]
const rotuloPapel = (p: Papel) => PAPEIS.find((x) => x.valor === p)!.rotulo

const ID_ENDERECO = 'config-endereco'

type Editaveis = Pick<LojaConfig, 'nome' | 'endereco' | 'janela_padrao_horas' | 'margem_fim_dias' | 'antecedencia_aviso_dias'>
const CAMPOS: (keyof Editaveis)[] = ['nome', 'endereco', 'janela_padrao_horas', 'margem_fim_dias', 'antecedencia_aviso_dias']

/** Só o que mudou vai no PATCH (o contrato aceita PATCH parcial). */
function diferencas(salvo: LojaConfig, rascunho: Editaveis): Partial<Editaveis> {
  const d: Partial<Editaveis> = {}
  for (const c of CAMPOS) if (rascunho[c] !== salvo[c]) (d as Record<string, unknown>)[c] = rascunho[c]
  return d
}

/**
 * L14 (celular) e G6 (computador) · Configurações da loja — uma tela só, que se reorganiza
 * pela largura. Dados e regras são salvos juntos pela barra "Alterações não salvas";
 * a equipe muda na hora (cada ação é uma chamada própria do contrato).
 */
export function ConfiguracoesLoja() {
  const api = useApi()
  const consultas = useQueryClient()
  const { recarregarEu } = useSessao()
  const mostrarToast = useToast()
  const { lojaId, papel } = useLojaAtual()
  const loja = useQuery({ queryKey: ['loja-config', lojaId], queryFn: () => api.configuracao.obterLoja(lojaId) })
  // null = sem edição; o formulário mostra o que a API devolveu.
  const [rascunho, setRascunho] = useState<Editaveis | null>(null)
  // Endereço novo: antes de salvar, a pessoa confirma onde o mapa achou (ou salva sem localização).
  const mapa = useBuscaNoMapa()
  const { confirmacao } = mapa

  const salvar = useMutation({
    mutationFn: (campos: Partial<Omit<LojaConfig, 'id'>>) => api.configuracao.atualizarLoja(lojaId, campos),
    onSuccess: (nova, campos) => {
      consultas.setQueryData(['loja-config', lojaId], nova)
      setRascunho(null)
      mapa.limpar()
      if ('nome' in campos) recarregarEu() // o nome aparece no menu e no cabeçalho
      mostrarToast('Configurações salvas.')
    },
  })

  if (loja.isPending) return <EsqueletoLista quantidade={3} rotulo="Carregando configurações…" />
  if (loja.isError) return <MensagemErro erro={loja.error} />
  // Funcionária: consulta, sem editar (decidido 14/11/2026). A API também recusa (403).
  if (papel !== 'responsavel') return <ConfiguracoesSoLeitura loja={loja.data} lojaId={lojaId} />

  const salvo = loja.data
  const form: Editaveis = rascunho ?? salvo
  const mudancas = diferencas(salvo, form)
  const mudou = Object.keys(mudancas).length > 0
  const editar = (parte: Partial<Editaveis>) => {
    salvar.reset()
    mapa.limpar()
    setRascunho({ ...form, ...parte })
  }
  const descartar = () => {
    mapa.limpar()
    setRascunho(null)
  }
  const corrigirEndereco = () => {
    mapa.limpar()
    document.getElementById(ID_ENDERECO)?.focus()
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!mudou) return
    // Endereço mudou: primeiro o mapa; a coordenada vai junto no PATCH (latitude e longitude juntas).
    if ('endereco' in mudancas) mapa.buscar(form.endereco)
    else salvar.mutate(mudancas)
  }

  return (
    <div className={styles.tela}>
      <header>
        <h1 className={styles.titulo}>Configurações da loja</h1>
        <p className={styles.subtitulo}>Mudanças valem para lotes e ofertas novos.</p>
      </header>

      <form id="form-config" className={styles.duasColunas} onSubmit={enviar} noValidate>
        <section className={styles.cartao} aria-labelledby="titulo-dados">
          <h2 id="titulo-dados" className={styles.tituloCartao}>
            Dados da loja
          </h2>
          <Campo rotulo="Nome" value={form.nome} maxLength={120} onChange={(e) => editar({ nome: e.target.value })} />
          <Campo
            id={ID_ENDERECO}
            rotulo="Endereço"
            dica="Rua, número, bairro e cidade"
            value={form.endereco}
            maxLength={255}
            onChange={(e) => editar({ endereco: e.target.value })}
          />
          <Localizacao salvo={salvo} enderecoMudou={form.endereco !== salvo.endereco} />
        </section>

        <section className={styles.cartao} aria-labelledby="titulo-regras">
          <div className={styles.cabecalhoCartao}>
            <h2 id="titulo-regras" className={styles.tituloCartao}>
              Regras das ofertas
            </h2>
            <Link to={`/loja/${lojaId}/projecao`} className={styles.link}>
              Ver projeção
            </Link>
          </div>
          <div className={styles.campo}>
            <span id="rotulo-janela" className={styles.rotulo}>
              Janela de reserva padrão
            </span>
            <div role="group" aria-labelledby="rotulo-janela" className={styles.gradeJanelas}>
              {JANELAS.map((j) => (
                <button
                  key={j}
                  type="button"
                  aria-pressed={form.janela_padrao_horas === j}
                  className={classes(styles.ladrilho, form.janela_padrao_horas === j && styles.ladrilhoAtivo)}
                  onClick={() => editar({ janela_padrao_horas: j })}
                >
                  {j} h
                </button>
              ))}
            </div>
          </div>
          <div className={styles.linhaContador}>
            <div>
              <span className={styles.rotulo}>Margem antes da validade</span>
              <span className={styles.ajuda}>A oferta sai da vitrine esse tempo antes · em dias</span>
            </div>
            <Contador
              valor={form.margem_fim_dias}
              min={0}
              max={7}
              rotulo="Margem antes da validade, em dias"
              tamanho="cadastro"
              aoMudar={(v) => editar({ margem_fim_dias: v })}
            />
          </div>
          <div className={styles.linhaContador}>
            <div>
              <span className={styles.rotulo}>Antecedência do aviso</span>
              <span className={styles.ajuda}>Dias antes da validade para conferir</span>
            </div>
            <Contador
              valor={form.antecedencia_aviso_dias}
              min={1}
              max={30}
              rotulo="Antecedência do aviso, em dias"
              tamanho="cadastro"
              aoMudar={(v) => editar({ antecedencia_aviso_dias: v })}
            />
          </div>
        </section>
      </form>

      <Equipe lojaId={lojaId} />

      {/* Só aparece quando há mudança; o erro da API (ex.: antecedência ≤ margem) fica aqui. */}
      {mudou && (
        <div className={styles.barraSalvar} role="region" aria-label="Alterações não salvas">
          <div className={styles.textoBarra} aria-live="polite">
            {confirmacao ? <TextoConfirmacao confirmacao={confirmacao} /> : <strong>Alterações não salvas</strong>}
            {mapa.erro && <MensagemErro erro={mapa.erro} />}
            {salvar.isError && <MensagemErro erro={salvar.error} />}
          </div>
          <div className={styles.acoesBarra}>
            {confirmacao ? (
              <>
                <Botao variante="secundario" larguraTotal={false} onClick={corrigirEndereco} disabled={salvar.isPending}>
                  Corrigir endereço
                </Botao>
                <Botao
                  larguraTotal={false}
                  carregando={salvar.isPending}
                  textoCarregando="Salvando…"
                  onClick={() =>
                    salvar.mutate({ ...mudancas, ...mapa.coordenadas(confirmacao) })
                  }
                >
                  {confirmacao.tipo === 'encontrado' ? 'Salvar com esta localização' : 'Salvar sem localização'}
                </Botao>
              </>
            ) : (
              <>
                <Botao
                  variante="secundario"
                  larguraTotal={false}
                  onClick={descartar}
                  disabled={salvar.isPending || mapa.buscando}
                >
                  Descartar
                </Botao>
                <Botao
                  type="submit"
                  form="form-config"
                  larguraTotal={false}
                  carregando={salvar.isPending || mapa.buscando}
                  textoCarregando={mapa.buscando ? 'Buscando no mapa…' : 'Salvando…'}
                >
                  Salvar alterações
                </Botao>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Localizacao({ salvo, enderecoMudou }: { salvo: LojaConfig; enderecoMudou: boolean }) {
  if (enderecoMudou) {
    return (
      <p className={styles.ajuda}>
        Ao salvar, buscamos o endereço novo no mapa (OpenStreetMap) para calcular a distância até os clientes.
      </p>
    )
  }
  if (salvo.latitude === null) {
    return <p className={styles.ajuda}>Sem localização: a loja aparece no fim da lista ordenada por distância.</p>
  }
  return (
    <p className={styles.localizacao}>
      <span aria-hidden="true">✓</span> Localização encontrada · usada para calcular a distância
    </p>
  )
}

// ---------- Equipe ----------

function Equipe({ lojaId, podeEditar = true }: { lojaId: number; podeEditar?: boolean }) {
  const api = useApi()
  const consultas = useQueryClient()
  const mostrarToast = useToast()
  const desktop = useEhDesktop()
  const vinculos = useQuery({ queryKey: ['vinculos', lojaId], queryFn: () => api.configuracao.listarVinculos(lojaId) })
  const [removendo, setRemovendo] = useState<VinculoLoja | null>(null)

  const remover = useMutation({
    mutationFn: (v: VinculoLoja) => api.configuracao.removerVinculo(lojaId, v.id),
    onSuccess: (_r, v) => {
      void consultas.invalidateQueries({ queryKey: ['vinculos', lojaId] })
      setRemovendo(null)
      mostrarToast(`${v.usuario.nome} saiu da equipe.`)
    },
  })

  return (
    <section className={styles.cartao} aria-labelledby="titulo-equipe">
      <h2 id="titulo-equipe" className={styles.tituloCartao}>
        Equipe
      </h2>
      {vinculos.isError ? (
        <MensagemErro erro={vinculos.error} />
      ) : vinculos.isPending ? (
        <Esqueleto altura={120} />
      ) : (
        <table className={styles.tabela}>
          <caption className="so-leitor">Equipe da loja</caption>
          <thead className={desktop ? undefined : 'so-leitor'}>
            <tr>
              <th scope="col">Pessoa</th>
              {desktop && <th scope="col">E-mail da conta</th>}
              {desktop && <th scope="col">Papel</th>}
              <th scope="col">
                <span className="so-leitor">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {vinculos.data.map((v) => (
              <tr key={v.id}>
                <td>
                  <span className={styles.pessoa}>
                    <span className={styles.avatar} aria-hidden="true">
                      {iniciais(v.usuario.nome)}
                    </span>
                    <span>
                      <span className={styles.nome}>{v.usuario.nome}</span>
                      {!desktop && (
                        <>
                          <span className={styles.ajuda}>{v.usuario.email}</span>
                          <PapelNaEquipe vinculo={v} lojaId={lojaId} podeEditar={podeEditar} />
                        </>
                      )}
                    </span>
                  </span>
                </td>
                {desktop && <td>{v.usuario.email}</td>}
                {desktop && (
                  <td>
                    <PapelNaEquipe vinculo={v} lojaId={lojaId} podeEditar={podeEditar} />
                  </td>
                )}
                <td className={styles.colunaAcao}>
                  {podeEditar && !v.eu && (
                    <button
                      type="button"
                      className={styles.botaoRemover}
                      aria-label={`Remover ${v.usuario.nome}`}
                      onClick={() => {
                        remover.reset()
                        setRemovendo(v)
                      }}
                    >
                      Remover
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {podeEditar && (
        <>
          <AdicionarPessoa lojaId={lojaId} />
          <p className={styles.ajuda}>A pessoa precisa ter criado a conta antes. Uma pessoa tem no máximo um vínculo por loja.</p>
        </>
      )}

      <FolhaInferior
        forma={desktop ? 'modal' : 'folha'}
        aberta={removendo !== null}
        titulo={removendo ? `Remover ${removendo.usuario.nome} da equipe?` : ''}
        aoFechar={() => setRemovendo(null)}
      >
        <p>A conta continua existindo: a pessoa só perde o acesso a esta loja e volta a ser consumidora.</p>
        {remover.isError && <MensagemErro erro={remover.error} />}
        <div className={styles.acoesBarra}>
          <Botao variante="secundario" onClick={() => setRemovendo(null)}>
            Cancelar
          </Botao>
          <Botao
            variante="perigoSolido"
            carregando={remover.isPending}
            textoCarregando="Removendo…"
            onClick={() => removendo && remover.mutate(removendo)}
          >
            Remover
          </Botao>
        </div>
      </FolhaInferior>
    </section>
  )
}

function AdicionarPessoa({ lojaId }: { lojaId: number }) {
  const api = useApi()
  const consultas = useQueryClient()
  const mostrarToast = useToast()
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<Papel>('funcionario')

  const adicionar = useMutation({
    mutationFn: () => api.configuracao.criarVinculo(lojaId, { email: email.trim(), papel }),
    onSuccess: (v) => {
      void consultas.invalidateQueries({ queryKey: ['vinculos', lojaId] })
      setEmail('')
      mostrarToast(`${v.usuario.nome} entrou na equipe (${rotuloPapel(v.papel)}).`)
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (email.trim()) adicionar.mutate()
  }

  // Os erros do e-mail (conta inexistente, já na equipe, inválido) ficam no próprio campo.
  const erroEmail = adicionar.isError && codigoDoErro(adicionar.error) !== 'papel_invalido' ? adicionar.error.message : null

  return (
    <form className={styles.adicionar} onSubmit={enviar} noValidate aria-labelledby="titulo-adicionar">
      <span id="titulo-adicionar" className={styles.rotulo}>
        Adicionar pessoa pelo e-mail da conta
      </span>
      <div className={styles.linhaAdicionar}>
        <div className={styles.campoEmail}>
          <Campo
            rotulo="E-mail da conta"
            type="email"
            autoComplete="off"
            value={email}
            erro={erroEmail}
            onChange={(e) => {
              adicionar.reset()
              setEmail(e.target.value)
            }}
          />
        </div>
        <label className={styles.campoPapel}>
          <span className={styles.rotulo}>Papel</span>
          <select value={papel} onChange={(e) => setPapel(e.target.value as Papel)} className={styles.select}>
            {PAPEIS.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>
        <Botao type="submit" larguraTotal={false} disabled={!email.trim()} carregando={adicionar.isPending} textoCarregando="Adicionando…">
          Adicionar à equipe
        </Botao>
      </div>
    </form>
  )
}

/**
 * Papel na equipe: selo para você; `select` para os outros (PEDIDO-API 4, aceito em 13/11/2026:
 * PATCH …/vinculos/{id}). Os limites (último responsável, o próprio acesso) vêm da API.
 */
function PapelNaEquipe(props: { vinculo: VinculoLoja; lojaId: number; podeEditar: boolean }) {
  const { vinculo: v, lojaId, podeEditar } = props
  const api = useApi()
  const consultas = useQueryClient()
  const mostrarToast = useToast()
  const alterar = useMutation({
    mutationFn: (papel: Papel) => api.configuracao.alterarPapel(lojaId, v.id, papel),
    onSuccess: (novo) => {
      void consultas.invalidateQueries({ queryKey: ['vinculos', lojaId] })
      mostrarToast(`${novo.usuario.nome} agora é ${rotuloPapel(novo.papel)}.`)
    },
  })

  if (v.eu || !podeEditar) {
    return (
      <Selo variante={v.papel === 'responsavel' ? 'primary' : 'neutral'}>
        {rotuloPapel(v.papel)}
        {v.eu && ' · você'}
      </Selo>
    )
  }
  return (
    <span className={styles.papel}>
      <select
        aria-label={`Papel de ${v.usuario.nome}`}
        className={styles.selectPapel}
        value={v.papel}
        disabled={alterar.isPending}
        onChange={(e) => alterar.mutate(e.target.value as Papel)}
      >
        {PAPEIS.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.rotulo}
          </option>
        ))}
      </select>
      {alterar.isError && <MensagemErro erro={alterar.error} />}
    </span>
  )
}

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`

/**
 * L14/G6 para quem não é responsável (decidido 14/11/2026): em mercadinho pequeno, quem
 * atende o balcão costuma ser o mesmo que gerencia, então a funcionária consulta tudo,
 * sem editar. Os valores são os que a API devolveu; não há nada para salvar.
 */
function ConfiguracoesSoLeitura({ loja, lojaId }: { loja: LojaConfig; lojaId: number }) {
  return (
    <div className={styles.tela}>
      <header>
        <h1 className={styles.titulo}>Configurações da loja</h1>
        <p className={styles.subtitulo}>Mudanças valem para lotes e ofertas novos.</p>
      </header>
      <Mensagem tipo="info">Só o responsável da loja muda estas configurações. Aqui você consulta.</Mensagem>

      <div className={styles.duasColunas}>
        <section className={styles.cartao} aria-labelledby="titulo-dados">
          <h2 id="titulo-dados" className={styles.tituloCartao}>
            Dados da loja
          </h2>
          <dl className={styles.valores}>
            <div>
              <dt className={styles.rotulo}>Nome</dt>
              <dd>{loja.nome}</dd>
            </div>
            <div>
              <dt className={styles.rotulo}>Endereço</dt>
              <dd>{loja.endereco}</dd>
            </div>
          </dl>
          <Localizacao salvo={loja} enderecoMudou={false} />
        </section>

        <section className={styles.cartao} aria-labelledby="titulo-regras">
          <h2 id="titulo-regras" className={styles.tituloCartao}>
            Regras das ofertas
          </h2>
          <dl className={styles.valores}>
            <div>
              <dt className={styles.rotulo}>Janela de reserva padrão</dt>
              <dd>{loja.janela_padrao_horas} h</dd>
            </div>
            <div>
              <dt className={styles.rotulo}>Margem antes da validade</dt>
              <dd>{dias(loja.margem_fim_dias)}</dd>
            </div>
            <div>
              <dt className={styles.rotulo}>Antecedência do aviso</dt>
              <dd>{dias(loja.antecedencia_aviso_dias)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <Equipe lojaId={lojaId} podeEditar={false} />
    </div>
  )
}
