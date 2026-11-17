/*
 * Função da Vercel (Node), chamada 1×/dia pelo agendamento do vercel.json.
 * Roda no SERVIDOR da Vercel, não no navegador: só process.env (nada de import.meta.env
 * nem VITE_*) e nada de src/ — o bundle do app nunca inclui este arquivo.
 *
 * Repassa para o backend: POST {BACKEND_URL}/tarefas/varrer com "Bearer {CRON_TOKEN}".
 * O Render dorme depois de ~15 min e leva ~1 min para acordar: espera até 90 s e, se a
 * primeira chamada voltar 502/503/504 ou cair a conexão, tenta mais uma vez no mesmo prazo.
 */

export interface Ambiente {
  BACKEND_URL?: string
  CRON_TOKEN?: string
  CRON_SECRET?: string
}

export interface OpcoesVarrer {
  fetch?: typeof fetch
  /** Prazo total, em ms (padrão 90 s). */
  prazoMs?: number
  /** Pausa antes da segunda tentativa, em ms (padrão 5 s). */
  pausaMs?: number
}

const ACORDANDO = new Set([502, 503, 504])

const json = (corpo: unknown, status: number) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

export async function varrer(pedido: Request, ambiente: Ambiente, opcoes: OpcoesVarrer = {}): Promise<Response> {
  const { fetch: fetchFn = fetch, prazoMs = 90_000, pausaMs = 5_000 } = opcoes
  const { BACKEND_URL, CRON_TOKEN, CRON_SECRET } = ambiente

  // Só o agendamento da Vercel (que manda o CRON_SECRET) pode disparar a varredura.
  if (!CRON_SECRET || pedido.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return json({ erro: 'Não autorizado.' }, 401)
  }
  if (!BACKEND_URL || !CRON_TOKEN) {
    return json({ erro: 'Faltam BACKEND_URL ou CRON_TOKEN nas variáveis da Vercel.' }, 500)
  }

  const url = `${BACKEND_URL.replace(/\/+$/, '')}/tarefas/varrer`
  const limite = Date.now() + prazoMs
  let ultimaFalha = ''

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const restante = limite - Date.now()
    if (restante <= 0) break
    try {
      const resposta = await fetchFn(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CRON_TOKEN}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(restante),
      })
      const texto = await resposta.text()
      const resumo = lerJson(texto)
      if (ACORDANDO.has(resposta.status) && tentativa === 1) {
        ultimaFalha = `backend respondeu ${resposta.status} (acordando?)`
        await esperar(Math.min(pausaMs, Math.max(0, limite - Date.now())))
        continue
      }
      // Devolve o status do backend e o resumo da varredura como vieram.
      return json({ status: resposta.status, tentativas: tentativa, resumo }, resposta.ok ? 200 : 502)
    } catch (erro) {
      const estourou = erro instanceof Error && (erro.name === 'TimeoutError' || erro.name === 'AbortError')
      if (estourou) return json({ erro: `O backend não respondeu em ${Math.round(prazoMs / 1000)} s.`, tentativas: tentativa }, 504)
      ultimaFalha = 'sem conexão com o backend'
      if (tentativa === 1) await esperar(Math.min(pausaMs, Math.max(0, limite - Date.now())))
    }
  }
  return json({ erro: `Varredura não concluída: ${ultimaFalha || 'prazo esgotado'}.` }, 504)
}

/** O que a Vercel chama (o agendamento faz GET). */
export function GET(pedido: Request): Promise<Response> {
  return varrer(pedido, {
    BACKEND_URL: process.env.BACKEND_URL,
    CRON_TOKEN: process.env.CRON_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET,
  })
}

function lerJson(texto: string): unknown {
  try {
    return texto ? JSON.parse(texto) : null
  } catch {
    return texto.slice(0, 500)
  }
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))
