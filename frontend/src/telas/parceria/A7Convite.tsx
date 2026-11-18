import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ehErroApi } from '../../api'
import { useApi, useSessao } from '../../app/contextos'
import { mascararEmail } from '../../app/parceria'
import { useEhDesktop } from '../../app/tela'
import { Botao } from '../../componentes/Botao'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { Mensagem } from '../../componentes/Mensagem'
import { classes } from '../../util/classes'
import { codigoDoErro, mensagemDeErro } from '../../util/erros'
import { formatarDataCurta } from '../../util/formatar'
import styles from './Parceria.module.css'

/**
 * A7 · Convite para ativar a loja (/convite/:codigo). Fica atrás do ExigeLogin: sem login,
 * vai para /entrar?voltar=/convite/:codigo e volta para cá depois de entrar ou criar a conta.
 */
export function A7Convite() {
  const { codigo = '' } = useParams()
  const api = useApi()
  const { sair } = useSessao()
  const consultas = useQueryClient()
  const navegar = useNavigate()
  const desktop = useEhDesktop()
  const [trocando, setTrocando] = useState(false)

  const convite = useQuery({ queryKey: ['convite', codigo], queryFn: () => api.parceria.obterConvite(codigo) })

  const aceitar = useMutation({
    mutationFn: () => api.parceria.aceitarConvite(codigo),
    onSuccess: async ({ vinculo }) => {
      // Espera o Eu com o vínculo novo: senão a loja abriria em "Sem acesso".
      await consultas.invalidateQueries({ queryKey: ['eu'] })
      // L14 da loja, para o novo responsável conferir as regras.
      navegar(`/loja/${vinculo.loja.id}/config`, { replace: true })
    },
  })

  async function entrarComOutraConta() {
    setTrocando(true)
    await sair()
    navegar(`/entrar?voltar=${encodeURIComponent(`/convite/${codigo}`)}`, { replace: true })
  }

  const erro = convite.error ?? aceitar.error
  let conteudo
  if (convite.isPending) {
    conteudo = <EsqueletoLista quantidade={2} rotulo="Abrindo o convite…" />
  } else if (erro) {
    conteudo = (
      <>
        <Mensagem tipo="erro">{fraseDoErro(erro, convite.data?.email)}</Mensagem>
        {codigoDoErro(erro) === 'email_diferente' && (
          <Botao variante="secundario" carregando={trocando} textoCarregando="Saindo…" onClick={entrarComOutraConta}>
            Entrar com outra conta
          </Botao>
        )}
      </>
    )
  }

  return (
    <div className={classes(styles.tela, desktop && styles.telaComputador)}>
      <header className={styles.cabecalho}>
        <h1 className={styles.titulo}>Convite para ser responsável</h1>
      </header>
      <div className={styles.corpo}>
        {convite.data && (
          <section className={styles.cartao} aria-label="Loja do convite">
            <span className={styles.nomeLoja}>{convite.data.loja.nome}</span>
            <span className={styles.texto}>{convite.data.loja.endereco}</span>
            <span>
              Convite para <strong>{convite.data.email}</strong>
            </span>
            <span className={styles.texto}>Vale até {formatarDataCurta(convite.data.expira_em)}</span>
          </section>
        )}
        {conteudo}
        {convite.data && !aceitar.isError && (
          <>
            <p className={styles.texto}>
              Ao aceitar, sua conta vira responsável pela loja: você define as regras, cadastra a equipe e publica as
              ofertas.
            </p>
            <div className={styles.rodape}>
              <Botao carregando={aceitar.isPending} textoCarregando="Ativando…" onClick={() => aceitar.mutate()}>
                Aceitar e ativar a loja
              </Botao>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Frases da docs/parceria.md (A7), com o que fazer. O resto usa a frase da API. */
function fraseDoErro(erro: unknown, email: string | undefined): string {
  // 404 pelo status: o código que acompanha pode variar.
  if (ehErroApi(erro) && erro.status === 404) return 'Convite não encontrado. Confira se o link foi copiado inteiro.'
  switch (codigoDoErro(erro)) {
    case 'email_diferente':
      return `Este convite é para outro e-mail. Entre com a conta de ${email ? mascararEmail(email) : 'quem foi convidado'}.`
    case 'convite_vencido':
      return 'Este convite venceu. Peça um novo à equipe da plataforma.'
    case 'convite_usado':
      return 'Este convite já foi usado.'
    default:
      return mensagemDeErro(erro)
  }
}
