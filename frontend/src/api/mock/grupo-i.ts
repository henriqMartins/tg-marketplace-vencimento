/*
 * Grupo I no mock (parceria — A6, A7, P1–P3). Segue docs/parceria.md, seções 3 e 4.
 * A Receita (BrasilAPI) é fingida por uma tabela de CNPJs, um para cada resposta
 * que as telas precisam mostrar.
 */
import type { ApiParceria } from '../cliente'
import { ErroApi, mensagemPadrao } from '../erros'
import type { ConsultaCnpj, Convite, EstadoConvite, Interesse, InteresseEu, LojaPlataforma } from '../tipos'
import { cnpjValido, completarCnpj, soDigitos } from '../../util/cnpj'
import { mascararEmail } from '../../util/email'
import { isoBrasilia } from './datas'
import type { BancoMock, ConviteMock, InteresseMock, LojaMock, UsuarioMock } from './semente'

const VALIDADE_CONVITE_DIAS = 7
const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type Receita = Omit<ConsultaCnpj, 'cnpj'>

const RIO_PRETO = { municipio: 'SAO JOSE DO RIO PRETO', uf: 'SP' }

/**
 * Receita fingida. Os CNPJs têm dígitos verificadores certos; qualquer outro CNPJ válido
 * dá 404 cnpj_nao_encontrado, e o CNPJ_FORA_DO_AR simula a BrasilAPI fora do ar (503).
 */
export const CNPJ_ATIVA = completarCnpj('112223330001') // 11.222.333/0001-81 · minimercado
export const CNPJ_NAO_ALIMENTAR = completarCnpj('487310450001') // papelaria (só alerta)
export const CNPJ_INATIVA = completarCnpj('337001250001') // baixada (bloqueia)
export const CNPJ_FORA_DO_AR = completarCnpj('999990000001') // 503

const RECEITA: Record<string, Receita> = {
  [CNPJ_ATIVA]: {
    razao_social: 'MERCEARIA SAO JORGE LTDA',
    nome_fantasia: 'MERCEARIA SAO JORGE',
    situacao: 'ATIVA',
    ativa: true,
    cnae_principal: {
      codigo: '4712100',
      descricao: 'Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - minimercados, mercearias e armazéns',
    },
    alimentar: true,
    endereco: { logradouro: 'RUA BERNARDINO DE CAMPOS', numero: '1500', bairro: 'CENTRO', cep: '15015300', ...RIO_PRETO },
  },
  [CNPJ_NAO_ALIMENTAR]: {
    razao_social: 'PAPELARIA PONTO CERTO LTDA',
    nome_fantasia: 'PONTO CERTO',
    situacao: 'ATIVA',
    ativa: true,
    cnae_principal: { codigo: '4761003', descricao: 'Comércio varejista de artigos de papelaria' },
    alimentar: false,
    endereco: { logradouro: 'AVENIDA ALBERTO ANDALO', numero: '2200', bairro: 'CENTRO', cep: '15015000', ...RIO_PRETO },
  },
  [CNPJ_INATIVA]: {
    razao_social: 'ARMAZEM DOIS IRMAOS LTDA',
    nome_fantasia: 'ARMAZEM DOIS IRMAOS',
    situacao: 'BAIXADA',
    ativa: false,
    cnae_principal: { codigo: '4712100', descricao: 'Comércio varejista de mercadorias em geral - minimercados' },
    alimentar: true,
    endereco: { logradouro: 'RUA SILVA JARDIM', numero: '88', bairro: 'BOA VISTA', cep: '15025050', ...RIO_PRETO },
  },
}

export interface DependenciasParceria {
  banco: () => BancoMock
  agora: () => Date
  responder: <T>(executar: () => T) => Promise<T>
  erro: (status: number, codigo: string, frase: string, extra?: object) => ErroApi
  usuarioLogado: () => UsuarioMock
}

/** Código longo e aleatório (como secrets.token_urlsafe(16) no backend). */
function novoCodigoConvite(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const emAberto = (i: InteresseMock) => i.estado === 'novo' || i.estado === 'em_conversa'
const TELEFONE_MAXIMO = 20

export function criarApiParceria(d: DependenciasParceria): ApiParceria & {
  interesseDoEu: (usuarioId: number) => InteresseEu | null
} {
  const { erro, responder } = d
  const banco = () => d.banco()

  /** Rotas /api/plataforma/...: só a equipe. */
  function equipe(): UsuarioMock {
    const usuario = d.usuarioLogado()
    if (!usuario.plataforma) throw erro(403, 'http_403', mensagemPadrao(403))
    return usuario
  }

  /**
   * Campo de texto como no backend (servico.texto): sem espaços nas pontas; vazio ou longo → 400
   * com `campo` no corpo, para a tela saber qual campo marcar.
   */
  function campoTexto(valor: unknown, campo: string, rotulo: string, maximo: number, obrigatorio = true): string {
    const v = texto(valor)
    if (obrigatorio && !v) throw erro(400, 'campo_obrigatorio', `Informe ${rotulo}.`, { campo })
    if (v.length > maximo) {
      const inicio = rotulo.charAt(0).toUpperCase() + rotulo.slice(1)
      throw erro(400, 'campo_longo', `${inicio} pode ter até ${maximo} caracteres.`, { campo })
    }
    return v
  }

  /** Telefone guardado só com dígitos (a máscara é da tela). */
  function campoTelefone(valor: unknown): string {
    const numero = soDigitos(texto(valor))
    if (!numero) throw erro(400, 'campo_obrigatorio', 'Informe o telefone.', { campo: 'telefone' })
    if (numero.length > TELEFONE_MAXIMO) throw erro(400, 'campo_longo', 'Confira o telefone.', { campo: 'telefone' })
    return numero
  }

  const pessoa = (id: number) => banco().usuarios.find((u) => u.id === id)!

  const paraInteresse = (i: InteresseMock): Interesse => {
    const { nome, email } = pessoa(i.usuarioId)
    return {
      id: i.id,
      nome_mercado: i.nome_mercado,
      cidade: i.cidade,
      telefone: i.telefone,
      mensagem: i.mensagem,
      estado: i.estado,
      pessoa: { nome, email },
      motivo_descarte: i.motivo_descarte,
      loja_id: i.loja_id,
      criado_em: isoBrasilia(i.criado_em),
    }
  }

  /** Vencido = passou da data OU foi trocado por um novo (o link antigo deixa de valer). */
  function estadoConvite(c: ConviteMock): EstadoConvite {
    if (c.usado_em) return 'aceito'
    if (c.substituido || d.agora() >= c.expira_em) return 'vencido'
    return 'pendente'
  }

  const paraConvite = (c: ConviteMock): Convite => ({ codigo: c.codigo, email: c.email, expira_em: isoBrasilia(c.expira_em) })

  function responsavelDa(lojaId: number) {
    const u = banco().usuarios.find((x) => x.vinculos.some((v) => v.loja.id === lojaId && v.papel === 'responsavel'))
    return u ? { nome: u.nome, email: u.email } : null
  }

  function paraLojaPlataforma(l: LojaMock): LojaPlataforma {
    const ultimo = banco().convites.filter((c) => c.lojaId === l.id).at(-1)
    const estado = ultimo && estadoConvite(ultimo)
    return {
      id: l.id,
      nome: l.nome,
      cnpj: l.cnpj,
      cnpj_verificado: l.cnpj_verificado,
      endereco: l.endereco,
      telefone: l.telefone,
      criada_em: isoBrasilia(l.criada_em),
      responsavel: responsavelDa(l.id),
      convite:
        ultimo && estado
          ? {
              email: ultimo.email,
              expira_em: isoBrasilia(ultimo.expira_em),
              estado,
              // PEDIDO-API 6: o código do convite pendente, para copiar o link de novo.
              ...(estado === 'pendente' ? { codigo: ultimo.codigo } : {}),
            }
          : null,
    }
  }

  function gerarConvite(lojaId: number, email: string): ConviteMock {
    for (const c of banco().convites) {
      if (c.lojaId === lojaId && estadoConvite(c) === 'pendente') c.substituido = true
    }
    const criado_em = d.agora()
    const convite: ConviteMock = {
      codigo: novoCodigoConvite(),
      lojaId,
      email,
      criado_em,
      expira_em: new Date(criado_em.getTime() + VALIDADE_CONVITE_DIAS * 86_400_000),
      usado_em: null,
      substituido: false,
    }
    banco().convites.push(convite)
    return convite
  }

  /** Consulta à Receita fingida. undefined = não encontrado; lança 503 no CNPJ "fora do ar". */
  function consultarReceita(cnpj: string): ConsultaCnpj | undefined {
    if (cnpj === CNPJ_FORA_DO_AR) {
      throw erro(503, 'consulta_indisponivel', 'Não deu para consultar a Receita agora.')
    }
    const achado = RECEITA[cnpj]
    return achado && { cnpj, ...structuredClone(achado) }
  }

  /** Mesmo convite pelo código; 404 / 409 usado / 410 vencido (nesta ordem). */
  function conviteValido(codigo: string): ConviteMock {
    const c = banco().convites.find((x) => x.codigo === codigo)
    if (!c) throw erro(404, 'nao_encontrado', 'Convite não encontrado.')
    const estado = estadoConvite(c)
    if (estado === 'aceito') throw erro(409, 'convite_usado', 'Este convite já foi usado.')
    if (estado === 'vencido') throw erro(410, 'convite_vencido', 'Este convite venceu.')
    return c
  }

  return {
    // Contrato: só o pedido EM ABERTO (novo ou em_conversa); null se não houver.
    interesseDoEu(usuarioId) {
      const aberto = banco().interesses.find((i) => i.usuarioId === usuarioId && emAberto(i))
      return aberto ? { id: aberto.id, estado: aberto.estado, criado_em: isoBrasilia(aberto.criado_em) } : null
    },

    registrarInteresse: (entrada) =>
      responder(() => {
        const usuario = d.usuarioLogado()
        // Limites do contrato: nome e cidade 120, mensagem 1000, telefone até 20 dígitos.
        const campos = {
          nome_mercado: campoTexto(entrada.nome_mercado, 'nome_mercado', 'o nome do mercado', 120),
          cidade: campoTexto(entrada.cidade, 'cidade', 'a cidade', 120),
          telefone: campoTelefone(entrada.telefone),
          mensagem: campoTexto(entrada.mensagem, 'mensagem', 'a mensagem', 1000, false),
        }
        if (banco().interesses.some((i) => i.usuarioId === usuario.id && emAberto(i))) {
          throw erro(409, 'interesse_em_aberto', 'Você já tem um pedido de parceria em andamento.')
        }
        const novo: InteresseMock = {
          id: banco().proximoId++,
          usuarioId: usuario.id,
          ...campos,
          estado: 'novo',
          motivo_descarte: null,
          loja_id: null,
          criado_em: d.agora(),
        }
        banco().interesses.push(novo)
        return paraInteresse(novo)
      }),

    listarInteresses: (estado) =>
      responder(() => {
        equipe()
        if (estado && !['novo', 'em_conversa', 'virou_loja', 'descartado'].includes(estado)) {
          throw erro(400, 'estado_invalido', 'Estado inválido.')
        }
        return banco()
          .interesses.filter((i) => !estado || i.estado === estado)
          .sort((a, b) => b.criado_em.getTime() - a.criado_em.getTime())
          .map(paraInteresse)
      }),

    atualizarInteresse: (id, entrada) =>
      responder(() => {
        equipe()
        const i = banco().interesses.find((x) => x.id === id)
        if (!i) throw erro(404, 'nao_encontrado', 'Interesse não encontrado.')
        // Só novo → em_conversa e novo/em_conversa → descartado (contrato, ★ 17/11/2026).
        const permitida =
          (entrada.estado === 'em_conversa' && i.estado === 'novo') || (entrada.estado === 'descartado' && emAberto(i))
        if (!permitida) throw erro(400, 'estado_invalido', 'Não dá para mudar este pedido para esse estado.')
        if (entrada.estado === 'descartado') {
          i.motivo_descarte = campoTexto(entrada.motivo, 'motivo', 'o motivo', 255)
        }
        i.estado = entrada.estado
        return paraInteresse(i)
      }),

    consultarCnpj: (cnpjDigitado) =>
      responder(() => {
        equipe()
        const cnpj = soDigitos(cnpjDigitado)
        if (!cnpjValido(cnpj)) throw erro(400, 'cnpj_invalido', 'CNPJ inválido. Confira os números.')
        const consulta = consultarReceita(cnpj)
        if (!consulta) throw erro(404, 'cnpj_nao_encontrado', 'A Receita não encontrou este CNPJ.')
        return consulta
      }),

    cadastrarLoja: (entrada) =>
      responder(() => {
        equipe()
        const cnpj = soDigitos(texto(entrada.cnpj))
        if (!cnpjValido(cnpj)) throw erro(400, 'cnpj_invalido', 'CNPJ inválido. Confira os números.')
        // Mesma ordem do backend: campos → e-mail → interesse → CNPJ repetido → Receita.
        const nome = campoTexto(entrada.nome, 'nome', 'o nome da loja', 120)
        const endereco = campoTexto(entrada.endereco, 'endereco', 'o endereço', 255)
        const telefone = campoTelefone(entrada.telefone)
        const email = texto(entrada.email_responsavel).toLowerCase()
        if (!EMAIL_VALIDO.test(email)) throw erro(400, 'email_invalido', 'Confira o e-mail do responsável.')
        let interesse: InteresseMock | undefined
        if (entrada.interesse_id !== undefined && entrada.interesse_id !== null) {
          interesse = banco().interesses.find((i) => i.id === entrada.interesse_id)
          if (!interesse) throw erro(404, 'nao_encontrado', 'Pedido de parceria não encontrado.')
          if (!emAberto(interesse)) throw erro(400, 'estado_invalido', 'Esse pedido de parceria não está mais em aberto.')
        }
        if (banco().lojas.some((l) => l.cnpj === cnpj)) {
          throw erro(409, 'cnpj_ja_cadastrado', 'Já existe uma loja com este CNPJ.')
        }
        // Receita fora do ar: a criação segue, "não verificado". CNPJ que ela não conhece bloqueia (★).
        let consulta: ConsultaCnpj | undefined
        try {
          consulta = consultarReceita(cnpj)
        } catch (e) {
          if (!(e instanceof ErroApi && e.status === 503)) throw e
        }
        if (!consulta && cnpj !== CNPJ_FORA_DO_AR) {
          throw erro(400, 'cnpj_nao_encontrado', 'A Receita não encontrou este CNPJ.')
        }
        if (consulta && !consulta.ativa) {
          throw erro(400, 'cnpj_inativo', `A Receita mostra este CNPJ como ${consulta.situacao}.`)
        }

        // Tudo numa transação só (no mock: só grava depois de conferir).
        const loja: LojaMock = {
          id: banco().proximoId++,
          nome,
          endereco,
          distancia_km: 2.3, // fingida, como a das outras lojas
          latitude: entrada.latitude ?? null,
          longitude: entrada.longitude ?? null,
          janela_padrao_horas: 4,
          margem_fim_dias: 1,
          antecedencia_aviso_dias: 10,
          cnpj,
          cnpj_verificado: consulta !== undefined,
          telefone,
          criada_em: d.agora(),
        }
        banco().lojas.push(loja)
        const convite = gerarConvite(loja.id, email)
        if (interesse) {
          interesse.estado = 'virou_loja'
          interesse.loja_id = loja.id
        }
        return { loja: paraLojaPlataforma(loja), convite: paraConvite(convite) }
      }),

    listarLojas: () =>
      responder(() => {
        equipe()
        return [...banco().lojas].sort((a, b) => b.criada_em.getTime() - a.criada_em.getTime()).map(paraLojaPlataforma)
      }),

    novoConvite: (lojaId) =>
      responder(() => {
        equipe()
        const loja = banco().lojas.find((l) => l.id === lojaId)
        if (!loja) throw erro(404, 'nao_encontrado', 'Loja não encontrada.')
        if (responsavelDa(lojaId)) throw erro(409, 'loja_ja_ativa', 'Esta loja já tem responsável.')
        const anterior = banco().convites.filter((c) => c.lojaId === lojaId).at(-1)
        // Lojas antigas da demonstração (antes da parceria) nunca tiveram convite.
        if (!anterior) throw erro(409, 'sem_convite', 'Essa loja não foi cadastrada por convite.')
        return paraConvite(gerarConvite(lojaId, anterior.email))
      }),

    obterConvite: (codigo) =>
      responder(() => {
        d.usuarioLogado()
        const c = conviteValido(codigo)
        const { nome, endereco } = banco().lojas.find((l) => l.id === c.lojaId)!
        return { loja: { nome, endereco }, email: c.email, expira_em: isoBrasilia(c.expira_em) }
      }),

    aceitarConvite: (codigo) =>
      responder(() => {
        const usuario = d.usuarioLogado()
        const c = conviteValido(codigo)
        if (usuario.email.toLowerCase() !== c.email.toLowerCase()) {
          throw erro(403, 'email_diferente', 'Este convite é para outro e-mail.', { email_convite: mascararEmail(c.email) })
        }
        if (usuario.vinculos.some((v) => v.loja.id === c.lojaId)) {
          throw erro(409, 'ja_vinculado', 'Você já faz parte da equipe desta loja.')
        }
        const loja = banco().lojas.find((l) => l.id === c.lojaId)!
        // Vínculo e "usado" juntos (no backend, na mesma transação, com trava).
        usuario.vinculos.push({ id: banco().proximoId++, loja: { id: loja.id, nome: loja.nome }, papel: 'responsavel' })
        c.usado_em = d.agora()
        // PEDIDO-API 7: o vínculo no formato do Eu.
        return { vinculo: { loja: { id: loja.id, nome: loja.nome }, papel: 'responsavel' as const } }
      }),
  }
}
