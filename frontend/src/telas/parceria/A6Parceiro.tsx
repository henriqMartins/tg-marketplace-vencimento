import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import type { EntradaInteresse, EstadoInteresse, Interesse } from '../../api'
import { useApi, useSessao } from '../../app/contextos'
import { interesseEmAberto } from '../../app/parceria'
import { useEhDesktop } from '../../app/tela'
import { Botao, BotaoIcone } from '../../componentes/Botao'
import { Campo, CampoTexto } from '../../componentes/Campo'
import { IconeVoltar } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import { Selo } from '../../componentes/Selo'
import { classes } from '../../util/classes'
import { codigoDoErro } from '../../util/erros'
import { formatarDataCurta } from '../../util/formatar'
import styles from './Parceria.module.css'

const VAZIO: EntradaInteresse = { nome_mercado: '', cidade: '', telefone: '', mensagem: '' }

/**
 * A6 · Quero ser parceiro (docs/parceria.md, seção 2). Três estados: formulário, "Recebemos
 * seu pedido" logo depois de enviar, e leitura quando já existe um pedido em aberto.
 */
export function A6Parceiro() {
  const api = useApi()
  const { eu, recarregarEu } = useSessao()
  const desktop = useEhDesktop()
  const navegar = useNavigate()
  const [form, setForm] = useState<EntradaInteresse>(VAZIO)
  const [faltando, setFaltando] = useState<Partial<Record<keyof EntradaInteresse, string>>>({})

  const enviar = useMutation({
    mutationFn: (entrada: EntradaInteresse) => api.parceria.registrarInteresse(entrada),
    onSuccess: () => recarregarEu(), // a A4 passa a mostrar "Pedido de parceria recebido"
  })

  if (!eu) return null // rota atrás do ExigeLogin

  const corpo = enviar.isSuccess ? (
    <Recebido interesse={enviar.data} />
  ) : interesseEmAberto(eu) && eu.interesse ? (
    // PEDIDO-API 5: com o Interesse inteiro no Eu, esta leitura mostraria também os dados enviados.
    <EmAndamento estado={eu.interesse.estado} criadoEm={eu.interesse.criado_em} />
  ) : (
    formulario()
  )

  function editar(campo: keyof EntradaInteresse, valor: string) {
    enviar.reset()
    setFaltando((f) => ({ ...f, [campo]: undefined }))
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function submeter(e: FormEvent) {
    e.preventDefault()
    const vazios = {
      nome_mercado: form.nome_mercado.trim() ? undefined : 'Informe o nome do mercado.',
      cidade: form.cidade.trim() ? undefined : 'Informe a cidade.',
      telefone: form.telefone.trim() ? undefined : 'Informe um telefone para contato.',
    }
    setFaltando(vazios)
    if (vazios.nome_mercado || vazios.cidade || vazios.telefone) return
    enviar.mutate({ ...form, mensagem: form.mensagem?.trim() || undefined })
  }

  // Função comum (não componente): um componente declarado aqui dentro remontaria a cada
  // render, e o campo perderia o foco a cada tecla.
  function formulario() {
    // 409: a pessoa já tem um pedido aberto (outra aba, outro aparelho) — recarregar o Eu mostra a leitura.
    const emAberto = codigoDoErro(enviar.error) === 'interesse_em_aberto'
    return (
      <>
        <p className={styles.texto}>
          A entrada é por parceria: nossa equipe entra em contato, visita a loja e, com o acordo feito, envia um convite
          para você ativar a loja no app.
        </p>
        <form className={styles.formulario} onSubmit={submeter} noValidate>
          {enviar.isError && <MensagemErro erro={enviar.error} />}
          {emAberto && (
            <Botao variante="secundario" onClick={recarregarEu}>
              Ver meu pedido
            </Botao>
          )}
          <Campo
            rotulo="Nome do mercado"
            value={form.nome_mercado}
            onChange={(e) => editar('nome_mercado', e.target.value)}
            erro={faltando.nome_mercado}
          />
          <Campo
            rotulo="Cidade"
            autoComplete="address-level2"
            value={form.cidade}
            onChange={(e) => editar('cidade', e.target.value)}
            erro={faltando.cidade}
          />
          <Campo
            rotulo="Telefone (WhatsApp)"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.telefone}
            onChange={(e) => editar('telefone', e.target.value)}
            erro={faltando.telefone}
          />
          <CampoTexto
            rotulo="Mensagem (opcional)"
            dica="Conte o que quiser sobre a loja: o que vende, o que mais perde."
            value={form.mensagem}
            onChange={(e) => editar('mensagem', e.target.value)}
          />
          <div className={styles.rodape}>
            <Botao type="submit" carregando={enviar.isPending} textoCarregando="Enviando…">
              Enviar pedido
            </Botao>
          </div>
        </form>
      </>
    )
  }

  return (
    <div className={classes(styles.tela, desktop && styles.telaComputador)}>
      <header className={styles.cabecalho}>
        <BotaoIcone rotulo="Voltar" onClick={() => navegar('/escolher')}>
          <IconeVoltar />
        </BotaoIcone>
        <h1 className={styles.titulo}>Seu mercado na plataforma</h1>
      </header>
      <div className={styles.corpo}>{corpo}</div>
    </div>
  )
}

const ROTULO_ESTADO: Record<EstadoInteresse, string> = {
  novo: 'Recebido',
  em_conversa: 'Em conversa',
  virou_loja: 'Virou loja',
  descartado: 'Encerrado',
}

/** O que acontece depois (etapas 2 a 6 do processo, resumidas). */
function ProximasEtapas() {
  return (
    <section className={styles.cartao} aria-labelledby="proximas-etapas">
      <h2 id="proximas-etapas" className={styles.sobrelinha}>
        O que acontece agora
      </h2>
      <ol className={styles.etapas}>
        <li>Nossa equipe chama você no WhatsApp para explicar o método.</li>
        <li>Visitamos a loja para ver se cabe: produtos embalados, espaço para separar o lote, quem confere a gôndola.</li>
        <li>Com o acordo feito, entregamos o kit de fitas coloridas.</li>
        <li>Mandamos um convite por WhatsApp. Você abre, entra com esta conta e ativa a loja.</li>
      </ol>
    </section>
  )
}

function Recebido({ interesse }: { interesse: Interesse }) {
  return (
    <>
      <span className={styles.icone} aria-hidden="true">
        ✓
      </span>
      <h2 className={styles.nomeLoja}>Recebemos seu pedido</h2>
      <section className={styles.cartao} aria-label="Dados enviados">
        <dl className={styles.dados}>
          <dt>Mercado</dt>
          <dd>{interesse.nome_mercado}</dd>
          <dt>Cidade</dt>
          <dd>{interesse.cidade}</dd>
          <dt>Telefone</dt>
          <dd>{interesse.telefone}</dd>
          {interesse.mensagem && (
            <>
              <dt>Mensagem</dt>
              <dd>{interesse.mensagem}</dd>
            </>
          )}
        </dl>
      </section>
      <ProximasEtapas />
    </>
  )
}

function EmAndamento({ estado, criadoEm }: { estado: EstadoInteresse; criadoEm: string }) {
  return (
    <>
      <section className={styles.cartao} aria-label="Seu pedido">
        <span className={styles.linhaTopo}>
          <strong>Pedido de parceria</strong>
          <Selo variante="pending">{ROTULO_ESTADO[estado]}</Selo>
        </span>
        <span className={styles.texto}>Enviado em {formatarDataCurta(criadoEm)} · entraremos em contato</span>
      </section>
      <ProximasEtapas />
    </>
  )
}
