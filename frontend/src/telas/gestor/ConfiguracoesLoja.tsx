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
import { MensagemErro } from '../../componentes/Mensagem'
import { Selo } from '../../componentes/Selo'
import { useToast } from '../../componentes/toast/contexto'
import { classes } from '../../util/classes'
import { codigoDoErro } from '../../util/erros'
import styles from './Configuracoes.module.css'

const JANELAS = [1, 2, 4, 8, 12, 24] as const
const PAPEIS: { valor: Papel; rotulo: string }[] = [
  { valor: 'funcionario', rotulo: 'Funcionário' },
  { valor: 'responsavel', rotulo: 'Responsável' },
]
const rotuloPapel = (p: Papel) => PAPEIS.find((x) => x.valor === p)!.rotulo

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
  const { lojaId } = useLojaAtual()
  const loja = useQuery({ queryKey: ['loja-config', lojaId], queryFn: () => api.configuracao.obterLoja(lojaId) })
  // null = sem edição; o formulário mostra o que a API devolveu.
  const [rascunho, setRascunho] = useState<Editaveis | null>(null)

  const salvar = useMutation({
    mutationFn: (campos: Partial<Editaveis>) => api.configuracao.atualizarLoja(lojaId, campos),
    onSuccess: (nova, campos) => {
      consultas.setQueryData(['loja-config', lojaId], nova)
      setRascunho(null)
      if ('nome' in campos) recarregarEu() // o nome aparece no menu e no cabeçalho
      mostrarToast('Configurações salvas.')
    },
  })

  if (loja.isPending) return <EsqueletoLista quantidade={3} rotulo="Carregando configurações…" />
  if (loja.isError) return <MensagemErro erro={loja.error} />

  const salvo = loja.data
  const form: Editaveis = rascunho ?? salvo
  const mudancas = diferencas(salvo, form)
  const mudou = Object.keys(mudancas).length > 0
  const editar = (parte: Partial<Editaveis>) => {
    salvar.reset()
    setRascunho({ ...form, ...parte })
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (mudou) salvar.mutate(mudancas)
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
            rotulo="Endereço"
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
          <div className={styles.textoBarra}>
            <strong>Alterações não salvas</strong>
            {salvar.isError && <MensagemErro erro={salvar.error} />}
          </div>
          <div className={styles.acoesBarra}>
            <Botao variante="secundario" larguraTotal={false} onClick={() => setRascunho(null)} disabled={salvar.isPending}>
              Descartar
            </Botao>
            <Botao
              type="submit"
              form="form-config"
              larguraTotal={false}
              carregando={salvar.isPending}
              textoCarregando="Salvando…"
            >
              Salvar alterações
            </Botao>
          </div>
        </div>
      )}
    </div>
  )
}

function Localizacao({ salvo, enderecoMudou }: { salvo: LojaConfig; enderecoMudou: boolean }) {
  // A busca da coordenada pelo endereço (Nominatim) entra na F8; até lá, só informa.
  if (enderecoMudou) {
    return (
      <p className={styles.ajuda}>
        A localização do endereço novo ainda não é buscada: a distância continua calculada pelo endereço anterior.
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

function Equipe({ lojaId }: { lojaId: number }) {
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
                          <SeloPapel vinculo={v} />
                        </>
                      )}
                    </span>
                  </span>
                </td>
                {desktop && <td>{v.usuario.email}</td>}
                {desktop && (
                  <td>
                    <SeloPapel vinculo={v} />
                  </td>
                )}
                <td className={styles.colunaAcao}>
                  {!v.eu && (
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

      <AdicionarPessoa lojaId={lojaId} />
      <p className={styles.ajuda}>A pessoa precisa ter criado a conta antes. Uma pessoa tem no máximo um vínculo por loja.</p>

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

/** PEDIDO-API 4: trocar o papel de alguém (o select da G6) não tem rota no contrato; por ora, só o selo. */
function SeloPapel({ vinculo: v }: { vinculo: VinculoLoja }) {
  return (
    <Selo variante={v.papel === 'responsavel' ? 'primary' : 'neutral'}>
      {rotuloPapel(v.papel)}
      {v.eu && ' · você'}
    </Selo>
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
