/*
 * Implementação MOCK do ClienteApi: estado em memória a partir da semente.
 * Segue o contrato (formatos, códigos de erro); as regras que só o backend tem
 * ficam fingidas em regras-fingidas.ts. Só src/api/index.ts importa este arquivo.
 *
 * Grupos prontos no mock: A (acesso) e B (consumidor).
 * C–G entram junto com as telas deles (F6–F8) — decidido 11/11/2026.
 */
import type {
  ApiAcesso,
  ApiConfiguracao,
  ApiConsumidor,
  ApiGestor,
  ApiLotes,
  ApiOperacao,
  ApiProjecao,
  ApiServidor,
  ClienteApi,
} from '../cliente'
import { ErroApi, mensagemPadrao } from '../erros'
import type { Eu, Estoque, FaixaDesconto, LojaResumo, OfertaVitrine, Reserva, Sessao } from '../tipos'
import { isoBrasilia } from './datas'
import {
  calcularExpiraEm,
  economia,
  fitaDe,
  multiplicar,
  novoCodigo,
  processarVencimentos,
  quantidadeReservada,
} from './regras-fingidas'
import { criarSemente, type BancoMock, type OfertaMock, type ReservaMock, type UsuarioMock } from './semente'

export interface OpcoesMock {
  /** Token da sessão; null = visitante. */
  obterToken: () => string | null
  /** Relógio do mock (fixo nos testes). */
  agora?: () => Date
  /** Atraso artificial de cada resposta, para ver esqueletos e "carregando". */
  atrasoMs?: number
}

/** O ClienteApi + ganchos que só o mock tem (para testes e para recomeçar a demonstração). */
export interface ClienteMock extends ClienteApi {
  reiniciar(): void
  /** Estoque completo de uma oferta (conferir a conservação nos testes). */
  estoqueDe(ofertaId: number): Estoque
}

export function criarClienteMock({ obterToken, agora = () => new Date(), atrasoMs = 0 }: OpcoesMock): ClienteMock {
  let banco: BancoMock = criarSemente(agora())

  // ---------- Infraestrutura ----------

  /** Espera o atraso, expira o que venceu (como o backend em toda leitura) e devolve uma cópia. */
  async function responder<T>(executar: () => T): Promise<T> {
    if (atrasoMs > 0) await new Promise((r) => setTimeout(r, atrasoMs))
    processarVencimentos(banco, agora())
    return structuredClone(executar())
  }

  function erro(status: number, codigo: string, frase: string, extra: object = {}): ErroApi {
    return new ErroApi(status, codigo, frase, { erro: frase, codigo, ...extra })
  }

  function usuarioLogado(): UsuarioMock {
    const token = obterToken()
    const id = token ? banco.tokens.get(token) : undefined
    const usuario = banco.usuarios.find((u) => u.id === id)
    if (!usuario) throw erro(401, 'http_401', mensagemPadrao(401))
    return usuario
  }

  function abrirSessao(usuario: UsuarioMock): Sessao {
    const token = `mock-${usuario.id}-${Math.random().toString(36).slice(2, 10)}`
    banco.tokens.set(token, usuario.id)
    return { token, usuario: paraEu(usuario) }
  }

  // ---------- Conversões: modelo interno → formato do contrato ----------

  const paraEu = ({ id, nome, email, vinculos }: UsuarioMock): Eu => ({ id, nome, email, vinculos })

  function lojaResumo(lojaId: number): LojaResumo {
    const { id, nome, endereco } = banco.lojas.find((l) => l.id === lojaId)!
    return { id, nome, endereco }
  }

  function paraOfertaVitrine(o: OfertaMock, comDistancia: boolean): OfertaVitrine {
    return {
      id: o.id,
      produto: o.produto,
      loja: lojaResumo(o.lojaId),
      distancia_km: comDistancia ? banco.lojas.find((l) => l.id === o.lojaId)!.distancia_km : null,
      preco: o.preco,
      preco_original: o.preco_original,
      desconto: o.desconto,
      livre: o.estoque.livre,
      validade: o.validade,
      fim: isoBrasilia(o.fim),
      janela_horas: o.janela_horas,
      fita: fitaDe(o.validade),
    }
  }

  function paraReserva(r: ReservaMock): Reserva {
    const o = banco.ofertas.find((x) => x.id === r.ofertaId)!
    return {
      id: r.id,
      estado: r.estado,
      quantidade: r.quantidade,
      pedido: r.pedido,
      codigo: r.codigo,
      criada_em: isoBrasilia(r.criada_em),
      expira_em: isoBrasilia(r.expira_em),
      encerrada_em: r.encerrada_em ? isoBrasilia(r.encerrada_em) : null,
      total: multiplicar(o.preco, r.quantidade),
      economia: economia(o.preco_original, o.preco, r.quantidade),
      oferta: {
        id: o.id,
        produto: o.produto,
        preco: o.preco,
        preco_original: o.preco_original,
        fita: fitaDe(o.validade),
        loja: lojaResumo(o.lojaId),
      },
    }
  }

  function minhaReserva(id: number): ReservaMock {
    const usuario = usuarioLogado()
    const r = banco.reservas.find((x) => x.id === id && x.usuarioId === usuario.id)
    // Reserva de outra pessoa também dá 404 (não revela que existe).
    if (!r) throw erro(404, 'nao_encontrada', 'Reserva não encontrada.')
    return r
  }

  // ---------- /health ----------

  const servidor: ApiServidor = {
    saude: () => responder(() => undefined),
  }

  // ---------- A · Acesso ----------

  const acesso: ApiAcesso = {
    entrar: ({ email, senha }) =>
      responder(() => {
        const usuario = banco.usuarios.find((u) => u.email === email.trim().toLowerCase())
        if (!usuario || usuario.senha !== senha) {
          throw erro(400, 'credenciais_invalidas', 'E-mail ou senha incorretos.')
        }
        return abrirSessao(usuario)
      }),

    criarConta: ({ nome, email, senha, aceite_termos }) =>
      responder(() => {
        const emailLimpo = email.trim().toLowerCase()
        if (banco.usuarios.some((u) => u.email === emailLimpo)) {
          throw erro(400, 'email_em_uso', 'Já existe uma conta com este e-mail.')
        }
        if (senha.length < 8) throw erro(400, 'senha_curta', 'A senha precisa ter pelo menos 8 caracteres.')
        if (aceite_termos !== true) throw erro(400, 'termos', 'É preciso aceitar os termos de uso.')
        const usuario: UsuarioMock = { id: banco.proximoId++, nome: nome.trim(), email: emailLimpo, senha, vinculos: [] }
        banco.usuarios.push(usuario)
        return abrirSessao(usuario)
      }),

    sair: () =>
      responder(() => {
        const token = obterToken()
        if (token) banco.tokens.delete(token)
      }),

    eu: () => responder(() => paraEu(usuarioLogado())),
  }

  // ---------- B · Consumidor ----------

  const naFaixa = (desconto: number, faixa: FaixaDesconto) =>
    faixa === 'ate30' ? desconto <= 30 : faixa === '30a50' ? desconto > 30 && desconto < 50 : desconto >= 50

  const semAcento = (texto: string) =>
    texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

  const consumidor: ApiConsumidor = {
    listarOfertas: (filtros = {}) =>
      responder(() => {
        const comDistancia = filtros.lat !== undefined && filtros.lng !== undefined
        const busca = filtros.q ? semAcento(filtros.q.trim()) : ''
        return banco.ofertas
          .filter((o) => o.estado === 'ativa')
          .filter((o) => !filtros.categoria || o.produto.categoria === filtros.categoria)
          .filter((o) => !filtros.faixa_desconto || naFaixa(o.desconto, filtros.faixa_desconto))
          .filter((o) => !busca || semAcento(o.produto.nome).includes(busca))
          .map((o) => ({ oferta: o, vitrine: paraOfertaVitrine(o, comDistancia) }))
          .sort((a, b) =>
            comDistancia
              ? a.vitrine.distancia_km! - b.vitrine.distancia_km!
              : a.oferta.fim.getTime() - b.oferta.fim.getTime(),
          )
          .map((x) => x.vitrine)
      }),

    obterOferta: (id) =>
      responder(() => {
        const o = banco.ofertas.find((x) => x.id === id)
        if (!o) throw erro(404, 'nao_encontrada', 'Oferta não encontrada.')
        return { ...paraOfertaVitrine(o, false), estado: o.estado }
      }),

    reservar: (ofertaId, pedido) =>
      responder(() => {
        const usuario = usuarioLogado()
        const o = banco.ofertas.find((x) => x.id === ofertaId)
        if (!o) throw erro(404, 'nao_encontrada', 'Oferta não encontrada.')
        if (!Number.isInteger(pedido) || pedido < 1) {
          throw erro(400, 'pedido_invalido', 'Escolha pelo menos 1 unidade.')
        }
        if (o.estado !== 'ativa') throw erro(409, 'oferta_encerrada', 'Esta oferta já terminou.')

        const momento = agora()
        const quantidade = quantidadeReservada(pedido, o.estoque.livre)
        if (quantidade === 0) {
          banco.recusas.push({ ofertaId, usuarioId: usuario.id, pedido, criada_em: momento })
          return { status: 'recusada' as const, pedido, erro: 'Esgotou agora há pouco', codigo: 'esgotada' as const }
        }

        const ativosDaLoja = new Set(
          banco.reservas
            .filter((r) => r.estado === 'reservada')
            .filter((r) => banco.ofertas.find((x) => x.id === r.ofertaId)?.lojaId === o.lojaId)
            .map((r) => r.codigo),
        )
        const reserva: ReservaMock = {
          id: banco.proximoId++,
          ofertaId,
          usuarioId: usuario.id,
          cliente: abreviar(usuario.nome),
          quantidade,
          pedido,
          codigo: novoCodigo(ativosDaLoja),
          estado: 'reservada',
          criada_em: momento,
          expira_em: calcularExpiraEm(momento, o.janela_horas, o.fim),
          encerrada_em: null,
        }
        o.estoque.livre -= quantidade
        o.estoque.reservado += quantidade
        banco.reservas.push(reserva)
        return {
          status: quantidade < pedido ? ('parcial' as const) : ('confirmada' as const),
          reserva: paraReserva(reserva),
        }
      }),

    minhasReservas: (estado) =>
      responder(() => {
        const usuario = usuarioLogado()
        const minhas = banco.reservas.filter((r) => r.usuarioId === usuario.id)
        const ativas = minhas
          .filter((r) => r.estado === 'reservada')
          .sort((a, b) => a.expira_em.getTime() - b.expira_em.getTime())
        const encerradas = minhas
          .filter((r) => r.estado !== 'reservada')
          .sort((a, b) => b.encerrada_em!.getTime() - a.encerrada_em!.getTime())
        const lista = estado === 'ativa' ? ativas : estado === 'encerrada' ? encerradas : [...ativas, ...encerradas]
        return lista.map(paraReserva)
      }),

    obterReserva: (id) => responder(() => paraReserva(minhaReserva(id))),

    cancelarReserva: (id) =>
      responder(() => {
        const r = minhaReserva(id)
        if (r.estado !== 'reservada') throw erro(409, 'nao_ativa', 'Esta reserva não está mais ativa.')
        const o = banco.ofertas.find((x) => x.id === r.ofertaId)!
        r.estado = 'cancelada'
        r.encerrada_em = agora()
        o.estoque.reservado -= r.quantidade
        o.estoque.livre += r.quantidade
        return paraReserva(r)
      }),
  }

  return {
    servidor,
    acesso,
    consumidor,
    operacao: pendente<ApiOperacao>('operacao', 'F6'),
    lotes: pendente<ApiLotes>('lotes', 'F8'),
    configuracao: pendente<ApiConfiguracao>('configuracao', 'F8'),
    gestor: pendente<ApiGestor>('gestor', 'F7'),
    projecao: pendente<ApiProjecao>('projecao', 'F7'),

    reiniciar() {
      banco = criarSemente(agora())
    },
    estoqueDe(ofertaId) {
      processarVencimentos(banco, agora())
      return structuredClone(banco.ofertas.find((o) => o.id === ofertaId)!.estoque)
    },
  }
}

/** "Ana Souza" → "Ana S." (como a loja vê o cliente). */
function abreviar(nome: string): string {
  const [primeiro, ...resto] = nome.trim().split(/\s+/)
  const ultimo = resto.at(-1)
  return ultimo ? `${primeiro} ${ultimo[0]}.` : primeiro
}

/** Grupo ainda sem mock: qualquer método rejeita dizendo em que etapa ele entra. */
function pendente<T extends object>(parte: string, etapa: string): T {
  return new Proxy({} as T, {
    get: (_alvo, metodo) => () =>
      Promise.reject(new Error(`Mock de ${parte}.${String(metodo)} ainda não feito (entra na etapa ${etapa}).`)),
  })
}
