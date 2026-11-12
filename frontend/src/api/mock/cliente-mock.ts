/*
 * Implementação MOCK do ClienteApi: estado em memória a partir da semente.
 * Segue o contrato (formatos, códigos de erro); as regras que só o backend tem
 * ficam fingidas em regras-fingidas.ts. Só src/api/index.ts importa este arquivo.
 *
 * Grupos prontos no mock: A (acesso), B (consumidor) e C (operação da loja).
 * D–G entram junto com as telas deles (F7–F8) — decidido 11/11/2026.
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
import type {
  Eu,
  Estoque,
  FaixaDesconto,
  LojaResumo,
  OfertaLoja,
  OfertaVitrine,
  Reserva,
  ReservaLoja,
  Sessao,
} from '../tipos'
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
import { carregar, salvar, type Guarda } from './persistencia'
import { criarSemente, type BancoMock, type OfertaMock, type ReservaMock, type UsuarioMock } from './semente'

export interface OpcoesMock {
  /** Token da sessão; null = visitante. */
  obterToken: () => string | null
  /** Relógio do mock (fixo nos testes). */
  agora?: () => Date
  /** Atraso artificial de cada resposta, para ver esqueletos e "carregando". */
  atrasoMs?: number
  /** Onde guardar o estado entre recargas da página (sessionStorage no app; nada nos testes). */
  persistencia?: Guarda | null
}

/** O ClienteApi + ganchos que só o mock tem (para testes e para recomeçar a demonstração). */
export interface ClienteMock extends ClienteApi {
  reiniciar(): void
  /** Estoque completo de uma oferta (conferir a conservação nos testes). */
  estoqueDe(ofertaId: number): Estoque
}

export function criarClienteMock({
  obterToken,
  agora = () => new Date(),
  atrasoMs = 0,
  persistencia = null,
}: OpcoesMock): ClienteMock {
  let banco: BancoMock = carregar(persistencia) ?? criarSemente(agora())

  // ---------- Infraestrutura ----------

  /** Espera o atraso, expira o que venceu (como o backend em toda leitura) e devolve uma cópia. */
  async function responder<T>(executar: () => T): Promise<T> {
    if (atrasoMs > 0) await new Promise((r) => setTimeout(r, atrasoMs))
    processarVencimentos(banco, agora())
    try {
      return structuredClone(executar())
    } finally {
      salvar(persistencia, banco) // também quando dá erro: uma recusa fica registrada
    }
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
          throw erro(400, 'credenciais_invalidas', 'E-mail ou senha incorretos. Confira e tente de novo.')
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
        return {
          ...paraOfertaVitrine(o, false),
          estado: o.estado,
          // PEDIDO-API 1: simulado aqui, com a mesma conta do expira_em da reserva.
          retirar_ate: o.estado === 'ativa' ? isoBrasilia(calcularExpiraEm(agora(), o.janela_horas, o.fim)) : null,
        }
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

  // ---------- C · Operação da loja ----------

  /** Exige vínculo com a loja (funcionário ou responsável); sem vínculo, 403. */
  function vinculoCom(lojaId: number) {
    const usuario = usuarioLogado()
    const vinculo = usuario.vinculos.find((v) => v.loja.id === lojaId)
    if (!vinculo) throw erro(403, 'http_403', mensagemPadrao(403))
    return { usuario, papel: vinculo.papel }
  }

  const ofertaDe = (r: ReservaMock) => banco.ofertas.find((o) => o.id === r.ofertaId)!
  const lojaDaReserva = (r: ReservaMock) => ofertaDe(r).lojaId

  function ofertaDaLoja(lojaId: number, ofertaId: number): OfertaMock {
    const o = banco.ofertas.find((x) => x.id === ofertaId && x.lojaId === lojaId)
    if (!o) throw erro(404, 'nao_encontrada', 'Oferta não encontrada.')
    return o
  }

  const paraReservaLoja = (r: ReservaMock): ReservaLoja => ({
    id: r.id,
    codigo_final: r.codigo.slice(-3), // a loja nunca vê o código inteiro
    quantidade: r.quantidade,
    pedido: r.pedido,
    estado: r.estado,
    cliente: r.cliente,
    criada_em: isoBrasilia(r.criada_em),
    expira_em: isoBrasilia(r.expira_em),
    encerrada_em: r.encerrada_em ? isoBrasilia(r.encerrada_em) : null,
  })

  const paraOfertaLoja = (o: OfertaMock): OfertaLoja => ({
    id: o.id,
    produto: o.produto,
    fita: fitaDe(o.validade),
    validade: o.validade,
    preco: o.preco,
    preco_original: o.preco_original,
    desconto: o.desconto,
    janela_horas: o.janela_horas,
    inicio: isoBrasilia(o.inicio),
    fim: isoBrasilia(o.fim),
    estado: o.estado,
    estoque: { ...o.estoque },
  })

  /** Retirada é por LOJA + CÓDIGO: só acha reserva ativa desta loja. */
  const reservaAtivaPorCodigo = (lojaId: number, codigo: string) =>
    banco.reservas.find((r) => r.estado === 'reservada' && r.codigo === codigo && lojaDaReserva(r) === lojaId)

  const naoEncontrada = () => erro(404, 'nao_encontrada', 'Nenhuma reserva ativa com esse código nesta loja.')

  const operacao: ApiOperacao = {
    resumoDoDia: (lojaId) =>
      responder(() => {
        const { papel } = vinculoCom(lojaId)
        const momento = agora().getTime()
        const ativas = banco.reservas.filter((r) => r.estado === 'reservada' && lojaDaReserva(r) === lojaId)
        return {
          loja: lojaResumo(lojaId),
          papel,
          aguardando_retirada: ativas.length, // PEDIDO-API 2: conta RESERVAS (clientes), não unidades
          expiram_em_1h: ativas.filter((r) => r.expira_em.getTime() - momento <= 3600_000).length,
          ofertas_ativas: banco.ofertas.filter((o) => o.lojaId === lojaId && o.estado === 'ativa').length,
          avisos_para_conferir: 5, // valor fixo do protótipo até o mock do grupo D (F8)
        }
      }),

    listarOfertas: (lojaId, estado) =>
      responder(() => {
        vinculoCom(lojaId)
        return banco.ofertas
          .filter((o) => o.lojaId === lojaId && (!estado || o.estado === estado))
          .sort((a, b) => (estado === 'encerrada' ? b.fim.getTime() - a.fim.getTime() : a.fim.getTime() - b.fim.getTime()))
          .map(paraOfertaLoja)
      }),

    obterOferta: (lojaId, ofertaId) =>
      responder(() => {
        vinculoCom(lojaId)
        const o = ofertaDaLoja(lojaId, ofertaId)
        // Ativa: só as reservas aguardando. Encerrada: todas, com o estado final.
        const reservas = banco.reservas
          .filter((r) => r.ofertaId === o.id && (o.estado === 'encerrada' || r.estado === 'reservada'))
          .sort((a, b) => a.expira_em.getTime() - b.expira_em.getTime())
          .map(paraReservaLoja)
        return { ...paraOfertaLoja(o), reservas }
      }),

    ajustar: (lojaId, ofertaId, { quantidade, motivo }) =>
      responder(() => {
        vinculoCom(lojaId)
        const o = ofertaDaLoja(lojaId, ofertaId)
        if (!motivo?.trim()) throw erro(400, 'sem_motivo', 'Informe o motivo do ajuste.')
        if (o.estado !== 'ativa') throw erro(409, 'oferta_encerrada', 'Esta oferta já terminou.')
        if (!Number.isInteger(quantidade) || quantidade < 1) {
          throw erro(400, 'quantidade_invalida', 'Informe pelo menos 1 unidade.')
        }
        // Ajuste só reduz o LIVRE; unidade reservada está prometida a um cliente.
        const livre = o.estoque.livre
        if (quantidade > livre) {
          throw erro(409, 'acima_do_livre', `Só há ${livre} ${livre === 1 ? 'unidade livre' : 'unidades livres'} agora.`, { livre })
        }
        o.estoque.livre -= quantidade
        o.estoque.ajustado += quantidade
        return { estoque: { ...o.estoque } }
      }),

    previaRetirada: (lojaId, codigo) =>
      responder(() => {
        vinculoCom(lojaId)
        const r = reservaAtivaPorCodigo(lojaId, codigo)
        if (!r) throw naoEncontrada()
        const o = ofertaDe(r)
        return {
          reserva: paraReservaLoja(r),
          codigo: r.codigo,
          total: multiplicar(o.preco, r.quantidade),
          produto: o.produto.nome,
          fita: fitaDe(o.validade),
        }
      }),

    retirar: (lojaId, codigo) =>
      responder(() => {
        const { usuario } = vinculoCom(lojaId)
        const r = reservaAtivaPorCodigo(lojaId, codigo)
        if (!r) {
          // Venceu entre a busca (L13) e a confirmação: o mock considera "agora há pouco" = 30 min.
          const venceu = banco.reservas.some(
            (x) =>
              x.estado === 'expirada' &&
              x.codigo === codigo &&
              lojaDaReserva(x) === lojaId &&
              agora().getTime() - (x.encerrada_em?.getTime() ?? 0) < 30 * 60_000,
          )
          if (venceu) throw erro(409, 'venceu', 'O prazo desta reserva acabou. As unidades voltaram para a vitrine.')
          throw naoEncontrada()
        }
        const o = ofertaDe(r)
        r.estado = 'retirada'
        r.encerrada_em = agora()
        o.estoque.reservado -= r.quantidade
        o.estoque.retirado += r.quantidade
        return {
          reserva: paraReservaLoja(r),
          total: multiplicar(o.preco, r.quantidade),
          retirada_por: usuario.nome,
          oferta: { id: o.id, estoque: { ...o.estoque } },
        }
      }),
  }

  return {
    servidor,
    acesso,
    consumidor,
    operacao,
    lotes: pendente<ApiLotes>('lotes', 'F8'),
    configuracao: pendente<ApiConfiguracao>('configuracao', 'F8'),
    gestor: pendente<ApiGestor>('gestor', 'F7'),
    projecao: pendente<ApiProjecao>('projecao', 'F7'),

    reiniciar() {
      banco = criarSemente(agora())
      salvar(persistencia, banco)
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
