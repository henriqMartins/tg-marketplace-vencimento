import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useSessao } from '../../app/contextos'
import { Botao, BotaoIcone } from '../../componentes/Botao'
import { CaixaSelecao } from '../../componentes/CaixaSelecao'
import { Campo, CampoSenha } from '../../componentes/Campo'
import { IconeVoltar } from '../../componentes/icones'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { codigoDoErro, mensagemDeErro } from '../../util/erros'
import styles from './TelaCriarConta.module.css'

/** Só AJUDA na tela; quem decide é o backend (400 senha_curta). */
const SENHA_MINIMA = 8

/** A3 · Criar conta. Depois de criar, o guarda SoVisitante leva à C1 (/boas-vindas). */
export function TelaCriarConta() {
  const sessao = useSessao()
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [termos, setTermos] = useState(false)
  const [senhaTocada, setSenhaTocada] = useState(false)
  const [faltando, setFaltando] = useState<{ nome?: string; email?: string }>({})

  const criar = useMutation({
    mutationFn: () => sessao.criarConta({ nome, email, senha, aceite_termos: true }),
  })

  // Erros da API que têm lugar certo na tela (embaixo do campo).
  const codigo = codigoDoErro(criar.error)
  const erroEmail = faltando.email ?? (codigo === 'email_em_uso' ? mensagemDeErro(criar.error) : null)
  const senhaCurta = senhaTocada && senha.length > 0 && senha.length < SENHA_MINIMA
  const erroSenha = codigo === 'senha_curta' ? mensagemDeErro(criar.error) : senhaCurta ? 'A senha precisa ter pelo menos 8 caracteres.' : null
  const erroGeral = criar.isError && codigo !== 'email_em_uso' && codigo !== 'senha_curta'

  function enviar(e: FormEvent) {
    e.preventDefault()
    setSenhaTocada(true)
    const vazios = {
      nome: nome.trim() ? undefined : 'Informe seu nome.',
      email: email.trim() ? undefined : 'Informe seu e-mail.',
    }
    setFaltando(vazios)
    if (vazios.nome || vazios.email || senha.length < SENHA_MINIMA || !termos) return
    criar.mutate()
  }

  return (
    <div className={styles.tela}>
      <header className={styles.cabecalho}>
        <BotaoIcone rotulo="Voltar" onClick={() => navegar(`/entrar${parametros.size ? `?${parametros}` : ''}`)}>
          <IconeVoltar />
        </BotaoIcone>
        <h1 className={styles.titulo}>Criar conta</h1>
      </header>

      <form className={styles.formulario} onSubmit={enviar} noValidate>
        {erroGeral && <MensagemErro erro={criar.error} />}
        <Campo rotulo="Nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} erro={faltando.nome} />
        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          erro={erroEmail}
        />
        <CampoSenha
          rotulo="Senha"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onBlur={() => setSenhaTocada(true)}
          dica="Pelo menos 8 caracteres."
          erro={erroSenha}
        />
        <CaixaSelecao checked={termos} onChange={(e) => setTermos(e.target.checked)}>
          Li e aceito os termos de uso. Meus dados são usados só para as reservas.
        </CaixaSelecao>
        <Mensagem tipo="info">
          Trabalha numa loja parceira? Crie a conta normalmente. O responsável da loja vincula você pelo seu e-mail.
        </Mensagem>

        <div className={styles.rodape}>
          <Botao type="submit" disabled={!termos} carregando={criar.isPending} textoCarregando="Criando…">
            Criar conta
          </Botao>
        </div>
      </form>
    </div>
  )
}
