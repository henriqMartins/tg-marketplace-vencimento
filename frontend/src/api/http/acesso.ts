/* Grupo A na API real (backend/contas/urls.py). */
import type { ApiAcesso } from '../cliente'
import type { Eu, Sessao } from '../tipos'
import type { Requisitar } from './requisitar'

export function criarAcessoHttp(requisitar: Requisitar): ApiAcesso {
  return {
    entrar: (entrada) => requisitar<Sessao>('POST', '/api/auth/login', { corpo: entrada }),
    criarConta: (entrada) => requisitar<Sessao>('POST', '/api/auth/conta', { corpo: entrada }),
    sair: () => requisitar<void>('POST', '/api/auth/sair'),
    eu: () => requisitar<Eu>('GET', '/api/eu'),
  }
}
