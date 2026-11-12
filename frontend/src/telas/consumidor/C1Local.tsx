import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useSessao } from '../../app/contextos'
import { caminhoInternoSeguro } from '../../app/destino'
import { Botao } from '../../componentes/Botao'
import { Campo } from '../../componentes/Campo'
import { IconePino } from '../../componentes/icones'
import { Mensagem } from '../../componentes/Mensagem'
import { ErroCep } from '../../localizacao/cep'
import { useLocal } from '../../localizacao/contexto'
import { ErroPosicao } from '../../localizacao/posicao'
import styles from './Consumidor.module.css'

/**
 * C1 · Localização (e C3, estado "CEP não encontrado"). Pública: o visitante também escolhe.
 * A coordenada só vai na consulta da vitrine; nada é gravado.
 */
export function C1Local() {
  const local = useLocal()
  const { token } = useSessao()
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const [cep, setCep] = useState('')
  const [erroCep, setErroCep] = useState<string | null>(null)
  const [erroPosicao, setErroPosicao] = useState<string | null>(null)
  const [buscando, setBuscando] = useState<'cep' | 'posicao' | null>(null)

  const destino = caminhoInternoSeguro(parametros.get('voltar')) ?? '/vitrine'
  // Primeira vez nesta visita e logado: a vitrine oferece os avisos (C1, tela 2).
  const oferecerAvisos = token !== null && !local.decidiu
  const seguir = () => navegar(destino, { replace: true, state: oferecerAvisos ? { oferecerAvisos: true } : undefined })

  async function usarPosicao() {
    setBuscando('posicao')
    setErroPosicao(null)
    try {
      const { lat, lng } = await local.obterPosicao()
      local.definir({ lat, lng, rotulo: 'Sua localização' })
      seguir()
    } catch (e) {
      setErroPosicao(e instanceof ErroPosicao ? e.message : 'Não conseguimos sua localização agora. Use o CEP.')
    } finally {
      setBuscando(null)
    }
  }

  async function buscar(e: FormEvent) {
    e.preventDefault()
    setBuscando('cep')
    setErroCep(null)
    try {
      const achado = await local.buscarCep(cep)
      local.definir({ lat: achado.lat, lng: achado.lng, rotulo: `${achado.bairro || achado.cidade} · CEP ${achado.cep}` })
      seguir()
    } catch (erro) {
      setErroCep(erro instanceof ErroCep ? erro.message : 'Não foi possível buscar o CEP agora.')
    } finally {
      setBuscando(null)
    }
  }

  function verTodas() {
    local.verSemLocal()
    seguir()
  }

  return (
    <div className={styles.paginaC1}>
      <span className={styles.circulo} aria-hidden="true">
        <IconePino tamanho={32} />
      </span>
      <h1 className={styles.tituloLista}>Ofertas perto de você</h1>
      <p className={styles.texto}>Usamos sua localização só para ordenar as lojas pela distância. Nada fica gravado.</p>

      <Botao onClick={usarPosicao} carregando={buscando === 'posicao'} textoCarregando="Localizando…">
        Usar minha localização
      </Botao>
      {erroPosicao && <Mensagem tipo="atencao">{erroPosicao}</Mensagem>}

      <div className={styles.divisor}>
        <span>ou</span>
      </div>

      <form className={styles.formCep} onSubmit={buscar} noValidate>
        <Campo
          className={styles.campoCep}
          rotulo="CEP"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          maxLength={9}
          value={cep}
          onChange={(e) => {
            setCep(e.target.value)
            setErroCep(null)
          }}
          dica={erroCep ? undefined : 'Se o navegador negar a localização, o CEP é o caminho'}
          erro={erroCep}
        />
        <Botao type="submit" variante="secundario" larguraTotal={false} className={styles.botaoBuscar} carregando={buscando === 'cep'} textoCarregando="Buscando…">
          {erroCep ? 'Buscar de novo' : 'Buscar'}
        </Botao>
      </form>
      {erroCep && <p className={styles.nota}>Sem local, a vitrine aparece sem ordem de distância.</p>}

      <button type="button" className={styles.linkBotao} onClick={verTodas}>
        Ver todas sem ordenar por distância
      </button>
    </div>
  )
}
