/*
 * Dados de exemplo do mock — o `seed()` do protótipo (docs/frontend/referencia/claude-design/
 * Main.dc.html) convertido para o formato do contrato.
 *
 * As datas são RELATIVAS ao momento em que o mock nasce (decidido 11/11/2026): o protótipo
 * fixava "hoje" = 22/10/2026 às 16:00; aqui "hoje" é o dia real e as distâncias de tempo
 * se mantêm (ex.: a reserva da Ana expira em 3 h 42 min; o iogurte vence em 6 dias).
 */
import type {
  Categoria,
  Data,
  Dinheiro,
  EstadoOferta,
  EstadoReserva,
  Estoque,
  LojaResumo,
  VinculoEu,
} from '../tipos'
import { dataBrasilia, somarDias, somarMinutos } from './datas'
import { gerarHistorico } from './historico'
import { fimDaOferta } from './regras-fingidas'

// ---------- Modelo interno do mock (não é o formato do contrato) ----------

export interface UsuarioMock {
  id: number
  nome: string
  email: string
  senha: string
  vinculos: VinculoEu[]
}

export interface LojaMock extends LojaResumo {
  /** Distância fingida até "você" (o mock não calcula Haversine). */
  distancia_km: number
}

export interface OfertaMock {
  id: number
  lojaId: number
  produto: { nome: string; categoria: Categoria }
  validade: Data
  inicio: Date
  fim: Date
  preco: Dinheiro
  preco_original: Dinheiro
  desconto: number
  janela_horas: number
  estado: EstadoOferta
  estoque: Estoque
}

export interface ReservaMock {
  id: number
  ofertaId: number
  usuarioId: number
  /** Nome curto como a loja vê ("Ana S."). */
  cliente: string
  quantidade: number
  pedido: number
  codigo: string
  estado: EstadoReserva
  criada_em: Date
  expira_em: Date
  encerrada_em: Date | null
}

export interface RecusaMock {
  ofertaId: number
  usuarioId: number
  /** Nome curto como a loja vê ("Bruno M."). */
  cliente: string
  pedido: number
  criada_em: Date
}

export interface BancoMock {
  usuarios: UsuarioMock[]
  lojas: LojaMock[]
  ofertas: OfertaMock[]
  reservas: ReservaMock[]
  recusas: RecusaMock[]
  /** token → id do usuário */
  tokens: Map<string, number>
  proximoId: number
}

/** Senha de todos os usuários do mock. */
export const SENHA_MOCK = '12345678'

export const USUARIO = {
  carlos: 1, // responsável do Mercadinho Vila Nova
  juliana: 2, // funcionária do Mercadinho Vila Nova
  ana: 7, // consumidora
} as const

const MARGEM_DIAS = 1
const JANELA_HORAS = 4

export function criarSemente(agora: Date): BancoMock {
  const hoje = dataBrasilia(agora)
  const haDias = (dias: number) => somarMinutos(agora, -dias * 24 * 60)

  const usuarios: UsuarioMock[] = [
    {
      id: USUARIO.carlos,
      nome: 'Carlos Lima',
      email: 'carlos@vilanova.com.br',
      senha: SENHA_MOCK,
      vinculos: [{ loja: { id: 1, nome: 'Mercadinho Vila Nova' }, papel: 'responsavel' }],
    },
    {
      id: USUARIO.juliana,
      nome: 'Juliana Prado',
      email: 'juliana.prado@email.com',
      senha: SENHA_MOCK,
      vinculos: [{ loja: { id: 1, nome: 'Mercadinho Vila Nova' }, papel: 'funcionario' }],
    },
    { id: USUARIO.ana, nome: 'Ana Souza', email: 'ana@email.com', senha: SENHA_MOCK, vinculos: [] },
  ]

  const lojas: LojaMock[] = [
    { id: 1, nome: 'Mercadinho Vila Nova', endereco: 'Rua das Palmeiras, 410 · Boa Vista', distancia_km: 0.4 },
    { id: 2, nome: 'Empório Santa Cruz', endereco: 'Av. Brasil, 1290 · Santa Cruz', distancia_km: 1.1 },
    { id: 3, nome: 'Mercado Bom Preço', endereco: 'Rua Ipiranga, 77 · Centro', distancia_km: 1.8 },
  ]

  /** Oferta do seed; `venceEm` = dias de hoje até a validade. */
  const oferta = (
    o: Omit<OfertaMock, 'validade' | 'inicio' | 'fim' | 'janela_horas' | 'estado' | 'estoque'> & {
      venceEm: number
      estoque: Partial<Estoque> & Pick<Estoque, 'separado' | 'livre'>
      estado?: EstadoOferta
    },
  ): OfertaMock => {
    const { venceEm, estoque, estado = 'ativa', ...resto } = o
    const validade = somarDias(hoje, venceEm)
    return {
      ...resto,
      validade,
      inicio: haDias(7),
      fim: fimDaOferta(validade, MARGEM_DIAS),
      janela_horas: JANELA_HORAS,
      estado,
      estoque: { reservado: 0, retirado: 0, ajustado: 0, perda: 0, ...estoque },
    }
  }

  const ofertas: OfertaMock[] = [
    oferta({
      id: 1, lojaId: 1, produto: { nome: 'Iogurte natural 170 g', categoria: 'laticinios' },
      venceEm: 6, preco: '3.14', preco_original: '4.49', desconto: 30,
      estoque: { separado: 12, livre: 6, reservado: 4, retirado: 2 },
    }),
    oferta({
      id: 2, lojaId: 1, produto: { nome: 'Presunto fatiado 200 g', categoria: 'frios' },
      venceEm: 8, preco: '4.74', preco_original: '7.90', desconto: 40,
      estoque: { separado: 8, livre: 5, reservado: 2, retirado: 1 },
    }),
    oferta({
      id: 3, lojaId: 2, produto: { nome: 'Biscoito recheado 140 g', categoria: 'doces' },
      venceEm: 14, preco: '2.40', preco_original: '3.20', desconto: 25,
      estoque: { separado: 10, livre: 10 },
    }),
    oferta({
      id: 4, lojaId: 3, produto: { nome: 'Molho de tomate 340 g', categoria: 'mercearia' },
      venceEm: 9, preco: '1.49', preco_original: '2.98', desconto: 50,
      estoque: { separado: 6, livre: 2, reservado: 3, retirado: 1 },
    }),
    oferta({
      // fim amanhã, 23:59: a oferta "acabando"
      id: 5, lojaId: 1, produto: { nome: 'Queijo minas frescal 250 g', categoria: 'laticinios' },
      venceEm: 2, preco: '8.39', preco_original: '13.99', desconto: 40,
      estoque: { separado: 8, livre: 3, retirado: 5 },
    }),
    oferta({
      id: 6, lojaId: 1, produto: { nome: 'Requeijão cremoso 200 g', categoria: 'laticinios' },
      venceEm: -1, preco: '4.19', preco_original: '6.99', desconto: 40, estado: 'encerrada',
      estoque: { separado: 10, livre: 0, retirado: 6, ajustado: 1, perda: 3 },
    }),
  ]

  /** Reserva ativa que expira daqui a `expiraEmMin` minutos. */
  const ativa = (
    id: number, ofertaId: number, usuarioId: number, cliente: string,
    quantidade: number, codigo: string, expiraEmMin: number,
  ): ReservaMock => {
    const expira_em = somarMinutos(agora, expiraEmMin)
    return {
      id, ofertaId, usuarioId, cliente, quantidade, pedido: quantidade, codigo,
      estado: 'reservada', criada_em: somarMinutos(expira_em, -JANELA_HORAS * 60), expira_em, encerrada_em: null,
    }
  }

  /** Reserva já encerrada há `diasAtras` dias. */
  const encerrada = (
    id: number, ofertaId: number, estado: Exclude<EstadoReserva, 'reservada'>,
    quantidade: number, codigo: string, diasAtras: number,
  ): ReservaMock => {
    const criada_em = haDias(diasAtras + 1)
    const expira_em = somarMinutos(criada_em, JANELA_HORAS * 60)
    return {
      id, ofertaId, usuarioId: USUARIO.ana, cliente: 'Ana S.', quantidade, pedido: quantidade, codigo, estado,
      criada_em, expira_em, encerrada_em: estado === 'expirada' ? expira_em : haDias(diasAtras),
    }
  }

  const reservas: ReservaMock[] = [
    ativa(31, 1, USUARIO.ana, 'Ana S.', 2, '482917', 222), // 3 h 42 min
    ativa(32, 1, 11, 'Bruno M.', 1, '305118', 52),
    ativa(33, 1, 12, 'Carla R.', 1, '771204', 292),
    ativa(34, 2, 13, 'Diego P.', 2, '619033', 22),
    ativa(35, 4, 14, 'Elisa T.', 3, '208455', 72),
    encerrada(36, 6, 'retirada', 1, '118340', 2),
    encerrada(37, 3, 'expirada', 2, '640921', 4),
    encerrada(38, 5, 'cancelada', 1, '993021', 5),
  ]

  // ~35 dias de ofertas encerradas da loja 1, para o painel e o histórico do gestor (F7).
  const historico = gerarHistorico(agora)

  return {
    usuarios,
    lojas,
    ofertas: [...ofertas, ...historico.ofertas],
    reservas: [...reservas, ...historico.reservas],
    recusas: historico.recusas,
    tokens: new Map(),
    proximoId: 5000,
  }
}
