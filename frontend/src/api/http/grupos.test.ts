import { afterEach, describe, expect, it, vi } from 'vitest'
import { criarCliente } from '..'
import { lerConfigApi } from '../config'
import { ErroApi } from '../erros'

/** fetch falso que grava cada chamada e responde o que o teste mandar. */
function servidorFalso(resposta: (url: string, init: RequestInit) => { status: number; corpo?: unknown } = () => ({ status: 200, corpo: {} })) {
  const chamadas: { metodo: string; url: string; corpo: unknown }[] = []
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    chamadas.push({ metodo: init.method ?? 'GET', url: url.replace('http://api.teste', ''), corpo: init.body ? JSON.parse(String(init.body)) : undefined })
    const { status, corpo } = resposta(url, init)
    return new Response(status === 204 ? null : JSON.stringify(corpo ?? {}), { status })
  }) as unknown as typeof globalThis.fetch
  const api = criarCliente({ config: lerConfigApi('http'), obterToken: () => 'tk', baseUrl: 'http://api.teste' })
  // criarCliente usa o fetch global: troca só durante o teste.
  vi.stubGlobal('fetch', fetch)
  return { api, chamadas }
}

afterEach(() => vi.unstubAllGlobals())

describe('clientes http (A–G, I e J): rotas, métodos e corpos do contrato', () => {
  it('A · acesso', async () => {
    const { api, chamadas } = servidorFalso()
    await api.acesso.entrar({ email: 'a@b.c', senha: '12345678' })
    await api.acesso.eu()
    expect(chamadas).toEqual([
      { metodo: 'POST', url: '/api/auth/login', corpo: { email: 'a@b.c', senha: '12345678' } },
      { metodo: 'GET', url: '/api/eu', corpo: undefined },
    ])
  })

  it('B · vitrine com filtros e a recusa (409) devolvida como resultado, não como erro', async () => {
    const { api, chamadas } = servidorFalso((url) =>
      url.endsWith('/reservas')
        ? { status: 409, corpo: { status: 'recusada', pedido: 3, erro: 'Esgotou agora há pouco', codigo: 'esgotada' } }
        : { status: 200, corpo: [] },
    )
    await api.consumidor.listarOfertas({ lat: -20.8, lng: -49.3, categoria: 'leite' })
    expect(chamadas[0].url).toBe('/api/ofertas?lat=-20.8&lng=-49.3&categoria=leite')
    expect(await api.consumidor.reservar(7, 3)).toEqual({ status: 'recusada', pedido: 3, erro: 'Esgotou agora há pouco', codigo: 'esgotada' })
    expect(chamadas[1]).toEqual({ metodo: 'POST', url: '/api/ofertas/7/reservas', corpo: { pedido: 3 } })
  })

  it('B · outro 409 (oferta encerrada) continua sendo erro', async () => {
    const { api } = servidorFalso(() => ({ status: 409, corpo: { erro: 'Esta oferta já terminou.', codigo: 'oferta_encerrada' } }))
    await expect(api.consumidor.reservar(7, 1)).rejects.toBeInstanceOf(ErroApi)
  })

  it('C · operação da loja', async () => {
    const { api, chamadas } = servidorFalso()
    await api.operacao.listarOfertas(1, 'ativa')
    await api.operacao.ajustar(1, 5, { quantidade: 2, motivo: 'Danificada' })
    await api.operacao.previaRetirada(1, '482917')
    await api.operacao.retirar(1, '482917')
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([
      'GET /api/lojas/1/ofertas?estado=ativa',
      'POST /api/lojas/1/ofertas/5/ajustes',
      'GET /api/lojas/1/reservas/ativa?codigo=482917',
      'POST /api/lojas/1/retiradas',
    ])
    expect(chamadas[3].corpo).toEqual({ codigo: '482917' })
  })

  it('D · lotes e avisos (com_lotes vira "1")', async () => {
    const { api, chamadas } = servidorFalso()
    await api.lotes.listarGrupos(1, { cor: 'preto', com_lotes: true })
    await api.lotes.listarGrupos(1)
    await api.lotes.adiarAviso(1, 301, '2026-10-25')
    await api.lotes.publicarAviso(1, 301, { separado: 12, preco_original: '4.49', desconto: 30, janela_horas: 4, confirmou_separacao: true })
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([
      'GET /api/lojas/1/grupos?cor=preto&com_lotes=1',
      'GET /api/lojas/1/grupos',
      'POST /api/lojas/1/avisos/301/adiar',
      'POST /api/lojas/1/avisos/301/publicar',
    ])
    expect(chamadas[2].corpo).toEqual({ ate: '2026-10-25' })
  })

  it('E · configuração e equipe (PATCH de papel; DELETE 204 sem corpo)', async () => {
    const { api, chamadas } = servidorFalso((_url, init) => (init.method === 'DELETE' ? { status: 204 } : { status: 200, corpo: {} }))
    await api.configuracao.atualizarLoja(1, { janela_padrao_horas: 8 })
    await api.configuracao.alterarPapel(1, 102, 'responsavel')
    expect(await api.configuracao.removerVinculo(1, 102)).toBeUndefined()
    expect(chamadas).toEqual([
      { metodo: 'PATCH', url: '/api/lojas/1', corpo: { janela_padrao_horas: 8 } },
      { metodo: 'PATCH', url: '/api/lojas/1/vinculos/102', corpo: { papel: 'responsavel' } },
      { metodo: 'DELETE', url: '/api/lojas/1/vinculos/102', corpo: undefined },
    ])
  })

  it('F · gestor com período e filtros', async () => {
    const { api, chamadas } = servidorFalso()
    await api.gestor.indicadores(1, '2026-10-01', '2026-10-31')
    await api.gestor.historico(1, { de: '2026-10-01', ate: '2026-10-31', estado: 'recusa', q: 'leite' })
    expect(chamadas.map((c) => c.url)).toEqual([
      '/api/lojas/1/indicadores?de=2026-10-01&ate=2026-10-31',
      '/api/lojas/1/historico?de=2026-10-01&ate=2026-10-31&estado=recusa&q=leite',
    ])
  })

  it('I · parceria: dono (interesse, convite) e equipe (/api/plataforma/...)', async () => {
    const { api, chamadas } = servidorFalso()
    await api.parceria.registrarInteresse({ nome_mercado: 'Mercearia São Jorge', cidade: 'Rio Preto', telefone: '17999990000' })
    await api.parceria.listarInteresses('novo')
    await api.parceria.listarInteresses()
    await api.parceria.atualizarInteresse(9, { estado: 'descartado', motivo: 'Fora da região' })
    await api.parceria.consultarCnpj('11222333000181')
    await api.parceria.listarLojas()
    await api.parceria.novoConvite(4)
    await api.parceria.obterConvite('ab-C_9')
    await api.parceria.aceitarConvite('ab-C_9')
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([
      'POST /api/interesses',
      'GET /api/plataforma/interesses?estado=novo',
      'GET /api/plataforma/interesses',
      'PATCH /api/plataforma/interesses/9',
      'GET /api/plataforma/cnpj/11222333000181',
      'GET /api/plataforma/lojas',
      'POST /api/plataforma/lojas/4/convite',
      'GET /api/convites/ab-C_9',
      'POST /api/convites/ab-C_9/aceitar',
    ])
    expect(chamadas[0].corpo).toEqual({ nome_mercado: 'Mercearia São Jorge', cidade: 'Rio Preto', telefone: '17999990000' })
    expect(chamadas[3].corpo).toEqual({ estado: 'descartado', motivo: 'Fora da região' })
  })

  it('I · cadastro da loja manda o corpo inteiro; o erro de campo chega com `campo` no corpo', async () => {
    const recusa = { erro: 'Informe a cidade.', codigo: 'campo_obrigatorio', campo: 'cidade' }
    const { api, chamadas } = servidorFalso((url) =>
      url.endsWith('/interesses') ? { status: 400, corpo: recusa } : { status: 201, corpo: { loja: {}, convite: {} } },
    )
    const entrada = {
      cnpj: '11222333000181', nome: 'Mercearia São Jorge', endereco: 'Rua Bernardino de Campos, 1500',
      latitude: null, longitude: null, telefone: '1732220000', email_responsavel: 'marcos@example.com', interesse_id: 9,
    }
    await api.parceria.cadastrarLoja(entrada)
    expect(chamadas[0]).toEqual({ metodo: 'POST', url: '/api/plataforma/lojas', corpo: entrada })

    const erro = await api.parceria.registrarInteresse({ nome_mercado: 'X', cidade: '', telefone: '1' }).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(ErroApi)
    expect(erro).toMatchObject({ status: 400, codigo: 'campo_obrigatorio', message: 'Informe a cidade.', corpo: recusa })
  })

  it('J · pedidos: rotas do consumidor e a prévia do balcão', async () => {
    const { api, chamadas } = servidorFalso(() => ({ status: 201, corpo: { id: 12, itens: [] } }))
    const entrada = { loja_id: 1, itens: [{ oferta_id: 3, pedido: 2 }, { oferta_id: 9, pedido: 1 }] }
    expect(await api.pedidos.confirmar(entrada)).toEqual({ status: 'criado', pedido: { id: 12, itens: [] } })
    await api.pedidos.listar('ativo')
    await api.pedidos.listar()
    await api.pedidos.obter(12)
    await api.pedidos.cancelar(12)
    await api.pedidos.cancelarItem(12, 40)
    await api.pedidos.previaNoBalcao(1, '482917')
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([
      'POST /api/pedidos',
      'GET /api/pedidos?estado=ativo',
      'GET /api/pedidos',
      'GET /api/pedidos/12',
      'POST /api/pedidos/12/cancelar',
      'POST /api/pedidos/12/itens/40/cancelar',
      'GET /api/lojas/1/pedidos/ativo?codigo=482917',
    ])
    expect(chamadas[0].corpo).toEqual(entrada)
  })

  it('J · 409 tudo_esgotado vira resultado (com os itens); outro 409 continua erro', async () => {
    const recusado = { reserva_id: null, oferta_id: 3, status: 'recusada', motivo: 'esgotada' }
    const { api } = servidorFalso((url) =>
      url.endsWith('/api/pedidos')
        ? { status: 409, corpo: { erro: 'Esgotou tudo agora há pouco.', codigo: 'tudo_esgotado', itens: [recusado] } }
        : { status: 409, corpo: { erro: 'Este pedido não tem itens ativos.', codigo: 'nada_ativo' } },
    )
    expect(await api.pedidos.confirmar({ loja_id: 1, itens: [{ oferta_id: 3, pedido: 1 }] })).toEqual({
      status: 'tudo_esgotado',
      erro: 'Esgotou tudo agora há pouco.',
      itens: [recusado],
    })
    await expect(api.pedidos.cancelar(12)).rejects.toMatchObject({ status: 409, codigo: 'nada_ativo' })
  })

  it('/health também vai à API real', async () => {
    const { api, chamadas } = servidorFalso(() => ({ status: 200, corpo: { status: 'ok' } }))
    await api.servidor.saude()
    expect(chamadas[0].url).toBe('/health')
  })
})
