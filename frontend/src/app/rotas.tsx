/*
 * Mapa de rotas (especificação, "Mapa de rotas sugerido"). Todas as telas da
 * especificação estão aqui desde a F8.
 */
import type { RouteObject } from 'react-router'
import { Galeria } from '../galeria/Galeria'
import { LayoutConsumidor } from './layouts/LayoutConsumidor'
import type { HandleRota } from './layouts/LayoutGestor'
import { LayoutLoja } from './layouts/LayoutLoja'
import { LayoutRaiz } from './layouts/LayoutRaiz'
import { ExigeLogin, ExigeVinculo, SoVisitante } from './protecao'
import { A1Abertura } from './telas/A1Abertura'
import { NaoEncontrada } from './telas/NaoEncontrada'
import { TelaCriarConta } from '../telas/acesso/TelaCriarConta'
import { TelaEntrar } from '../telas/acesso/TelaEntrar'
import { TelaEscolher } from '../telas/acesso/TelaEscolher'
import { C1Local } from '../telas/consumidor/C1Local'
import { C2Vitrine } from '../telas/consumidor/C2Vitrine'
import { C4Oferta } from '../telas/consumidor/C4Oferta'
import { C5Resultado } from '../telas/consumidor/C5Resultado'
import { C6Reserva } from '../telas/consumidor/C6Reserva'
import { C8MinhasReservas } from '../telas/consumidor/C8MinhasReservas'
import { C9Perfil } from '../telas/consumidor/C9Perfil'
import { L1Inicio } from '../telas/loja/L1Inicio'
import { L2Produto } from '../telas/loja/L2Produto'
import { L3Lote } from '../telas/loja/L3Lote'
import { L4Lotes } from '../telas/loja/L4Lotes'
import { L5Avisos } from '../telas/loja/L5Avisos'
import { L6Conferencia } from '../telas/loja/L6Conferencia'
import { L7Publicar } from '../telas/loja/L7Publicar'
import { L9Ofertas } from '../telas/loja/L9Ofertas'
import { L10Oferta } from '../telas/loja/L10Oferta'
import { L11Ajuste } from '../telas/loja/L11Ajuste'
import { L12Retirada } from '../telas/loja/L12Retirada'
import { G1Painel } from '../telas/gestor/G1Painel'
import { ConfiguracoesLoja } from '../telas/gestor/ConfiguracoesLoja'
import { G2Projecao } from '../telas/gestor/G2Projecao'
import { G3Historico } from '../telas/gestor/G3Historico'
import { G5Lotes } from '../telas/gestor/G5Lotes'
import { G4Ofertas } from '../telas/gestor/G4Ofertas'
import { useVisaoGestor } from './tela'

const LARGA = { largura: 'larga' } satisfies HandleRota

/** Mesma rota, duas telas: a versão do computador para o responsável com tela larga. */
function OfertasDaLoja() {
  return useVisaoGestor() ? <G4Ofertas /> : <L9Ofertas />
}

function LotesDaLoja() {
  return useVisaoGestor() ? <G5Lotes /> : <L4Lotes />
}

export const rotas: RouteObject[] = [
  // A1 fica fora do LayoutRaiz: tem a própria faixa "Conectando…" no rodapé.
  { path: '/', element: <A1Abertura /> },
  {
    element: <LayoutRaiz />,
    children: [
      // ---------- Acesso ----------
      // Quem já está logado (inclusive logo após entrar) é levado ao destino pelo SoVisitante.
      { element: <SoVisitante />, children: [{ path: 'entrar', element: <TelaEntrar /> }] },
      { element: <SoVisitante destino="boas-vindas" />, children: [{ path: 'criar-conta', element: <TelaCriarConta /> }] },
      { element: <ExigeLogin />, children: [{ path: 'escolher', element: <TelaEscolher /> }] },
      // C1 é pública (o visitante também escolhe o local) e ocupa a tela toda.
      { path: 'boas-vindas', element: <C1Local /> },

      // ---------- Consumidor (vitrine e oferta abertas ao visitante) ----------
      {
        element: <LayoutConsumidor />,
        children: [
          { path: 'vitrine', element: <C2Vitrine /> },
          { path: 'oferta/:ofertaId', element: <C4Oferta /> },
          {
            element: <ExigeLogin />,
            children: [
              { path: 'reserva/:id/resultado', element: <C5Resultado /> },
              { path: 'reservas', element: <C8MinhasReservas /> },
              { path: 'reservas/:id', element: <C6Reserva /> },
              { path: 'perfil', element: <C9Perfil /> },
            ],
          },
        ],
      },

      // ---------- Loja (funcionário e responsável) ----------
      {
        path: 'loja/:lojaId',
        element: <ExigeLogin />,
        children: [
          {
            element: <ExigeVinculo />,
            children: [
              {
                element: <LayoutLoja />,
                children: [
                  { index: true, element: <L1Inicio /> },
                  { path: 'produtos/novo', element: <L2Produto /> },
                  { path: 'lotes/novo', element: <L3Lote /> },
                  { path: 'lotes', element: <LotesDaLoja />, handle: LARGA },
                  { path: 'avisos', element: <L5Avisos /> },
                  { path: 'avisos/:avisoId', element: <L6Conferencia /> },
                  { path: 'avisos/:avisoId/publicar', element: <L7Publicar /> },
                  { path: 'ofertas', element: <OfertasDaLoja />, handle: LARGA },
                  { path: 'ofertas/:ofertaId', element: <L10Oferta /> },
                  { path: 'ofertas/:ofertaId/ajuste', element: <L11Ajuste /> },
                  { path: 'retirada', element: <L12Retirada /> },
                  // L14 e G6: qualquer vínculo vê; só o responsável edita (decidido 14/11/2026).
                  { path: 'config', element: <ConfiguracoesLoja />, handle: LARGA },
                  {
                    // Só o responsável (G1–G6).
                    element: <ExigeVinculo papel="responsavel" />,
                    children: [
                      { path: 'painel', element: <G1Painel />, handle: LARGA },
                      { path: 'projecao', element: <G2Projecao />, handle: LARGA },
                      { path: 'reservas', element: <G3Historico />, handle: LARGA },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },

      // Galeria dos componentes, só em desenvolvimento.
      ...(import.meta.env.DEV ? [{ path: 'dev/componentes', element: <Galeria /> }] : []),

      { path: '*', element: <NaoEncontrada /> },
    ],
  },
]
