import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { CATEGORIAS, type Categoria, type Produto } from '../../api'
import { useApi } from '../../app/contextos'
import { Botao } from '../../componentes/Botao'
import { Campo } from '../../componentes/Campo'
import { Chip } from '../../componentes/Chip'
import { Contador } from '../../componentes/Contador'
import { Mensagem, MensagemErro } from '../../componentes/Mensagem'
import { codigoDoErro, mensagemDeErro } from '../../util/erros'
import styles from './Lotes.module.css'

export interface FormProdutoProps {
  lojaId: number
  /** O que a pessoa já tinha digitado na busca da L3. */
  nomeInicial?: string
  aoSalvar: (produto: Produto) => void
  cabecalho?: ReactNode
}

/** L2 · Novo produto. Usado na tela do celular e no modal da G5. */
export function FormProduto({ lojaId, nomeInicial = '', aoSalvar, cabecalho }: FormProdutoProps) {
  const api = useApi()
  const consultas = useQueryClient()
  const [nome, setNome] = useState(nomeInicial)
  const [categoria, setCategoria] = useState<Categoria | null>(null)
  const [margemPropria, setMargemPropria] = useState(false)
  const [margem, setMargem] = useState(1)
  // Só para o rótulo "Usar a margem da loja (1 dia)".
  const loja = useQuery({ queryKey: ['loja-config', lojaId], queryFn: () => api.configuracao.obterLoja(lojaId) })

  const salvar = useMutation({
    mutationFn: () =>
      api.lotes.criarProduto(lojaId, { nome: nome.trim(), categoria: categoria!, margem_fim_dias: margemPropria ? margem : null }),
    onSuccess: (produto) => {
      void consultas.invalidateQueries({ queryKey: ['produtos', lojaId] })
      aoSalvar(produto)
    },
  })

  const codigo = codigoDoErro(salvar.error)
  const erroNome = codigo === 'sem_nome' || codigo === 'nome_longo' ? mensagemDeErro(salvar.error) : null
  const margemLoja = loja.data?.margem_fim_dias

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (nome.trim() && categoria) salvar.mutate()
  }

  return (
    <form className={styles.tela} onSubmit={enviar} noValidate>
      {cabecalho}
      <Campo
        rotulo="Nome do produto"
        dica="Inclua o tamanho da embalagem"
        placeholder="Ex.: Leite condensado 395 g"
        value={nome}
        maxLength={120}
        erro={erroNome}
        onChange={(e) => {
          salvar.reset()
          setNome(e.target.value)
        }}
      />

      <div className={styles.campo}>
        <span id="rotulo-categoria" className={styles.rotulo}>
          Categoria
        </span>
        <div role="group" aria-labelledby="rotulo-categoria" className={styles.chips}>
          {CATEGORIAS.map((c) => (
            <Chip key={c.valor} ativo={categoria === c.valor} onClick={() => setCategoria(c.valor)}>
              {c.rotulo}
            </Chip>
          ))}
        </div>
      </div>

      <fieldset className={styles.cartao}>
        <legend className={styles.rotulo}>Fim da oferta antes da validade</legend>
        <label className={styles.opcao}>
          <input type="radio" name="margem" checked={!margemPropria} onChange={() => setMargemPropria(false)} />
          Usar a margem da loja{margemLoja !== undefined && ` (${margemLoja} ${margemLoja === 1 ? 'dia' : 'dias'})`}
        </label>
        <label className={styles.opcao}>
          <input type="radio" name="margem" checked={margemPropria} onChange={() => setMargemPropria(true)} />
          Margem própria deste produto
        </label>
        {margemPropria && (
          <Contador valor={margem} min={0} max={7} rotulo="Margem própria, em dias" tamanho="cadastro" aoMudar={setMargem} />
        )}
        <p className={styles.ajuda}>
          Exemplo: validade 18/12 e margem de 1 dia → sai em 17/12. Mudar depois vale só para ofertas novas.
        </p>
      </fieldset>

      <Mensagem tipo="atencao">
        Só produtos embalados e fechados, vendidos por unidade. Nada vendido a peso no balcão, hortifrúti ou pão.
      </Mensagem>

      {salvar.isError && !erroNome && <MensagemErro erro={salvar.error} />}

      <Botao type="submit" disabled={!nome.trim() || !categoria} carregando={salvar.isPending} textoCarregando="Salvando…">
        {categoria ? 'Salvar e cadastrar o lote' : 'Escolha a categoria'}
      </Botao>
    </form>
  )
}
