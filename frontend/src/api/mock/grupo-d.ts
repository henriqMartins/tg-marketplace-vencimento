/*
 * Grupo D no mock (lote, fita e aviso — L2 a L8, L4/G5). Segue backend/ofertas/api_lotes.py
 * e servico_lotes.py: a mesma ordem de validação, os mesmos códigos e frases.
 * As regras (cor, agrupamento, conferir, limite do adiar, preço) ficam em regras-fingidas.ts.
 */
import type { ApiLotes } from '../cliente'
import type { ErroApi } from '../erros'
import type { CorFita, Data, Grupo, OfertaLoja, Papel, Produto, SituacaoGrupo } from '../tipos'
import { CATEGORIAS } from '../tipos'
import { dataBrasilia, isoBrasilia, somarDias } from './datas'
import {
  adiarAteMax,
  classificarLote,
  ehAviso,
  fimDaOferta,
  fitaDe,
  lerDinheiro,
  precoComDesconto,
  situacaoExibida,
} from './regras-fingidas'
import type { BancoMock, GrupoMock, LojaMock, OfertaMock, ProdutoMock } from './semente'

const URGENTE_DIAS = 7
const DESCONTOS = [20, 30, 40, 50]
const JANELAS_HORAS = [1, 2, 4, 8, 12, 24]
const CORES: CorFita[] = ['vermelho', 'amarelo', 'verde', 'azul', 'branco', 'preto']
const SITUACOES: SituacaoGrupo[] = ['aguardando', 'conferir', 'adiado', 'em_oferta', 'encerrado']
const MOTIVOS = ['sem_unidades', 'outro_destino']

export interface DependenciasLotes {
  banco: () => BancoMock
  agora: () => Date
  responder: <T>(executar: () => T) => Promise<T>
  erro: (status: number, codigo: string, frase: string, extra?: object) => ErroApi
  vinculoCom: (lojaId: number) => { papel: Papel }
  lojaPorId: (lojaId: number) => LojaMock
  paraOfertaLoja: (o: OfertaMock) => OfertaLoja
}

const inteiro = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null)

/** "AAAA-MM-DD" que existe no calendário; senão null. */
function lerData(v: unknown): Data | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null
}

const diasEntre = (de: Data, ate: Data) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000)

export function criarApiLotes(d: DependenciasLotes): ApiLotes & { avisosParaConferir: (lojaId: number) => number } {
  const { erro, responder, vinculoCom } = d
  const hoje = () => dataBrasilia(d.agora())

  const produtoPorId = (id: number) => d.banco().produtos.find((p) => p.id === id)!
  const margemEfetiva = (p: ProdutoMock) => p.margem_fim_dias ?? d.lojaPorId(p.lojaId).margem_fim_dias
  const ofertaDo = (g: GrupoMock) => (g.ofertaId ? d.banco().ofertas.find((o) => o.id === g.ofertaId) : undefined)
  const situacaoDe = (g: GrupoMock) => situacaoExibida(g, ofertaDo(g), hoje())
  const lotesDe = (g: GrupoMock) =>
    d
      .banco()
      .lotes.filter((l) => l.grupoId === g.id)
      .sort((a, b) => a.validade.localeCompare(b.validade) || a.id - b.id)
  const gruposDaLoja = (lojaId: number) =>
    d
      .banco()
      .grupos.filter((g) => produtoPorId(g.produtoId).lojaId === lojaId)
      .sort((a, b) => a.referencia.localeCompare(b.referencia) || a.id - b.id)

  /** Preço normal da oferta mais recente do produto (o preço sugerido da L7). */
  function ultimoPreco(p: ProdutoMock) {
    const ofertas = d
      .banco()
      .ofertas.filter((o) => o.lojaId === p.lojaId && o.produto.nome === p.nome)
      .sort((a, b) => b.inicio.getTime() - a.inicio.getTime() || b.id - a.id)
    return ofertas[0]?.preco_original ?? p.preco_anterior
  }

  const paraProduto = (p: ProdutoMock): Produto => ({
    id: p.id,
    nome: p.nome,
    categoria: p.categoria,
    margem_fim_dias: p.margem_fim_dias,
    margem_efetiva_dias: margemEfetiva(p),
    ultimo_preco_original: ultimoPreco(p),
  })

  function paraGrupo(g: GrupoMock, comLotes: boolean): Grupo {
    const p = produtoPorId(g.produtoId)
    const lotes = lotesDe(g)
    return {
      id: g.id,
      produto: { id: p.id, nome: p.nome },
      fita: fitaDe(g.referencia),
      referencia: g.referencia,
      situacao: situacaoDe(g),
      aviso_em: g.aviso_em,
      adiado_ate: g.adiado_ate,
      colisao: g.colisao_validade ? { validade: g.colisao_validade } : null,
      qtd_lotes: lotes.length,
      recebido: lotes.reduce((t, l) => t + l.quantidade, 0),
      oferta_id: g.ofertaId,
      ...(comLotes ? { lotes: lotes.map(({ id, validade, quantidade, recebido_em }) => ({ id, validade, quantidade, recebido_em })) } : {}),
    }
  }

  /** O grupo, se for desta loja E estiver em aviso; senão 404 (outra pessoa já publicou ou descartou). */
  function avisoDa(lojaId: number, grupoId: number): GrupoMock {
    const g = gruposDaLoja(lojaId).find((x) => x.id === grupoId)
    if (!g || !ehAviso(situacaoDe(g))) throw erro(404, 'nao_encontrado', 'Aviso não encontrado.')
    return g
  }

  return {
    avisosParaConferir: (lojaId) => gruposDaLoja(lojaId).filter((g) => situacaoDe(g) === 'conferir').length,

    listarProdutos: (lojaId, q) =>
      responder(() => {
        vinculoCom(lojaId)
        const busca = (q ?? '').trim().toLowerCase()
        return d
          .banco()
          .produtos.filter((p) => p.lojaId === lojaId && (!busca || p.nome.toLowerCase().includes(busca)))
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id)
          .map(paraProduto)
      }),

    criarProduto: (lojaId, { nome, categoria, margem_fim_dias: margem }) =>
      responder(() => {
        vinculoCom(lojaId)
        const texto = typeof nome === 'string' ? nome.trim() : ''
        if (!texto) throw erro(400, 'sem_nome', 'Informe o nome do produto.')
        if (texto.length > 120) throw erro(400, 'nome_longo', 'O nome pode ter até 120 letras.')
        if (!CATEGORIAS.some((c) => c.valor === categoria)) throw erro(400, 'categoria_invalida', 'Categoria inválida.')
        if (margem !== null && (inteiro(margem) === null || margem < 0 || margem > 7)) {
          throw erro(400, 'margem_invalida', 'A margem vai de 0 a 7 dias (ou vazia, para usar a da loja).')
        }
        const banco = d.banco()
        const p: ProdutoMock = { id: banco.proximoId++, lojaId, nome: texto, categoria, margem_fim_dias: margem, preco_anterior: null }
        banco.produtos.push(p)
        return paraProduto(p)
      }),

    cadastrarLote: (lojaId, { produto: produtoId, validade: v, quantidade }) =>
      responder(() => {
        vinculoCom(lojaId)
        const validade = lerData(v)
        if (!validade) throw erro(400, 'validade_invalida', 'Validade inválida (use AAAA-MM-DD).')
        if (validade < hoje()) throw erro(400, 'validade_passada', 'Este lote já venceu.')
        if (inteiro(quantidade) === null || quantidade < 1) throw erro(400, 'quantidade_invalida', 'Informe pelo menos 1 unidade.')
        const banco = d.banco()
        const produto = banco.produtos.find((p) => p.id === produtoId && p.lojaId === lojaId)
        if (!produto) throw erro(404, 'nao_encontrado', 'Produto não encontrado.')

        const antecedencia = d.lojaPorId(lojaId).antecedencia_aviso_dias
        const ativos = banco.grupos
          .filter((g) => g.produtoId === produto.id && g.situacao !== 'encerrado' && situacaoDe(g) !== 'encerrado')
          .map((grupo) => ({ grupo, aberto: grupo.situacao === 'aguardando' || grupo.situacao === 'adiado' }))
        const { resultado, grupo: existente, colisao } = classificarLote(validade, ativos)

        let grupo = existente
        if (!grupo) {
          grupo = {
            id: banco.proximoId++,
            produtoId: produto.id,
            referencia: validade,
            situacao: 'aguardando',
            aviso_em: somarDias(validade, -antecedencia),
            adiado_ate: null,
            colisao_validade: colisao,
            motivo_descarte: null,
            ofertaId: null,
          }
          banco.grupos.push(grupo)
        } else if (validade < grupo.referencia) {
          // A referência é a validade mais próxima; o aviso vem junto.
          grupo.referencia = validade
          grupo.aviso_em = somarDias(validade, -antecedencia)
          // O limite do adiar encolheu: se o adiamento passou dele, desfaz.
          if (grupo.situacao === 'adiado' && grupo.adiado_ate! > adiarAteMax(grupo.referencia, margemEfetiva(produto))) {
            grupo.situacao = 'aguardando'
            grupo.adiado_ate = null
          }
        }
        const lote = { id: banco.proximoId++, grupoId: grupo.id, validade, quantidade, recebido_em: hoje() }
        banco.lotes.push(lote)
        const { grupoId: _g, ...semGrupo } = lote
        return { lote: semGrupo, grupo: paraGrupo(grupo, true), resultado, colisao: colisao ? { validade: colisao } : null }
      }),

    listarGrupos: (lojaId, filtros = {}) =>
      responder(() => {
        vinculoCom(lojaId)
        if (filtros.cor && !CORES.includes(filtros.cor)) throw erro(400, 'parametro_invalido', 'Cor inválida.')
        if (filtros.situacao && !SITUACOES.includes(filtros.situacao)) {
          throw erro(400, 'parametro_invalido', 'Situação inválida.')
        }
        return gruposDaLoja(lojaId)
          .filter((g) => !filtros.cor || fitaDe(g.referencia).cor === filtros.cor)
          .filter((g) => !filtros.situacao || situacaoDe(g) === filtros.situacao)
          .map((g) => paraGrupo(g, Boolean(filtros.com_lotes)))
      }),

    listarAvisos: (lojaId) =>
      responder(() => {
        vinculoCom(lojaId)
        const avisos = gruposDaLoja(lojaId)
          .filter((g) => (g.situacao === 'aguardando' || g.situacao === 'adiado') && ehAviso(situacaoDe(g)))
          .map((g) => {
            const dias = diasEntre(hoje(), g.referencia)
            return { id: g.id, grupo: paraGrupo(g, false), vence_em_dias: dias, urgente: dias <= URGENTE_DIAS }
          })
        return { antecedencia_dias: d.lojaPorId(lojaId).antecedencia_aviso_dias, avisos }
      }),

    obterAviso: (lojaId, avisoId) =>
      responder(() => {
        vinculoCom(lojaId)
        const g = avisoDa(lojaId, avisoId)
        const p = produtoPorId(g.produtoId)
        const margem = margemEfetiva(p)
        return {
          grupo: paraGrupo(g, true),
          preco_sugerido: ultimoPreco(p),
          janela_padrao_horas: d.lojaPorId(lojaId).janela_padrao_horas,
          fim_previsto: isoBrasilia(fimDaOferta(g.referencia, margem)),
          adiar_ate_max: adiarAteMax(g.referencia, margem),
          margem_efetiva_dias: margem,
        }
      }),

    adiarAviso: (lojaId, avisoId, ate) =>
      responder(() => {
        vinculoCom(lojaId)
        const g = avisoDa(lojaId, avisoId)
        const data = lerData(ate)
        if (!data) throw erro(400, 'data_invalida', 'Data inválida (use AAAA-MM-DD).')
        const limite = adiarAteMax(g.referencia, margemEfetiva(produtoPorId(g.produtoId)))
        if (data <= hoje()) throw erro(400, 'data_invalida', 'Escolha uma data depois de hoje.')
        if (data > limite) {
          throw erro(400, 'apos_limite', 'Só dá para adiar até a véspera do último dia da oferta.', { adiar_ate_max: limite })
        }
        g.situacao = 'adiado'
        g.adiado_ate = data
        return paraGrupo(g, true)
      }),

    descartarAviso: (lojaId, avisoId, motivo) =>
      responder(() => {
        vinculoCom(lojaId)
        const g = avisoDa(lojaId, avisoId)
        if (!MOTIVOS.includes(motivo)) throw erro(400, 'motivo_invalido', 'Use sem_unidades ou outro_destino.')
        // "Não vai para oferta": encerra sem oferta. Não é perda (perda é só de oferta encerrada).
        g.situacao = 'encerrado'
        g.adiado_ate = null
        g.motivo_descarte = motivo
        return paraGrupo(g, true)
      }),

    publicarAviso: (lojaId, avisoId, entrada) =>
      responder(() => {
        vinculoCom(lojaId)
        const g = avisoDa(lojaId, avisoId) // 2º clique: já não é aviso → 404
        const separado = inteiro(entrada.separado)
        const precoOriginal = lerDinheiro(entrada.preco_original)
        const desconto = inteiro(entrada.desconto)
        const janela = inteiro(entrada.janela_horas)
        if (entrada.confirmou_separacao !== true) throw erro(400, 'sem_confirmacao', 'Confirme que as unidades foram separadas.')
        if (separado === null || separado < 1) throw erro(400, 'separado_invalido', 'Informe pelo menos 1 unidade separada.')
        if (!precoOriginal) throw erro(400, 'preco_invalido', 'Preço normal inválido.')
        if (desconto === null || !DESCONTOS.includes(desconto)) throw erro(400, 'desconto_invalido', 'Desconto: 20, 30, 40 ou 50%.')
        if (janela === null || !JANELAS_HORAS.includes(janela)) throw erro(400, 'janela_invalida', 'Janela: 1, 2, 4, 8, 12 ou 24 horas.')

        const recebido = lotesDe(g).reduce((t, l) => t + l.quantidade, 0)
        if (separado > recebido) {
          throw erro(400, 'acima_do_recebido', 'Separado maior que o recebido nos lotes.', { recebido })
        }
        const preco = precoComDesconto(precoOriginal, desconto)
        if (!(Number(preco) > 0 && Number(preco) < Number(precoOriginal))) {
          throw erro(400, 'preco_invalido', 'Com esse desconto o preço não fica menor.')
        }
        const p = produtoPorId(g.produtoId)
        const fim = fimDaOferta(g.referencia, margemEfetiva(p))
        const agora = d.agora()
        if (agora >= fim) throw erro(409, 'fim_ja_passou', 'O último dia desta oferta já passou.')

        // A oferta nasce com livre = separado e os outros contadores zerados.
        const banco = d.banco()
        const oferta: OfertaMock = {
          id: banco.proximoId++,
          lojaId,
          produto: { nome: p.nome, categoria: p.categoria },
          validade: g.referencia,
          inicio: agora,
          fim,
          preco,
          preco_original: precoOriginal,
          desconto,
          janela_horas: janela,
          estado: 'ativa',
          estoque: { separado, livre: separado, reservado: 0, retirado: 0, ajustado: 0, perda: 0 },
        }
        banco.ofertas.push(oferta)
        g.situacao = 'em_oferta'
        g.adiado_ate = null
        g.ofertaId = oferta.id
        return { oferta: d.paraOfertaLoja(oferta) }
      }),
  }
}
