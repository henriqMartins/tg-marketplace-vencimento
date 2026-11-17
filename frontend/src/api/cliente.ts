/*
 * Interface do cliente da API — a "tomada" que as telas usam.
 * Dividida pelos grupos do contrato (A…G) para ligar o backend real aos poucos.
 * Duas implementações: mock (src/api/mock) e http (src/api/http).
 *
 * Erros: os métodos rejeitam com ErroApi (src/api/erros.ts).
 * Exceção de propósito: reservar() devolve a recusa (409) como resultado.
 */
import type {
  AvisoDetalhe,
  EntradaAjuste,
  EntradaConta,
  EntradaLogin,
  EntradaLote,
  EntradaProduto,
  EntradaPublicar,
  EntradaVinculo,
  EstadoOferta,
  Eu,
  FiltroMinhasReservas,
  FiltrosGrupos,
  FiltrosHistorico,
  FiltrosProjecao,
  FiltrosVitrine,
  Grupo,
  Historico,
  Indicadores,
  ListaAvisos,
  LojaConfig,
  MotivoDescarte,
  OfertaLoja,
  OfertaLojaDetalhe,
  OfertaPublica,
  OfertaVitrine,
  Produto,
  Projecao,
  Reserva,
  ResultadoAjuste,
  ResultadoLote,
  ResultadoPublicar,
  ResultadoReserva,
  ResumoDoDia,
  RetiradaFeita,
  RetiradaPrevia,
  Sessao,
  VinculoLoja,
  Data,
  Papel,
} from './tipos'

/** A · Acesso — A1–A5, C9. */
export interface ApiAcesso {
  /** POST /api/auth/login · 400 credenciais_invalidas */
  entrar(entrada: EntradaLogin): Promise<Sessao>
  /** POST /api/auth/conta · 400 sem_nome | email_invalido | senha_curta | termos | email_em_uso */
  criarConta(entrada: EntradaConta): Promise<Sessao>
  /** POST /api/auth/sair · 204 */
  sair(): Promise<void>
  /** GET /api/eu · 401 */
  eu(): Promise<Eu>
}

/** B · Consumidor — C2–C8. */
export interface ApiConsumidor {
  /** GET /api/ofertas (pública) */
  listarOfertas(filtros?: FiltrosVitrine): Promise<OfertaVitrine[]>
  /** GET /api/ofertas/{id} (pública) · 404 nao_encontrada */
  obterOferta(id: number): Promise<OfertaPublica>
  /** POST /api/ofertas/{id}/reservas · 401, 400 pedido_invalido, 409 oferta_encerrada. Recusa = resultado. */
  reservar(ofertaId: number, pedido: number): Promise<ResultadoReserva>
  /** GET /api/minhas-reservas?estado= · 401 */
  minhasReservas(estado?: FiltroMinhasReservas): Promise<Reserva[]>
  /** GET /api/reservas/{id} · 404 (inclusive de outra pessoa) */
  obterReserva(id: number): Promise<Reserva>
  /** POST /api/reservas/{id}/cancelar · 404, 409 nao_ativa */
  cancelarReserva(id: number): Promise<Reserva>
}

/** C · Operação da loja — L1, L9–L13. */
export interface ApiOperacao {
  resumoDoDia(lojaId: number): Promise<ResumoDoDia>
  listarOfertas(lojaId: number, estado?: EstadoOferta): Promise<OfertaLoja[]>
  obterOferta(lojaId: number, ofertaId: number): Promise<OfertaLojaDetalhe>
  /** 409 acima_do_livre (corpo traz `livre`), 400 sem_motivo, 409 oferta_encerrada */
  ajustar(lojaId: number, ofertaId: number, entrada: EntradaAjuste): Promise<ResultadoAjuste>
  /** GET …/reservas/ativa?codigo= · 404 nao_encontrada */
  previaRetirada(lojaId: number, codigo: string): Promise<RetiradaPrevia>
  /** POST …/retiradas {codigo} · 404 nao_encontrada, 409 venceu */
  retirar(lojaId: number, codigo: string): Promise<RetiradaFeita>
}

/** D · Lote, fita e aviso — L2–L8, L4/G5. */
export interface ApiLotes {
  listarProdutos(lojaId: number, q?: string): Promise<Produto[]>
  criarProduto(lojaId: number, entrada: EntradaProduto): Promise<Produto>
  cadastrarLote(lojaId: number, entrada: EntradaLote): Promise<ResultadoLote>
  listarGrupos(lojaId: number, filtros?: FiltrosGrupos): Promise<Grupo[]>
  listarAvisos(lojaId: number): Promise<ListaAvisos>
  obterAviso(lojaId: number, avisoId: number): Promise<AvisoDetalhe>
  /** 400 apos_limite */
  adiarAviso(lojaId: number, avisoId: number, ate: Data): Promise<Grupo>
  descartarAviso(lojaId: number, avisoId: number, motivo: MotivoDescarte): Promise<Grupo>
  /** 400 sem_confirmacao | preco_invalido, 409 fim_ja_passou */
  publicarAviso(lojaId: number, avisoId: number, entrada: EntradaPublicar): Promise<ResultadoPublicar>
}

/** E · Configuração da loja — L14/G6. Escrita só do responsável (403). */
export interface ApiConfiguracao {
  obterLoja(lojaId: number): Promise<LojaConfig>
  atualizarLoja(lojaId: number, campos: Partial<Omit<LojaConfig, 'id'>>): Promise<LojaConfig>
  listarVinculos(lojaId: number): Promise<VinculoLoja[]>
  /** 404 conta_nao_existe, 409 ja_vinculado */
  criarVinculo(lojaId: number, entrada: EntradaVinculo): Promise<VinculoLoja>
  /** PEDIDO-API 4 (aceito): PATCH …/vinculos/{id} {papel} · 400 papel_invalido, 404, 409 proprio_vinculo | ultimo_responsavel */
  alterarPapel(lojaId: number, vinculoId: number, papel: Papel): Promise<VinculoLoja>
  /** 409 ultimo_responsavel | proprio_vinculo */
  removerVinculo(lojaId: number, vinculoId: number): Promise<void>
}

/** F · Gestor — G1, G3, G4. Só responsável. */
export interface ApiGestor {
  indicadores(lojaId: number, de: Data, ate: Data): Promise<Indicadores>
  historico(lojaId: number, filtros?: FiltrosHistorico): Promise<Historico>
}

/** G · Projeção — G2. Só responsável. */
export interface ApiProjecao {
  projecao(lojaId: number, filtros?: FiltrosProjecao): Promise<Projecao>
}

/** Fora dos grupos: GET /health (convenções do contrato) — "o servidor está acordado?". */
export interface ApiServidor {
  saude(): Promise<void>
}

export interface ClienteApi {
  servidor: ApiServidor
  acesso: ApiAcesso
  consumidor: ApiConsumidor
  operacao: ApiOperacao
  lotes: ApiLotes
  configuracao: ApiConfiguracao
  gestor: ApiGestor
  projecao: ApiProjecao
}

/** Letras dos grupos, como na tabela de status do contrato. H (push) fica fora até depois de 09/11. */
export type GrupoContrato = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export const GRUPOS: readonly GrupoContrato[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

/** Qual parte do ClienteApi atende cada grupo do contrato. */
export const PARTE_DO_GRUPO = {
  A: 'acesso',
  B: 'consumidor',
  C: 'operacao',
  D: 'lotes',
  E: 'configuracao',
  F: 'gestor',
  G: 'projecao',
} as const satisfies Record<GrupoContrato, keyof ClienteApi>
