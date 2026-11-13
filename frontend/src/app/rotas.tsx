/*
 * Mapa de rotas (especificação, "Mapa de rotas sugerido"). Cada tela ainda não feita
 * aparece como "em construção", com a etapa em que entra.
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
import { TelaEmConstrucao } from './telas/TelaEmConstrucao'
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
import { L9Ofertas } from '../telas/loja/L9Ofertas'
import { L10Oferta } from '../telas/loja/L10Oferta'
import { L11Ajuste } from '../telas/loja/L11Ajuste'
import { L12Retirada } from '../telas/loja/L12Retirada'
import { G1Painel } from '../telas/gestor/G1Painel'
import { G3Historico } from '../telas/gestor/G3Historico'
import { G4Ofertas } from '../telas/gestor/G4Ofertas'
import { useVisaoGestor } from './tela'

const tela = (path: string | undefined, codigo: string, titulo: string, etapa: string, larga = false): RouteObject => ({
  ...(path === undefined ? { index: true } : { path }),
  element: <TelaEmConstrucao codigo={codigo} titulo={titulo} etapa={etapa} />,
  handle: (larga ? { largura: 'larga' } : {}) satisfies HandleRota,
})

const LARGA = { largura: 'larga' } satisfies HandleRota

/** Mesma rota, duas telas: G4 para o responsável no computador, L9 no resto. */
function OfertasDaLoja() {
  return useVisaoGestor() ? <G4Ofertas /> : <L9Ofertas />
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
                  tela('produtos/novo', 'L2', 'Novo produto', 'F8'),
                  tela('lotes/novo', 'L3', 'Cadastro do lote', 'F8'),
                  tela('lotes', 'L4 / G5', 'Lotes e fitas', 'F8', true),
                  tela('avisos', 'L5', 'Avisos de validade', 'F8'),
                  tela('avisos/:avisoId', 'L6', 'Conferência na gôndola', 'F8'),
                  tela('avisos/:avisoId/publicar', 'L7', 'Revisar e publicar oferta', 'F8'),
                  { path: 'ofertas', element: <OfertasDaLoja />, handle: LARGA },
                  { path: 'ofertas/:ofertaId', element: <L10Oferta /> },
                  { path: 'ofertas/:ofertaId/ajuste', element: <L11Ajuste /> },
                  { path: 'retirada', element: <L12Retirada /> },
                  {
                    // Só o responsável (L14 e G1–G6).
                    element: <ExigeVinculo papel="responsavel" />,
                    children: [
                      tela('config', 'L14 / G6', 'Configurações da loja', 'F8', true),
                      { path: 'painel', element: <G1Painel />, handle: LARGA },
                      tela('projecao', 'G2', 'Projeção da janela de reserva', 'F7', true),
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
