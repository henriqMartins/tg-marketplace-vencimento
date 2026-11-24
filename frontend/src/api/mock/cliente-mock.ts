/*
 * Implementação MOCK do ClienteApi: estado em memória a partir da semente.
 * Segue o contrato (formatos, códigos de erro); as regras que só o backend tem
 * ficam fingidas em regras-fingidas.ts. Só src/api/index.ts importa este arquivo.
 *
 * Todos os grupos do contrato (A–G, I, J) estão no mock. Os grupos D (grupo-d.ts), E
 * (config-loja.ts), I (grupo-i.ts) e J (grupo-j.ts) ficam em arquivos próprios.
 */
import type {
  ApiAcesso,
  ApiConfiguracao,
  ApiConsumidor,
  ApiGestor,
  ApiOperacao,
  ApiProjecao,
  ApiServidor,
  ClienteApi,
} from '../cliente'
import { ErroApi, mensagemPadrao } from '../erros'
import { CATEGORIAS } from '../tipos'
import type {
  EntradaVinculo,
  Eu,
  Estoque,
  FaixaDesconto,
  ItemHistorico,
  LojaConfig,
  LojaResumo,
  OfertaLoja,
  OfertaVitrine,
  Reserva,
  ReservaLoja,
  Sessao,
  VinculoLoja,
} from '../tipos'
import { dataBrasilia, isoBrasilia, somarDias } from './datas'
import {
  calcularExpiraEm,
  calcularIndicadores,
  economia,
  fitaDe,
  multiplicar,
  novoCodigo,
  processarVencimentos,
  quantidadeReservada,
} from './regras-fingidas'
import { carregar, salvar, type Guarda } from './persistencia'
import { conferirParFinal, ErroDeCampo, mudancasDaLoja, paraLojaConfig } from './config-loja'
import { criarApiLotes } from './grupo-d'
import { criarApiParceria } from './grupo-i'
import { criarApiPedidos } from './grupo-j'
import { calcularProjecao } from './projecao'
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

  // Vínculo do contrato: sem o id interno e com o nome ATUAL da loja (o PATCH pode renomear).
  const paraEu = ({ id, nome, email, vinculos, plataforma }: UsuarioMock): Eu => ({
    id,
    nome,
    email,
    vinculos: vinculos.map((v) => ({ loja: { id: v.loja.id, nome: lojaPorId(v.loja.id).nome }, papel: v.papel })),
    plataforma: plataforma === true,
    interesse: parceria.interesseDoEu(id),
  })
  const lojaPorId = (lojaId: number) => banco.lojas.find((l) => l.id === lojaId)!

  function lojaResumo(lojaId: number): LojaResumo {
    const { id, nome, endereco } = banco.lojas.find((l) => l.id === lojaId)!
    return { id, nome, endereco }
  }

  /** Distância fingida da semente; null quando a loja apagou a coordenada (grupo E). */
  function distanciaDa(lojaId: number): number | null {
    const loja = banco.lojas.find((l) => l.id === lojaId)!
    return loja.latitude === null ? null : loja.distancia_km
  }

  function paraOfertaVitrine(o: OfertaMock, comDistancia: boolean): OfertaVitrine {
    return {
      id: o.id,
      produto: o.produto,
      loja: lojaResumo(o.lojaId),
      distancia_km: comDistancia ? distanciaDa(o.lojaId) : null,
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
      pedido_id: r.pedidoId,
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

  // ---------- I · Parceria (grupo-i.ts) ----------

  const { interesseDoEu, ...apiParceria } = criarApiParceria({
    banco: () => banco,
    agora,
    responder,
    erro,
    usuarioLogado,
  })
  const parceria = { interesseDoEu }

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
        // Mesma ordem e frases do backend (backend/contas/views.py).
        const emailLimpo = email.trim().toLowerCase()
        if (!nome.trim()) throw erro(400, 'sem_nome', 'Informe seu nome.')
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailLimpo)) throw erro(400, 'email_invalido', 'Confira o e-mail.')
        if (senha.length < 8) throw erro(400, 'senha_curta', 'A senha precisa ter pelo menos 8 caracteres.')
        if (aceite_termos !== true) throw erro(400, 'termos', 'Aceite os termos de uso para continuar.')
        if (banco.usuarios.some((u) => u.email === emailLimpo)) {
          throw erro(400, 'email_em_uso', 'Já existe uma conta com esse e-mail.')
        }
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
        // Filtro inválido → 400, como no backend (backend/ofertas/api_consumidor.py).
        if ([filtros.lat, filtros.lng].some((n) => n !== undefined && !Number.isFinite(n))) {
          throw erro(400, 'parametro_invalido', 'Localização inválida.')
        }
        if (filtros.categoria && !CATEGORIAS.some((c) => c.valor === filtros.categoria)) {
          throw erro(400, 'parametro_invalido', 'Categoria inválida.')
        }
        if (filtros.faixa_desconto && !['ate30', '30a50', '50mais'].includes(filtros.faixa_desconto)) {
          throw erro(400, 'parametro_invalido', 'Faixa de desconto inválida.')
        }
        const comDistancia = filtros.lat !== undefined && filtros.lng !== undefined
        const busca = filtros.q ? semAcento(filtros.q.trim()) : ''
        return banco.ofertas
          // A vitrine não mostra oferta encerrada nem esgotada (livre 0); o detalhe mostra as duas.
          .filter((o) => o.estado === 'ativa' && o.estoque.livre > 0)
          .filter((o) => !filtros.categoria || o.produto.categoria === filtros.categoria)
          .filter((o) => !filtros.faixa_desconto || naFaixa(o.desconto, filtros.faixa_desconto))
          .filter((o) => !busca || semAcento(o.produto.nome).includes(busca))
          .map((o) => ({ oferta: o, vitrine: paraOfertaVitrine(o, comDistancia) }))
          .sort((a, b) => {
            if (!comDistancia) return a.oferta.fim.getTime() - b.oferta.fim.getTime()
            // Loja sem coordenada vai para o fim da lista, com distancia_km null.
            const [da, db] = [a.vitrine.distancia_km ?? Infinity, b.vitrine.distancia_km ?? Infinity]
            return da - db
          })
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
          banco.recusas.push({ ofertaId, usuarioId: usuario.id, cliente: abreviar(usuario.nome), pedido, criada_em: momento })
          return { status: 'recusada' as const, pedido, erro: 'Esgotou agora há pouco', codigo: 'esgotada' as const }
        }

        const ativosDaLoja = new Set(
          banco.reservas
            .filter((r) => r.estado === 'reservada')
            .filter((r) => banco.ofertas.find((x) => x.id === r.ofertaId)?.lojaId === o.lojaId)
            .map((r) => r.codigo),
        )
        const pedidoId = banco.proximoId++ // grupo J: reservar 1 oferta = pedido de 1 item
        const reserva: ReservaMock = {
          id: banco.proximoId++,
          pedidoId,
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
        if (estado !== undefined && estado !== 'ativa' && estado !== 'encerrada') {
          throw erro(400, 'parametro_invalido', 'Use estado=ativa ou estado=encerrada.')
        }
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

  // D · Lote, fita e aviso (grupo-d.ts). Fica aqui porque o resumo do dia conta os avisos.
  const { avisosParaConferir, ...lotes } = criarApiLotes({
    banco: () => banco,
    agora,
    responder,
    erro,
    vinculoCom,
    lojaPorId,
    paraOfertaLoja,
  })

  /** Retirada é por LOJA + CÓDIGO: só acha reserva ativa desta loja. */
  const reservaAtivaPorCodigo = (lojaId: number, codigo: string) =>
    banco.reservas.find((r) => r.estado === 'reservada' && r.codigo === codigo && lojaDaReserva(r) === lojaId)

  const VENCIDA_RECENTE_MS = 24 * 3600_000

  /** "Não achei reserva ativa": venceu nas últimas 24 h (409) ou nunca existiu (404), como no backend. */
  function naoAchou(lojaId: number, codigo: string) {
    const venceu = banco.reservas.some(
      (x) =>
        x.estado === 'expirada' &&
        x.codigo === codigo &&
        lojaDaReserva(x) === lojaId &&
        x.expira_em.getTime() >= agora().getTime() - VENCIDA_RECENTE_MS,
    )
    if (venceu) return erro(409, 'venceu', 'Esta reserva venceu: o prazo de retirada acabou.')
    return erro(404, 'nao_encontrada', 'Nenhuma reserva ativa com esse código nesta loja.')
  }

  /** Só 6 dígitos em texto; outro formato nem é procurado (404). */
  const codigoValido = (codigo: unknown): codigo is string => typeof codigo === 'string' && /^\d{6}$/.test(codigo)

  // ---------- J · Pedido (grupo-j.ts) ----------

  const { retirarPedido, ...pedidos } = criarApiPedidos({
    banco: () => banco,
    agora,
    responder,
    erro,
    usuarioLogado,
    vinculoCom,
    lojaResumo,
    paraReservaLoja,
    naoAchou,
    abreviar,
  })

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
          avisos_para_conferir: avisosParaConferir(lojaId), // grupos em "conferir" (calculado)
        }
      }),

    listarOfertas: (lojaId, estado) =>
      responder(() => {
        vinculoCom(lojaId)
        const daLoja = banco.ofertas.filter((o) => o.lojaId === lojaId)
        // Ativas: a que acaba antes primeiro. Encerradas: a mais recente primeiro. Sem estado: as duas, nessa ordem.
        const ativas = daLoja.filter((o) => o.estado === 'ativa').sort((a, b) => a.fim.getTime() - b.fim.getTime())
        const encerradas = daLoja.filter((o) => o.estado === 'encerrada').sort((a, b) => b.fim.getTime() - a.fim.getTime())
        const lista = estado === 'ativa' ? ativas : estado === 'encerrada' ? encerradas : [...ativas, ...encerradas]
        return lista.map(paraOfertaLoja)
      }),

    obterOferta: (lojaId, ofertaId) =>
      responder(() => {
        vinculoCom(lojaId)
        const o = ofertaDaLoja(lojaId, ofertaId)
        // Ativa: só as reservas aguardando. Encerrada: todas, com o estado final.
        const reservas = banco.reservas
          .filter((r) => r.ofertaId === o.id && (o.estado === 'encerrada' || r.estado === 'reservada'))
          .sort((a, b) =>
            o.estado === 'ativa'
              ? a.expira_em.getTime() - b.expira_em.getTime()
              : a.criada_em.getTime() - b.criada_em.getTime(),
          )
          .map(paraReservaLoja)
        return { ...paraOfertaLoja(o), reservas }
      }),

    ajustar: (lojaId, ofertaId, { quantidade, motivo }) =>
      responder(() => {
        vinculoCom(lojaId)
        // Mesma ordem e frases do backend (backend/ofertas/api_loja.py).
        if (!Number.isInteger(quantidade) || quantidade < 1) {
          throw erro(400, 'quantidade_invalida', 'Informe pelo menos 1 unidade.')
        }
        const texto = typeof motivo === 'string' ? motivo.trim() : ''
        if (!texto) throw erro(400, 'sem_motivo', 'Informe o motivo do ajuste.')
        if (texto.length > 200) throw erro(400, 'motivo_longo', 'O motivo pode ter até 200 letras.')
        const o = ofertaDaLoja(lojaId, ofertaId)
        if (o.estado !== 'ativa') throw erro(409, 'oferta_encerrada', 'Esta oferta já terminou.')
        // Ajuste só reduz o LIVRE; unidade reservada está prometida a um cliente.
        const livre = o.estoque.livre
        if (quantidade > livre) {
          throw erro(409, 'acima_do_livre', 'Só dá para ajustar unidades livres; as reservadas não entram.', { livre })
        }
        o.estoque.livre -= quantidade
        o.estoque.ajustado += quantidade
        return { estoque: { ...o.estoque } }
      }),

    previaRetirada: (lojaId, codigo) =>
      responder(() => {
        vinculoCom(lojaId)
        const r = codigoValido(codigo) ? reservaAtivaPorCodigo(lojaId, codigo) : undefined
        if (!r) throw naoAchou(lojaId, codigo)
        const o = ofertaDe(r)
        return {
          reserva: paraReservaLoja(r),
          codigo: r.codigo,
          total: multiplicar(o.preco, r.quantidade),
          produto: o.produto.nome,
          fita: fitaDe(o.validade),
          validade: o.validade, // PEDIDO-API 3
        }
      }),

    // Grupo J: o código é do pedido; retira, tudo ou nada, os itens ativos dele.
    retirar: (lojaId, codigo) => responder(() => retirarPedido(lojaId, codigo)),
  }

  // ---------- F · Gestor ----------

  /** Só o responsável da loja; funcionário ou sem vínculo, 403. */
  function responsavelDe(lojaId: number) {
    const { papel } = vinculoCom(lojaId)
    if (papel !== 'responsavel') throw erro(403, 'http_403', mensagemPadrao(403))
  }

  /**
   * Período do gestor como no backend (api_gestor.py): dias de Brasília, os dois incluídos;
   * sem eles, os últimos 30 dias; de ≤ até e no máximo 1 ano, senão 400 periodo_invalido.
   */
  function periodo(de?: string, ate?: string) {
    const valida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d))
    const fim = ate ?? dataBrasilia(agora())
    const inicio = de ?? (valida(fim) ? somarDias(fim, -29) : fim)
    const dias = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000
    if (!valida(inicio) || !valida(fim) || inicio > fim || dias > 365) {
      throw erro(400, 'periodo_invalido', 'Período inválido: use datas AAAA-MM-DD, de ≤ até, no máximo 1 ano.')
    }
    return { de: inicio, ate: fim }
  }

  const gestor: ApiGestor = {
    indicadores: (lojaId, de, ate) =>
      responder(() => {
        responsavelDe(lojaId)
        const p = periodo(de, ate)
        return calcularIndicadores(banco, lojaId, p.de, p.ate)
      }),

    historico: (lojaId, filtros = {}) =>
      responder(() => {
        responsavelDe(lojaId)
        if (filtros.estado && !['reservada', 'retirada', 'expirada', 'cancelada', 'recusa'].includes(filtros.estado)) {
          throw erro(400, 'estado_invalido', 'Estado: reservada, retirada, expirada, cancelada ou recusa.')
        }
        const { de, ate } = periodo(filtros.de, filtros.ate)
        const noPeriodo = (d: Date) => {
          const dia = dataBrasilia(d)
          return dia >= de && dia <= ate
        }
        const daLoja = (ofertaId: number) => banco.ofertas.find((o) => o.id === ofertaId)?.lojaId === lojaId
        const produtoDe = (ofertaId: number) => banco.ofertas.find((o) => o.id === ofertaId)!.produto.nome

        const reservas: ItemHistorico[] = banco.reservas
          .filter((r) => daLoja(r.ofertaId) && noPeriodo(r.criada_em))
          .map((r) => ({
            tipo: 'reserva',
            criada_em: isoBrasilia(r.criada_em),
            codigo_final: r.codigo.slice(-3),
            produto: produtoDe(r.ofertaId),
            quantidade: r.quantidade,
            pedido: r.pedido,
            cliente: r.cliente,
            estado: r.estado,
            encerrada_em: r.encerrada_em ? isoBrasilia(r.encerrada_em) : null,
          }))
        const recusas: ItemHistorico[] = banco.recusas
          .filter((x) => daLoja(x.ofertaId) && noPeriodo(x.criada_em))
          .map((x) => ({
            tipo: 'recusa',
            criada_em: isoBrasilia(x.criada_em),
            codigo_final: null,
            produto: produtoDe(x.ofertaId),
            quantidade: 0,
            pedido: x.pedido,
            cliente: x.cliente,
            estado: 'recusa',
            encerrada_em: null,
          }))

        // q: produto (sem acento) ou final do código.
        const busca = filtros.q ? semAcento(filtros.q.trim()) : ''
        const casaBusca = (i: ItemHistorico) =>
          !busca || semAcento(i.produto).includes(busca) || (i.codigo_final?.endsWith(busca) ?? false)

        return {
          // Os totais são do período (o cabeçalho da G3); estado e busca só filtram a lista.
          total_reservas: reservas.length,
          total_recusas: recusas.length,
          itens: [...reservas, ...recusas]
            .filter((i) => !filtros.estado || i.estado === filtros.estado)
            .filter(casaBusca)
            .sort((a, b) => b.criada_em.localeCompare(a.criada_em)),
        }
      }),
  }

  // ---------- E · Configuração da loja ----------

  const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

  /** Vínculos da loja como o contrato mostra: responsáveis primeiro. */
  function vinculosDa(lojaId: number, eu: UsuarioMock): VinculoLoja[] {
    return banco.usuarios
      .flatMap((u) =>
        u.vinculos
          .filter((v) => v.loja.id === lojaId)
          .map((v) => ({ id: v.id, usuario: { nome: u.nome, email: u.email }, papel: v.papel, eu: u.id === eu.id })),
      )
      .sort((a, b) => Number(b.papel === 'responsavel') - Number(a.papel === 'responsavel') || a.id - b.id)
  }

  const configuracao: ApiConfiguracao = {
    obterLoja: (lojaId) =>
      responder(() => {
        vinculoCom(lojaId) // leitura: qualquer vínculo
        return paraLojaConfig(lojaPorId(lojaId))
      }),

    atualizarLoja: (lojaId, campos) =>
      responder((): LojaConfig => {
        responsavelDe(lojaId)
        const loja = lojaPorId(lojaId)
        try {
          const mudancas = mudancasDaLoja(campos)
          conferirParFinal({ ...loja, ...mudancas })
          Object.assign(loja, mudancas) // só grava depois de tudo conferido
        } catch (e) {
          if (e instanceof ErroDeCampo) throw erro(400, e.codigo, e.message)
          throw e
        }
        return paraLojaConfig(loja)
      }),

    listarVinculos: (lojaId) =>
      responder(() => {
        const { usuario } = vinculoCom(lojaId)
        return vinculosDa(lojaId, usuario)
      }),

    criarVinculo: (lojaId, entrada: EntradaVinculo) =>
      responder(() => {
        responsavelDe(lojaId)
        const eu = usuarioLogado()
        const email = typeof entrada.email === 'string' ? entrada.email.trim() : ''
        if (!EMAIL_VALIDO.test(email)) throw erro(400, 'email_invalido', 'Informe um e-mail válido.')
        if (entrada.papel !== 'responsavel' && entrada.papel !== 'funcionario') {
          throw erro(400, 'papel_invalido', 'Papel: responsavel ou funcionario.')
        }
        const pessoa = banco.usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase())
        if (!pessoa) {
          throw erro(404, 'conta_nao_existe', 'Não existe conta com esse e-mail. Peça para a pessoa se cadastrar.')
        }
        if (pessoa.vinculos.some((v) => v.loja.id === lojaId)) {
          throw erro(409, 'ja_vinculado', 'Essa pessoa já faz parte da equipe.')
        }
        const novo = { id: banco.proximoId++, loja: { id: lojaId, nome: lojaPorId(lojaId).nome }, papel: entrada.papel }
        pessoa.vinculos.push(novo)
        return vinculosDa(lojaId, eu).find((v) => v.id === novo.id)!
      }),

    // PEDIDO-API 4 (aceito): promove ou rebaixa. Mesma ordem e frases do backend (servico_equipe.py).
    alterarPapel: (lojaId, vinculoId, papel) =>
      responder(() => {
        responsavelDe(lojaId)
        const eu = usuarioLogado()
        if (papel !== 'responsavel' && papel !== 'funcionario') {
          throw erro(400, 'papel_invalido', 'Papel: responsavel ou funcionario.')
        }
        const dono = banco.usuarios.find((u) => u.vinculos.some((v) => v.id === vinculoId && v.loja.id === lojaId))
        if (!dono) throw erro(404, 'nao_encontrado', 'Essa pessoa não faz parte da equipe desta loja.')
        if (dono.id === eu.id) {
          throw erro(409, 'proprio_vinculo', 'Você não pode mudar o próprio acesso; peça a outro responsável.')
        }
        const vinculo = dono.vinculos.find((v) => v.id === vinculoId)!
        if (papel !== vinculo.papel) {
          // Rebaixar um responsável só se sobrar outro (reforço: nunca zerar).
          const responsaveis = vinculosDa(lojaId, eu).filter((v) => v.papel === 'responsavel').length
          if (vinculo.papel === 'responsavel' && responsaveis <= 1) {
            throw erro(409, 'ultimo_responsavel', 'A loja precisa de pelo menos um responsável.')
          }
          vinculo.papel = papel
        }
        return vinculosDa(lojaId, eu).find((v) => v.id === vinculoId)!
      }),

    removerVinculo: (lojaId, vinculoId) =>
      responder(() => {
        responsavelDe(lojaId)
        const eu = usuarioLogado()
        const dono = banco.usuarios.find((u) => u.vinculos.some((v) => v.id === vinculoId && v.loja.id === lojaId))
        if (!dono) throw erro(404, 'nao_encontrado', 'Essa pessoa não faz parte da equipe desta loja.')
        if (dono.id === eu.id) {
          throw erro(409, 'proprio_vinculo', 'Você não pode remover o próprio acesso; peça a outro responsável.')
        }
        const vinculo = dono.vinculos.find((v) => v.id === vinculoId)!
        const responsaveis = vinculosDa(lojaId, eu).filter((v) => v.papel === 'responsavel').length
        if (vinculo.papel === 'responsavel' && responsaveis <= 1) {
          throw erro(409, 'ultimo_responsavel', 'A loja precisa de pelo menos um responsável.') // reforço: nunca zerar
        }
        // Remover tira o vínculo, não a conta: a pessoa volta a ser só consumidora.
        dono.vinculos = dono.vinculos.filter((v) => v.id !== vinculoId)
      }),
  }

  // ---------- G · Projeção ----------

  const projecao: ApiProjecao = {
    projecao: (lojaId, filtros = {}) =>
      responder(() => {
        responsavelDe(lojaId)
        const chegada = filtros.chegada ?? 2
        // O resumo do mock vem do rodadas.csv, que só tem a chegada de 2 h (decisão 4a).
        if (chegada !== 2) {
          throw erro(501, 'chegada_so_na_api', `Projeção com chegada de ${chegada} h disponível só com a API real.`)
        }
        return calcularProjecao(filtros.lote ?? null, filtros.procura ?? null)
      }),
  }

  return {
    servidor,
    acesso,
    consumidor,
    operacao,
    lotes,
    configuracao,
    gestor,
    projecao,
    parceria: apiParceria,
    pedidos,

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
