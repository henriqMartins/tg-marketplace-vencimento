import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { CATEGORIAS, type Categoria, type FaixaDesconto, type FiltrosVitrine } from '../../api'
import { RECARGA_30S } from '../../app/consultas'
import { useApi } from '../../app/contextos'
import { Botao } from '../../componentes/Botao'
import { CartaoOferta } from '../../componentes/CartaoOferta'
import { Chip } from '../../componentes/Chip'
import { EsqueletoLista } from '../../componentes/Esqueleto'
import { EstadoVazio } from '../../componentes/EstadoVazio'
import { IconeBusca, IconePino, IconeSacola } from '../../componentes/icones'
import { MensagemErro } from '../../componentes/Mensagem'
import { useLocal } from '../../localizacao/contexto'
import { FolhaAvisos } from './FolhaAvisos'
import styles from './Consumidor.module.css'

const FAIXAS: { valor: FaixaDesconto; rotulo: string }[] = [
  { valor: 'ate30', rotulo: 'Até 30%' },
  { valor: '30a50', rotulo: '30–50%' },
  { valor: '50mais', rotulo: '50%+' },
]

const ehCategoria = (v: string | null): v is Categoria => CATEGORIAS.some((c) => c.valor === v)
const ehFaixa = (v: string | null): v is FaixaDesconto => FAIXAS.some((f) => f.valor === v)

/** C2 · Vitrine com filtros (e os estados da C3). Filtros ficam no endereço (?categoria=&desconto=&q=). */
export function C2Vitrine() {
  const api = useApi()
  const { local } = useLocal()
  const rota = useLocation()
  const [parametros, setParametros] = useSearchParams()
  const [avisosAberta, setAvisosAberta] = useState(() => Boolean((rota.state as { oferecerAvisos?: boolean } | null)?.oferecerAvisos))

  const categoria = ehCategoria(parametros.get('categoria')) ? (parametros.get('categoria') as Categoria) : undefined
  const desconto = ehFaixa(parametros.get('desconto')) ? (parametros.get('desconto') as FaixaDesconto) : undefined
  const q = parametros.get('q') ?? ''
  const [busca, setBusca] = useState(q)

  const mudar = useCallback(
    (chave: string, valor: string | undefined) =>
      setParametros(
        (atual) => {
          const novo = new URLSearchParams(atual)
          if (valor) novo.set(chave, valor)
          else novo.delete(chave)
          return novo
        },
        { replace: true },
      ),
    [setParametros],
  )

  // Busca enquanto digita, com pausa de 300 ms (não chama a API a cada letra).
  useEffect(() => {
    const termo = busca.trim()
    if (termo === q) return
    const timer = window.setTimeout(() => mudar('q', termo || undefined), 300)
    return () => window.clearTimeout(timer)
  }, [busca, q, mudar])

  const filtros: FiltrosVitrine = {
    categoria,
    faixa_desconto: desconto,
    q: q || undefined,
    lat: local?.lat,
    lng: local?.lng,
  }
  const ofertas = useQuery({
    queryKey: ['vitrine', filtros],
    queryFn: () => api.consumidor.listarOfertas(filtros),
    placeholderData: keepPreviousData, // ao trocar de filtro, a lista antiga fica até a nova chegar
    ...RECARGA_30S,
  })

  const temFiltro = Boolean(categoria || desconto || q)
  function limparFiltros() {
    setBusca('')
    setParametros({}, { replace: true })
  }

  const voltarParaCa = encodeURIComponent(rota.pathname + rota.search)

  return (
    <div className={styles.vitrine}>
      <header className={styles.cabecalhoVitrine}>
        <h1 className={styles.tituloTela}>Ofertas perto de você</h1>
        <Link to={`/boas-vindas?voltar=${voltarParaCa}`} className={styles.botaoLocal}>
          <IconePino tamanho={18} />
          <span>{local?.rotulo ?? 'Escolher local'}</span>
          <span aria-hidden="true">▾</span>
        </Link>

        <label className={styles.busca}>
          <IconeBusca tamanho={20} />
          <span className="so-leitor">Buscar ofertas</span>
          <input type="search" placeholder="Buscar produto" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>

        <div className={styles.chips} role="group" aria-label="Categoria">
          <Chip ativo={!categoria} onClick={() => mudar('categoria', undefined)}>
            Todos
          </Chip>
          {CATEGORIAS.map((c) => (
            <Chip key={c.valor} ativo={categoria === c.valor} onClick={() => mudar('categoria', c.valor)}>
              {c.rotulo}
            </Chip>
          ))}
        </div>
        <div className={styles.chips} role="group" aria-label="Desconto">
          <Chip ativo={!desconto} onClick={() => mudar('desconto', undefined)}>
            Todas
          </Chip>
          {FAIXAS.map((f) => (
            <Chip key={f.valor} ativo={desconto === f.valor} onClick={() => mudar('desconto', f.valor)}>
              {f.rotulo}
            </Chip>
          ))}
        </div>
      </header>

      {ofertas.isPending ? (
        <EsqueletoLista quantidade={4} rotulo="Carregando ofertas…" />
      ) : ofertas.isError ? (
        <div className={styles.pilha}>
          <MensagemErro erro={ofertas.error} />
          <Botao variante="secundario" onClick={() => void ofertas.refetch()}>
            Tentar de novo
          </Botao>
        </div>
      ) : ofertas.data.length === 0 ? (
        <div className={styles.pilha}>
          <EstadoVazio
            icone={<IconeSacola />}
            frase={temFiltro ? 'Nenhuma oferta com esses filtros' : 'Nenhuma oferta por aqui agora'}
            detalhe="As lojas publicam ofertas ao longo do dia. Ative os avisos para saber quando sair uma nova."
            acao={
              temFiltro
                ? { rotulo: 'Limpar filtros', aoClicar: limparFiltros }
                : { rotulo: 'Atualizar', aoClicar: () => void ofertas.refetch() }
            }
          />
          <button type="button" className={styles.linkBotao} onClick={() => setAvisosAberta(true)}>
            Ativar avisos de oferta
          </button>
        </div>
      ) : (
        <>
          <p className={styles.contagem} aria-live="polite">
            {ofertas.data.length} {ofertas.data.length === 1 ? 'oferta' : 'ofertas'} ·{' '}
            {local ? 'ordenadas por distância' : 'ordenadas pelo fim mais próximo'}
          </p>
          <ul className={styles.lista}>
            {ofertas.data.map((oferta) => (
              <li key={oferta.id}>
                <CartaoOferta oferta={oferta} />
              </li>
            ))}
          </ul>
        </>
      )}

      <FolhaAvisos aberta={avisosAberta} aoFechar={() => setAvisosAberta(false)} />
    </div>
  )
}
