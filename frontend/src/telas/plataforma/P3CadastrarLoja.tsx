import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { ConsultaCnpj, EntradaLojaPlataforma, Interesse, LojaCadastrada } from '../../api'
import { ehErroApi } from '../../api'
import { useApi } from '../../app/contextos'
import { Botao } from '../../componentes/Botao'
import { Campo } from '../../componentes/Campo'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { Selo } from '../../componentes/Selo'
import { TextoConfirmacao } from '../../localizacao/TextoConfirmacao'
import { useBuscaNoMapa } from '../../localizacao/useBuscaNoMapa'
import { cnpjValido, mascararCnpj, soDigitos } from '../../util/cnpj'
import { codigoDoErro, mensagemDeErro } from '../../util/erros'
import { CompartilharConvite } from './CompartilharConvite'
import styles from './Plataforma.module.css'

const ID_ENDERECO = 'p3-endereco'

/** Endereço da Receita numa linha só (padrão do campo; a equipe pode corrigir). */
function enderecoDaReceita({ endereco: e }: ConsultaCnpj): string {
  const rua = [e.logradouro, e.numero].filter(Boolean).join(', ')
  return [rua, e.bairro, e.municipio && `${e.municipio}/${e.uf}`].filter(Boolean).join(' · ')
}

/** Dados da loja (passo 2). */
interface Dados {
  nome: string
  endereco: string
  telefone: string
  email_responsavel: string
}

/**
 * P3 · Plataforma · Cadastrar loja, em 2 passos: CNPJ (conferido na Receita) → dados da loja.
 * Vindo da P1 (?interesse=), nome, telefone e e-mail chegam preenchidos pelo pedido.
 * Resultado: o convite pronto para mandar por WhatsApp.
 */
export function P3CadastrarLoja() {
  const api = useApi()
  const [parametros] = useSearchParams()
  const interesseId = Number(parametros.get('interesse')) || undefined
  // O pedido da P1, para preencher o passo 2 (a lista já está em cache quando vem de lá).
  const interesses = useQuery({
    queryKey: ['plataforma', 'interesses', 'todos'],
    queryFn: () => api.parceria.listarInteresses(),
    enabled: interesseId !== undefined,
  })
  const interesse = interesses.data?.find((i) => i.id === interesseId)

  const [passo, setPasso] = useState<1 | 2>(1)
  const [cnpj, setCnpj] = useState('')
  const [consulta, setConsulta] = useState<ConsultaCnpj | null>(null)
  const [resultado, setResultado] = useState<LojaCadastrada | null>(null)

  if (resultado) return <Resultado resultado={resultado} />

  return (
    <div className={styles.tela}>
      <header className={styles.cabecalho}>
        <div>
          <span className={styles.passos}>Passo {passo} de 2 · {passo === 1 ? 'CNPJ' : 'Dados da loja'}</span>
          <h1 className={styles.titulo}>Cadastrar loja</h1>
          {interesse && (
            <p className={styles.subtitulo}>
              Pedido de {interesse.pessoa.nome} · {interesse.nome_mercado}, {interesse.cidade}
            </p>
          )}
        </div>
      </header>
      {passo === 1 ? (
        <PassoCnpj
          cnpj={cnpj}
          aoMudarCnpj={setCnpj}
          aoSeguir={(c) => {
            setConsulta(c)
            setPasso(2)
          }}
        />
      ) : (
        <PassoDados
          cnpj={soDigitos(cnpj)}
          consulta={consulta}
          interesse={interesse}
          interesseId={interesseId}
          aoVoltar={() => setPasso(1)}
          aoCadastrar={setResultado}
        />
      )}
    </div>
  )
}

// ---------- Passo 1: CNPJ ----------

function PassoCnpj({
  cnpj,
  aoMudarCnpj,
  aoSeguir,
}: {
  cnpj: string
  aoMudarCnpj: (v: string) => void
  /** consulta = null: Receita fora do ar, segue para preencher à mão. */
  aoSeguir: (consulta: ConsultaCnpj | null) => void
}) {
  const api = useApi()
  const [erroCampo, setErroCampo] = useState<string | null>(null)
  const consultar = useMutation({ mutationFn: (digitos: string) => api.parceria.consultarCnpj(digitos) })

  const codigo = codigoDoErro(consultar.error)
  const foraDoAr = ehErroApi(consultar.error) && consultar.error.status === 503
  const dados = consultar.data

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!cnpjValido(cnpj)) {
      setErroCampo('CNPJ inválido. Confira os números.')
      return
    }
    consultar.mutate(soDigitos(cnpj))
  }

  return (
    <div className={styles.formulario}>
      <form className={styles.linhaCopiar} onSubmit={enviar} noValidate>
        <Campo
          rotulo="CNPJ"
          inputMode="numeric"
          autoComplete="off"
          placeholder="00.000.000/0000-00"
          className={styles.campoFlexivel}
          value={cnpj}
          onChange={(e) => {
            aoMudarCnpj(mascararCnpj(e.target.value))
            setErroCampo(null)
            consultar.reset()
          }}
          // O erro do backend para o mesmo caso (400 cnpj_invalido) vai para o mesmo lugar.
          erro={erroCampo ?? (codigo === 'cnpj_invalido' ? mensagemDeErro(consultar.error) : null)}
        />
        <Botao type="submit" larguraTotal={false} className={styles.botaoAoLado} carregando={consultar.isPending} textoCarregando="Consultando…">
          Consultar
        </Botao>
      </form>

      {foraDoAr && (
        <>
          <Mensagem tipo="atencao">Não deu para consultar a Receita agora; preencha à mão.</Mensagem>
          <Botao variante="secundario" onClick={() => aoSeguir(null)}>
            Continuar sem a consulta
          </Botao>
        </>
      )}
      {consultar.isError && !foraDoAr && codigo !== 'cnpj_invalido' && <MensagemErro erro={consultar.error} />}

      {dados && (
        <>
          <section className={styles.cartao} aria-label="Dados da Receita">
            <span className={styles.linhaTopo}>
              <span className={styles.principal}>{dados.razao_social}</span>
              <Selo variante={dados.ativa ? 'success' : 'danger'}>{dados.ativa ? 'Ativa' : 'Inativa'}</Selo>
            </span>
            <dl className={styles.receita}>
              <dt>Nome fantasia</dt>
              <dd>{dados.nome_fantasia || '—'}</dd>
              <dt>Atividade principal</dt>
              <dd>{dados.cnae_principal.descricao}</dd>
              <dt>Endereço</dt>
              <dd>{enderecoDaReceita(dados)}</dd>
            </dl>
          </section>
          {!dados.ativa ? (
            <Mensagem tipo="erro">
              A Receita mostra este CNPJ como <strong>{dados.situacao}</strong>. Não dá para cadastrar a loja.
            </Mensagem>
          ) : (
            <>
              {!dados.alimentar && (
                <Mensagem tipo="atencao" titulo="Atenção.">
                  A atividade principal não é varejo de alimentos. Confira na visita se o método cabe.
                </Mensagem>
              )}
              <Botao onClick={() => aoSeguir(dados)}>Continuar</Botao>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ---------- Passo 2: dados da loja ----------

function PassoDados({
  cnpj,
  consulta,
  interesse,
  interesseId,
  aoVoltar,
  aoCadastrar,
}: {
  cnpj: string
  consulta: ConsultaCnpj | null
  interesse: Interesse | undefined
  interesseId: number | undefined
  aoVoltar: () => void
  aoCadastrar: (r: LojaCadastrada) => void
}) {
  const api = useApi()
  const consultas = useQueryClient()
  const mapa = useBuscaNoMapa()
  const { confirmacao } = mapa
  // Padrões: o nome que o dono deu no pedido (ou o nome fantasia), o endereço da Receita.
  const [dados, setDados] = useState<Dados>(() => ({
    nome: interesse?.nome_mercado || consulta?.nome_fantasia || consulta?.razao_social || '',
    endereco: consulta ? enderecoDaReceita(consulta) : '',
    telefone: interesse?.telefone ?? '',
    email_responsavel: interesse?.pessoa.email ?? '',
  }))
  const [faltando, setFaltando] = useState<Partial<Record<keyof Dados, string>>>({})

  const cadastrar = useMutation({
    mutationFn: (entrada: EntradaLojaPlataforma) => api.parceria.cadastrarLoja(entrada),
    onSuccess: (r) => {
      void consultas.invalidateQueries({ queryKey: ['plataforma'] })
      aoCadastrar(r)
    },
  })

  const codigo = codigoDoErro(cadastrar.error)
  const erroEmail = faltando.email_responsavel ?? (codigo === 'email_invalido' ? mensagemDeErro(cadastrar.error) : null)
  // Erros do CNPJ (repetido, inativo, desconhecido): o caminho é voltar ao passo 1.
  const erroDoCnpj = codigo?.startsWith('cnpj_') ?? false

  function editar(campo: keyof Dados, valor: string) {
    cadastrar.reset()
    if (campo === 'endereco') mapa.limpar() // endereço novo: busca de novo
    setFaltando((f) => ({ ...f, [campo]: undefined }))
    setDados((d) => ({ ...d, [campo]: valor }))
  }

  function enviarCom(coordenadas: { latitude: number | null; longitude: number | null }) {
    cadastrar.mutate({
      cnpj,
      nome: dados.nome.trim(),
      endereco: dados.endereco.trim(),
      telefone: dados.telefone.trim(),
      email_responsavel: dados.email_responsavel.trim(),
      ...coordenadas,
      ...(interesseId ? { interesse_id: interesseId } : {}),
    })
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    const vazios = {
      nome: dados.nome.trim() ? undefined : 'Informe o nome da loja.',
      endereco: dados.endereco.trim() ? undefined : 'Informe o endereço.',
      // O backend exige o telefone (guardado só com dígitos): sem nenhum dígito, nem envia.
      telefone: /\d/.test(dados.telefone) ? undefined : 'Informe o telefone da loja.',
      email_responsavel: dados.email_responsavel.trim() ? undefined : 'Informe o e-mail de quem vai aceitar o convite.',
    }
    setFaltando(vazios)
    if (vazios.nome || vazios.endereco || vazios.telefone || vazios.email_responsavel) return
    // Como na L14: primeiro o mapa; a pessoa confirma onde ele achou.
    mapa.buscar(dados.endereco)
  }

  const semLocalizacao = { latitude: null, longitude: null }

  return (
    <form className={styles.formulario} onSubmit={enviar} noValidate>
      {!consulta && (
        <Mensagem tipo="atencao">
          Sem a consulta à Receita: a loja fica como <strong>CNPJ não verificado</strong>.
        </Mensagem>
      )}
      <p className={styles.nota}>CNPJ {mascararCnpj(cnpj)}</p>
      <Campo rotulo="Nome de exibição" maxLength={120} value={dados.nome} onChange={(e) => editar('nome', e.target.value)} erro={faltando.nome} />
      <Campo
        id={ID_ENDERECO}
        rotulo="Endereço"
        dica="Rua, número, bairro e cidade"
        maxLength={255}
        value={dados.endereco}
        onChange={(e) => editar('endereco', e.target.value)}
        erro={faltando.endereco}
      />
      {confirmacao?.tipo === 'encontrado' && (
        <p className={styles.localizacao}>
          <span aria-hidden="true">✓</span> Localização encontrada
        </p>
      )}
      <Campo
        rotulo="Telefone"
        type="tel"
        inputMode="tel"
        value={dados.telefone}
        onChange={(e) => editar('telefone', e.target.value)}
        erro={faltando.telefone}
      />
      <Campo
        rotulo="E-mail do responsável"
        type="email"
        inputMode="email"
        dica="A conta que vai aceitar o convite (entrar ou criar a conta com este e-mail)."
        value={dados.email_responsavel}
        onChange={(e) => editar('email_responsavel', e.target.value)}
        erro={erroEmail}
      />

      {cadastrar.isError && codigo !== 'email_invalido' && <MensagemErro erro={cadastrar.error} />}
      {erroDoCnpj && (
        <Botao variante="secundario" onClick={aoVoltar}>
          Voltar ao CNPJ
        </Botao>
      )}
      {mapa.erro && (
        <>
          <MensagemErro erro={mapa.erro} />
          <Botao variante="secundario" carregando={cadastrar.isPending} textoCarregando="Cadastrando…" onClick={() => enviarCom(semLocalizacao)}>
            Cadastrar sem localização
          </Botao>
        </>
      )}

      {confirmacao ? (
        <div className={styles.cartao} role="region" aria-label="Confirmar localização" aria-live="polite">
          <TextoConfirmacao confirmacao={confirmacao} />
          <div className={styles.acoes}>
            <Botao
              variante="secundario"
              larguraTotal={false}
              disabled={cadastrar.isPending}
              onClick={() => {
                mapa.limpar()
                document.getElementById(ID_ENDERECO)?.focus()
              }}
            >
              Corrigir endereço
            </Botao>
            <Botao
              larguraTotal={false}
              carregando={cadastrar.isPending}
              textoCarregando="Cadastrando…"
              onClick={() => enviarCom(mapa.coordenadas(confirmacao))}
            >
              {confirmacao.tipo === 'encontrado' ? 'Cadastrar com esta localização' : 'Cadastrar sem localização'}
            </Botao>
          </div>
        </div>
      ) : (
        <div className={styles.acoes}>
          <Botao variante="secundario" larguraTotal={false} onClick={aoVoltar} disabled={mapa.buscando}>
            Voltar
          </Botao>
          <Botao type="submit" larguraTotal={false} carregando={mapa.buscando} textoCarregando="Buscando no mapa…">
            Cadastrar loja e gerar convite
          </Botao>
        </div>
      )}
    </form>
  )
}

// ---------- Resultado ----------

function Resultado({ resultado: { loja, convite } }: { resultado: LojaCadastrada }) {
  const navegar = useNavigate()
  return (
    <div className={styles.tela}>
      <h1 className={styles.sucesso}>
        <span aria-hidden="true">✓</span> Loja cadastrada
      </h1>
      <section className={styles.cartao} aria-label="Loja cadastrada">
        <span className={styles.linhaTopo}>
          <span className={styles.principal}>{loja.nome}</span>
          {!loja.cnpj_verificado && <Selo variante="warn">CNPJ não verificado</Selo>}
        </span>
        <span className={styles.secundario}>{loja.endereco}</span>
      </section>
      <div className={styles.formulario}>
        <CompartilharConvite convite={convite} nomeLoja={loja.nome} />
        <div className={styles.acoes}>
          <Botao variante="secundario" larguraTotal={false} onClick={() => navegar('/plataforma/lojas')}>
            Ver lojas
          </Botao>
        </div>
      </div>
    </div>
  )
}
