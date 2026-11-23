/*
 * Tipos do contrato da API — espelho de docs/api/contrato.md (versão 0, 05/11/2026).
 * Nomes de campo IGUAIS aos do JSON. Mudou o contrato → muda aqui (e o build aponta
 * cada tela e o mock que precisam acompanhar).
 */

// ---------- Formatos básicos (convenções do contrato) ----------

/** Texto decimal com 2 casas, ex.: "3.14". Nunca converter para number em conta. */
export type Dinheiro = string
/** ISO 8601 com fuso, ex.: "2026-10-22T20:00:00-03:00". */
export type DataHora = string
/** Data sem hora, ex.: "2026-10-28". */
export type Data = string
/** Taxa de 0 a 1, ou null quando a base é zero. */
export type Taxa = number | null

// ---------- Valores fixos (enumerações) ----------

export type Categoria = 'mercearia' | 'enlatados' | 'laticinios' | 'leite' | 'frios' | 'doces'

/** Lista única para vitrine e cadastro, na ordem do contrato. */
export const CATEGORIAS: readonly { valor: Categoria; rotulo: string }[] = [
  { valor: 'mercearia', rotulo: 'Mercearia' },
  { valor: 'enlatados', rotulo: 'Enlatados' },
  { valor: 'laticinios', rotulo: 'Laticínios' },
  { valor: 'leite', rotulo: 'Leite' },
  { valor: 'frios', rotulo: 'Frios' },
  { valor: 'doces', rotulo: 'Doces' },
]

export type CorFita = 'vermelho' | 'amarelo' | 'verde' | 'azul' | 'branco' | 'preto'
export type EstadoReserva = 'reservada' | 'retirada' | 'expirada' | 'cancelada'
export type EstadoOferta = 'ativa' | 'encerrada'
export type Papel = 'responsavel' | 'funcionario'
export type SituacaoGrupo = 'aguardando' | 'conferir' | 'adiado' | 'em_oferta' | 'encerrado'
export type FaixaDesconto = 'ate30' | '30a50' | '50mais'

// ---------- Objetos que se repetem ----------

export interface LojaResumo {
  id: number
  nome: string
  endereco: string
}

/** Conservação: separado = livre + reservado + retirado + ajustado + perda. */
export interface Estoque {
  separado: number
  livre: number
  reservado: number
  retirado: number
  ajustado: number
  perda: number
}

export interface Fita {
  cor: CorFita
  /** Ex.: "set–out". */
  bimestre: string
  ano: number
}

export interface ProdutoResumo {
  nome: string
  categoria: Categoria
}

// ---------- A · Acesso ----------

export interface VinculoEu {
  loja: { id: number; nome: string }
  papel: Papel
}

/** Sem vínculos = consumidor. */
export interface Eu {
  id: number
  nome: string
  email: string
  vinculos: VinculoEu[]
  /** Grupo I: a pessoa é da equipe da plataforma (is_staff). */
  plataforma: boolean
  /** O pedido de parceria EM ABERTO da pessoa, inteiro (pedido 5, aceito), ou null. */
  interesse: Interesse | null
}

export interface Sessao {
  token: string
  usuario: Eu
}

export interface EntradaLogin {
  email: string
  senha: string
}

export interface EntradaConta {
  nome: string
  email: string
  senha: string
  aceite_termos: true
}

// ---------- B · Consumidor ----------

export interface FiltrosVitrine {
  /** Coordenada já convertida no navegador; sem lat/lng a lista não ordena por distância. */
  lat?: number
  lng?: number
  categoria?: Categoria
  faixa_desconto?: FaixaDesconto
  /** Busca no nome. */
  q?: string
}

export interface OfertaVitrine {
  id: number
  produto: ProdutoResumo
  loja: LojaResumo
  /** null sem lat/lng. */
  distancia_km: number | null
  preco: Dinheiro
  preco_original: Dinheiro
  desconto: number
  /** Já desconta reservas vencidas ainda não processadas. */
  livre: number
  validade: Data
  fim: DataHora
  janela_horas: number
  fita: Fita
}

/** GET /api/ofertas/{id}: a mesma oferta + o estado (campo extra só nesta rota). */
export interface OfertaPublica extends OfertaVitrine {
  estado: EstadoOferta
  /**
   * PEDIDO-API 1 (aberto, docs/api/pedidos-do-front.md): limite de retirada SE reservar agora,
   * mín(agora + janela, fim), calculado pelo backend. Opcional até o pedido ser aceito.
   */
  retirar_ate?: DataHora | null
}

/** Reserva na visão do consumidor (dono). */
export interface Reserva {
  id: number
  estado: EstadoReserva
  quantidade: number
  pedido: number
  /** Completo só para o dono da reserva. */
  codigo: string
  criada_em: DataHora
  /** mín(agora + janela, fim) — calculado no backend. */
  expira_em: DataHora
  /** Preenchido em retirada/expirada/cancelada. */
  encerrada_em: DataHora | null
  total: Dinheiro
  economia: Dinheiro
  oferta: {
    id: number
    produto: ProdutoResumo
    preco: Dinheiro
    preco_original: Dinheiro
    fita: Fita
    loja: LojaResumo
  }
}

/**
 * Resultado de POST /api/ofertas/{id}/reservas.
 * confirmada (quantidade == pedido) e parcial (quantidade < pedido) chegam como 201;
 * recusada chega como 409, mas o cliente a devolve como resultado, não como erro.
 */
export type ResultadoReserva =
  | { status: 'confirmada' | 'parcial'; reserva: Reserva }
  | { status: 'recusada'; pedido: number; erro: string; codigo: 'esgotada' }

export type FiltroMinhasReservas = 'ativa' | 'encerrada'

// ---------- C · Operação da loja ----------

export interface ResumoDoDia {
  loja: LojaResumo
  papel: Papel
  aguardando_retirada: number
  expiram_em_1h: number
  ofertas_ativas: number
  avisos_para_conferir: number
}

export interface OfertaLoja {
  id: number
  produto: ProdutoResumo
  fita: Fita
  validade: Data
  preco: Dinheiro
  preco_original: Dinheiro
  desconto: number
  janela_horas: number
  inicio: DataHora
  fim: DataHora
  estado: EstadoOferta
  estoque: Estoque
}

/** Reserva na visão da loja: o código vem MASCARADO (só o final). */
export interface ReservaLoja {
  id: number
  codigo_final: string
  quantidade: number
  pedido: number
  estado: EstadoReserva
  /** Ex.: "Ana S." */
  cliente: string
  criada_em: DataHora
  expira_em: DataHora
  encerrada_em: DataHora | null
}

/** Ativas na oferta ativa; todas na encerrada. */
export interface OfertaLojaDetalhe extends OfertaLoja {
  reservas: ReservaLoja[]
}

export interface EntradaAjuste {
  quantidade: number
  motivo: string
}

export interface ResultadoAjuste {
  estoque: Estoque
}

export interface RetiradaPrevia {
  reserva: ReservaLoja
  codigo: string
  total: Dinheiro
  produto: string
  fita: Fita
  /** PEDIDO-API 3 (aberto): validade, para a amostra da fita sair com a data exata. */
  validade?: Data
}

export interface RetiradaFeita {
  reserva: ReservaLoja
  total: Dinheiro
  retirada_por: string
  oferta: { id: number; estoque: Estoque }
}

// ---------- D · Lote, fita e aviso ----------

export interface Produto {
  id: number
  nome: string
  categoria: Categoria
  /** null = usa a da loja. */
  margem_fim_dias: number | null
  margem_efetiva_dias: number
  /** Da última oferta do produto; null se nunca teve oferta. */
  ultimo_preco_original: Dinheiro | null
}

export interface EntradaProduto {
  nome: string
  categoria: Categoria
  margem_fim_dias: number | null
}

export interface Lote {
  id: number
  validade: Data
  quantidade: number
  recebido_em: Data
}

export interface EntradaLote {
  /** Id do produto. */
  produto: number
  validade: Data
  quantidade: number
}

export interface Colisao {
  validade: Data
}

/** Grupo = produto + cor + ano do bimestre. */
export interface Grupo {
  id: number
  produto: { id: number; nome: string }
  fita: Fita
  /** A validade mais próxima entre os lotes do grupo. */
  referencia: Data
  situacao: SituacaoGrupo
  /** referência − antecedência da loja. */
  aviso_em: Data
  /** null se não adiado. */
  adiado_ate: Data | null
  colisao: Colisao | null
  /** Completo com ?com_lotes=1; na lista pode vir só a contagem (qtd_lotes, recebido). */
  lotes?: Lote[]
  qtd_lotes?: number
  recebido?: number
  /** Preenchido em "em_oferta" e "encerrado" com oferta. */
  oferta_id: number | null
}

export type ResultadoCadastroLote = 'novo' | 'agrupado' | 'colisao'

export interface ResultadoLote {
  lote: Lote
  grupo: Grupo
  resultado: ResultadoCadastroLote
  /** null quando não há. */
  colisao: Colisao | null
}

export interface FiltrosGrupos {
  cor?: CorFita
  situacao?: SituacaoGrupo
  com_lotes?: boolean
}

/** O aviso é o grupo em situação "conferir" ou "adiado"; o id é o do grupo. */
export interface Aviso {
  id: number
  grupo: Grupo
  vence_em_dias: number
  /** Até 7 dias. */
  urgente: boolean
}

export interface ListaAvisos {
  antecedencia_dias: number
  avisos: Aviso[]
}

export interface AvisoDetalhe {
  grupo: Grupo
  /** = produto.ultimo_preco_original; null na primeira oferta. */
  preco_sugerido: Dinheiro | null
  janela_padrao_horas: number
  /** 23:59 do dia (validade − margem efetiva). */
  fim_previsto: DataHora
  /** Véspera do último dia da oferta. */
  adiar_ate_max: Data
  margem_efetiva_dias: number
}

export type MotivoDescarte = 'sem_unidades' | 'outro_destino'

export interface EntradaPublicar {
  separado: number
  preco_original: Dinheiro
  /** Opções: 20, 30, 40, 50. */
  desconto: number
  janela_horas: number
  confirmou_separacao: true
}

export interface ResultadoPublicar {
  oferta: OfertaLoja
}

// ---------- E · Configuração da loja ----------

export interface LojaConfig {
  id: number
  nome: string
  endereco: string
  /** null = sem coordenada (a loja vai para o fim da lista por distância). Vão sempre juntas. */
  latitude: number | null
  longitude: number | null
  /** Opções: 1, 2, 4, 8, 12, 24. */
  janela_padrao_horas: number
  /** 0–7 dias. */
  margem_fim_dias: number
  /** 1–30 dias, sempre maior que a margem. */
  antecedencia_aviso_dias: number
}

export interface VinculoLoja {
  id: number
  usuario: { nome: string; email: string }
  papel: Papel
  /** true quando o vínculo é de quem está logado. */
  eu: boolean
}

export interface EntradaVinculo {
  email: string
  papel: Papel
}

// ---------- F · Gestor ----------

export interface Indicadores {
  de: Data
  ate: Data
  reservas_criadas: number
  encerradas: { total: number; retiradas: number; expiradas: number; canceladas: number }
  /** retiradas ÷ encerradas. */
  taxa_retirada: Taxa
  /** expiradas ÷ encerradas. */
  taxa_expiracao: Taxa
  bloqueados: { total: number; recusas: number; parciais: number }
  /** Sobra livre das ofertas encerradas no período. */
  perda_unidades: number
  semanas: { inicio: Data; retiradas: number; expiradas: number; canceladas: number }[]
}

export type EstadoHistorico = EstadoReserva | 'recusa'

export interface FiltrosHistorico {
  de?: Data
  ate?: Data
  estado?: EstadoHistorico
  /** Produto ou final do código. */
  q?: string
}

export interface ItemHistorico {
  tipo: 'reserva' | 'recusa'
  criada_em: DataHora
  codigo_final: string | null
  produto: string
  quantidade: number
  pedido: number
  cliente: string
  estado: EstadoHistorico
  encerrada_em: DataHora | null
}

export interface Historico {
  total_reservas: number
  total_recusas: number
  itens: ItemHistorico[]
}

// ---------- G · Projeção ----------

export type FaixaLote = '5-14' | '15-24' | '25-34' | '35-44' | '45-60'
export type FaixaProcura = '0.3-0.8' | '0.8-1.3' | '1.3-1.8' | '1.8-2.3' | '2.3-3.0'
/** Mediana do tempo até o cliente chegar, em horas. Padrão: 2. */
export type Chegada = 1 | 2 | 4

export interface FiltrosProjecao {
  lote?: FaixaLote
  procura?: FaixaProcura
  chegada?: Chegada
}

export interface Projecao {
  /** Quantas rodadas simuladas entram na conta. */
  rodadas: number
  filtro: { lote: FaixaLote | null; procura: FaixaProcura | null; chegada: Chegada }
  /** As 7 janelas vêm sempre; sem nenhuma rodada no filtro (rodadas: 0), os números vêm null. */
  janelas: {
    janela_horas: number
    perda_pct: number | null
    bloqueados_pct: number | null
    retirada_pct: number | null
  }[]
}

// ---------- I · Parceria (docs/parceria.md, seção 3) ----------

/** Em aberto = novo ou em_conversa (um por pessoa). */
export type EstadoInteresse = 'novo' | 'em_conversa' | 'virou_loja' | 'descartado'

export interface Interesse {
  id: number
  estado: EstadoInteresse
  criado_em: DataHora
  nome_mercado: string
  cidade: string
  telefone: string
  mensagem: string
  pessoa: { nome: string; email: string }
  motivo_descarte: string | null
  loja_id: number | null
}

export interface EntradaInteresse {
  nome_mercado: string
  cidade: string
  telefone: string
  mensagem?: string
}

export interface EntradaEstadoInteresse {
  estado: 'em_conversa' | 'descartado'
  motivo?: string
}

/** Consulta à Receita (BrasilAPI), normalizada pelo backend. */
export interface ConsultaCnpj {
  cnpj: string
  razao_social: string
  nome_fantasia: string
  situacao: string
  ativa: boolean
  cnae_principal: { codigo: string; descricao: string }
  /** CNAE no varejo de alimentos (47.1 e 47.2). Só informativo. */
  alimentar: boolean
  endereco: { logradouro: string; numero: string; bairro: string; municipio: string; uf: string; cep: string }
}

export type EstadoConvite = 'pendente' | 'vencido' | 'aceito'

export interface LojaPlataforma {
  id: number
  nome: string
  cnpj: string | null
  /** false quando a consulta à Receita falhou no cadastro. */
  cnpj_verificado: boolean
  endereco: string
  telefone: string
  criada_em: DataHora
  responsavel: { nome: string; email: string } | null
  convite: {
    email: string
    expira_em: DataHora
    estado: EstadoConvite
    /** Só com estado "pendente"; senão null (pedido 6, aceito): a P2 copia o link de novo. */
    codigo: string | null
  } | null
}

export interface EntradaLojaPlataforma {
  cnpj: string
  nome: string
  endereco: string
  latitude: number | null
  longitude: number | null
  telefone: string
  email_responsavel: string
  interesse_id?: number
}

export interface Convite {
  codigo: string
  email: string
  expira_em: DataHora
}

export interface LojaCadastrada {
  loja: LojaPlataforma
  convite: Convite
}

/** GET /api/convites/{codigo}: o que a A7 mostra antes do aceite. */
export interface ConviteAberto {
  loja: { nome: string; endereco: string }
  email: string
  expira_em: DataHora
}

/** Vínculo devolvido no aceite, no formato de `Eu.vinculos` (pedido 7, aceito). */
export interface ConviteAceito {
  vinculo: VinculoEu
}
