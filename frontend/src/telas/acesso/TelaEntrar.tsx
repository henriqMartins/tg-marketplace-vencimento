import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useSessao } from '../../app/contextos'
import { NOME_DO_APP } from '../../app/marca'
import { useEhDesktop } from '../../app/tela'
import { Botao } from '../../componentes/Botao'
import { CaixaSelecao } from '../../componentes/CaixaSelecao'
import { Campo, CampoSenha } from '../../componentes/Campo'
import { IconeCasa } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import styles from './TelaEntrar.module.css'

/**
 * A2 (celular) e A5 (≥ 1024 px): mesma rota /entrar.
 * Depois de entrar, quem leva ao destino é o guarda SoVisitante (rotas.tsx).
 * "Esqueci minha senha" fica de fora até a recuperação existir (decidido 11/11/2026).
 */
export function TelaEntrar() {
  const desktop = useEhDesktop()
  const sessao = useSessao()
  const [parametros] = useSearchParams()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [manterConectado, setManterConectado] = useState(true)
  const [faltando, setFaltando] = useState<{ email?: string; senha?: string }>({})

  const entrar = useMutation({
    // No celular fica sempre conectado; no computador, a pessoa escolhe.
    mutationFn: () => sessao.entrar({ email, senha }, desktop ? manterConectado : true),
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    const vazios = {
      email: email.trim() ? undefined : 'Informe seu e-mail.',
      senha: senha ? undefined : 'Informe sua senha.',
    }
    setFaltando(vazios)
    if (!vazios.email && !vazios.senha) entrar.mutate()
  }

  const criarConta = `/criar-conta${parametros.size ? `?${parametros}` : ''}`

  const formulario = (
    <form className={styles.formulario} onSubmit={enviar} noValidate>
      {entrar.isError && <MensagemErro erro={entrar.error} />}
      <Campo
        rotulo="E-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        erro={faltando.email}
      />
      <CampoSenha
        rotulo="Senha"
        autoComplete="current-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        erro={faltando.senha}
      />
      {desktop && (
        <CaixaSelecao checked={manterConectado} onChange={(e) => setManterConectado(e.target.checked)}>
          Manter conectado neste computador
        </CaixaSelecao>
      )}
      <Botao type="submit" carregando={entrar.isPending} textoCarregando="Entrando…">
        Entrar
      </Botao>
    </form>
  )

  if (desktop) {
    return (
      <div className={styles.desktop}>
        <section className={styles.apresentacao}>
          <div className={styles.marca}>
            <span className={styles.iconeClaro} aria-hidden="true">
              <IconeCasa tamanho={32} />
            </span>
            <span className={styles.nomeApp}>{NOME_DO_APP}</span>
          </div>
          <p className={styles.chamada}>Produtos perto da validade, com desconto, no mercadinho do bairro.</p>
          <ul className={styles.pontos}>
            <li>
              <strong>Para quem compra:</strong> veja ofertas perto de você, reserve e retire na loja.
            </li>
            <li>
              <strong>Para a loja:</strong> cadastre lotes, receba avisos de validade e publique ofertas.
            </li>
            <li>
              <strong>Para o responsável:</strong> acompanhe retiradas, expirações e perdas no painel.
            </li>
          </ul>
          <p className={styles.rodapeApresentacao}>
            Uma conta só: as telas da loja aparecem para quem tem vínculo com ela.
          </p>
        </section>
        <section className={styles.ladoCartao}>
          <div className={styles.cartao}>
            <div className={styles.cabecalho}>
              <h1 className={styles.tituloCartao}>Entrar</h1>
              <p className={styles.texto}>Use o e-mail e a senha da sua conta.</p>
            </div>
            {formulario}
            <p className={styles.semConta}>
              Não tem conta? <Link to={criarConta}>Criar conta</Link>
            </p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.celular}>
      <div className={styles.cabecalho}>
        <span className={styles.icone} aria-hidden="true">
          <IconeCasa tamanho={30} />
        </span>
        <h1 className={styles.titulo}>Entrar</h1>
        <p className={styles.texto}>
          Uma conta só para comprar e, se você trabalha numa loja parceira, para operar a loja.
        </p>
      </div>
      {formulario}
      <div className={styles.outrasAcoes}>
        <Link to={criarConta} className={styles.botaoLink}>
          Criar conta
        </Link>
        <Link to="/vitrine" className={styles.linkDiscreto}>
          Só olhar as ofertas, sem entrar
        </Link>
      </div>
    </div>
  )
}
