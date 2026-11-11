/*
 * Galeria dos componentes da F2, para conferir no navegador (`npm run dev`).
 * Temporária: na F3 a casca com rotas ocupa o App e a galeria vira uma rota só de desenvolvimento.
 */
import { useState } from 'react'
import type { CorFita } from '../api/tipos'
import { AmostraFita } from '../componentes/AmostraFita'
import { Botao, BotaoIcone } from '../componentes/Botao'
import { Chip } from '../componentes/Chip'
import { Contador } from '../componentes/Contador'
import { EsqueletoLista } from '../componentes/Esqueleto'
import { EstadoVazio } from '../componentes/EstadoVazio'
import { FolhaInferior } from '../componentes/FolhaInferior'
import { IconeSacola, IconeVoltar } from '../componentes/icones'
import { SeloGrupo, SeloOferta, SeloReserva } from '../componentes/Selo'
import { useToast } from '../componentes/toast/contexto'
import styles from './Galeria.module.css'

const FITAS: [CorFita, string, string][] = [
  ['vermelho', 'jan–fev', '2027-02-10'],
  ['amarelo', 'mar–abr', '2027-03-20'],
  ['verde', 'mai–jun', '2027-05-05'],
  ['azul', 'jul–ago', '2027-08-30'],
  ['branco', 'set–out', '2026-10-28'],
  ['preto', 'nov–dez', '2026-12-09'],
]

const CATEGORIAS = ['Todas', 'Laticínios', 'Frios', 'Mercearia']

export function Galeria() {
  const mostrarToast = useToast()
  const [consumidor, setConsumidor] = useState(1)
  const [cadastro, setCadastro] = useState(24)
  const [conferencia, setConferencia] = useState(0)
  const [categoria, setCategoria] = useState('Todas')
  const [folhaAberta, setFolhaAberta] = useState(false)
  const [enviando, setEnviando] = useState(false)

  return (
    <div className={styles.galeria}>
      <section className={styles.secao}>
        <h2 className={styles.titulo}>Botões</h2>
        <Botao
          carregando={enviando}
          onClick={() => {
            setEnviando(true)
            window.setTimeout(() => setEnviando(false), 1500)
          }}
        >
          Reservar
        </Botao>
        <Botao variante="secundario">Secundário</Botao>
        <Botao variante="perigo" onClick={() => setFolhaAberta(true)}>
          Cancelar reserva
        </Botao>
        <Botao disabled>Desabilitado</Botao>
        <BotaoIcone rotulo="Voltar">
          <IconeVoltar />
        </BotaoIcone>
      </section>

      <section className={styles.secao}>
        <h2 className={styles.titulo}>Contador (60 · 72 · 96 px)</h2>
        <p className={styles.legenda}>Consumidor, máximo 6 (o livre)</p>
        <Contador valor={consumidor} min={1} max={6} aoMudar={setConsumidor} rotulo="Quantidade a reservar" />
        <p className={styles.legenda}>Cadastro do lote — segure o + ou o −</p>
        <Contador valor={cadastro} min={1} max={500} aoMudar={setCadastro} rotulo="Quantidade do lote" tamanho="cadastro" />
        <p className={styles.legenda}>Conferência na gôndola</p>
        <Contador valor={conferencia} min={0} max={36} aoMudar={setConferencia} rotulo="Unidades na gôndola" tamanho="conferencia" />
      </section>

      <section className={styles.secao}>
        <h2 className={styles.titulo}>Chips</h2>
        <div className={styles.linha}>
          {CATEGORIAS.map((c) => (
            <Chip key={c} ativo={categoria === c} onClick={() => setCategoria(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </section>

      <section className={styles.secao}>
        <h2 className={styles.titulo}>Selos</h2>
        <div className={styles.linha}>
          <SeloReserva estado="reservada" />
          <SeloReserva estado="retirada" />
          <SeloReserva estado="expirada" />
          <SeloReserva estado="cancelada" />
          <SeloOferta estado="ativa" />
          <SeloOferta estado="encerrada" />
          <SeloGrupo situacao="aguardando" />
          <SeloGrupo situacao="conferir" />
          <SeloGrupo situacao="adiado" />
        </div>
      </section>

      <section className={styles.secao}>
        <h2 className={styles.titulo}>Amostras de fita</h2>
        {FITAS.map(([cor, bimestre, data]) => (
          <AmostraFita key={cor} fita={{ cor, bimestre, ano: Number(data.slice(0, 4)) }} data={data} />
        ))}
        <p>
          Em linha: <AmostraFita fita={{ cor: 'preto', bimestre: 'nov–dez', ano: 2026 }} data="2026-12-09" rotuloData="ref." tamanho="linha" />
        </p>
      </section>

      <section className={styles.secao}>
        <h2 className={styles.titulo}>Carregando, vazio e toast</h2>
        <EsqueletoLista quantidade={2} />
        <EstadoVazio
          icone={<IconeSacola />}
          frase="Nenhuma reserva ativa"
          detalhe="Quando você reservar, o código aparece aqui."
          acao={{ rotulo: 'Ver ofertas', aoClicar: () => mostrarToast('Abriria a vitrine') }}
        />
        <Botao
          variante="secundario"
          onClick={() =>
            mostrarToast({ mensagem: 'Aviso adiado para amanhã', acao: { rotulo: 'Desfazer', aoClicar: () => {} } })
          }
        >
          Mostrar toast
        </Botao>
      </section>

      <FolhaInferior aberta={folhaAberta} titulo="Cancelar esta reserva?" aoFechar={() => setFolhaAberta(false)}>
        <p className={styles.legenda}>As unidades voltam para a oferta e o código deixa de valer.</p>
        <Botao
          variante="perigo"
          onClick={() => {
            setFolhaAberta(false)
            mostrarToast('Reserva cancelada')
          }}
        >
          Sim, cancelar
        </Botao>
        <Botao variante="secundario" onClick={() => setFolhaAberta(false)}>
          Manter reserva
        </Botao>
      </FolhaInferior>
    </div>
  )
}
