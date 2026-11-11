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

const tela = (path: string | undefined, codigo: string, titulo: string, etapa: string, larga = false): RouteObject => ({
  ...(path === undefined ? { index: true } : { path }),
  element: <TelaEmConstrucao codigo={codigo} titulo={titulo} etapa={etapa} />,
  handle: (larga ? { largura: 'larga' } : {}) satisfies HandleRota,
})

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

      // ---------- Consumidor (vitrine e oferta abertas ao visitante) ----------
      {
        element: <LayoutConsumidor />,
        children: [
          tela('vitrine', 'C2 / C3', 'Vitrine', 'F5'),
          tela('oferta/:ofertaId', 'C4', 'Reserva da quantidade', 'F5'),
          {
            element: <ExigeLogin />,
            children: [
              tela('boas-vindas', 'C1', 'Ofertas perto de você', 'F5'),
              tela('reserva/:id/resultado', 'C5', 'Resultado da reserva', 'F5'),
              tela('reservas', 'C8', 'Minhas reservas', 'F5'),
              tela('reservas/:id', 'C6 / C7', 'Código de retirada', 'F5'),
              tela('perfil', 'C9', 'Perfil e preferências', 'F5'),
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
                  tela(undefined, 'L1', 'Início da loja', 'F6'),
                  tela('produtos/novo', 'L2', 'Novo produto', 'F8'),
                  tela('lotes/novo', 'L3', 'Cadastro do lote', 'F8'),
                  tela('lotes', 'L4 / G5', 'Lotes e fitas', 'F8', true),
                  tela('avisos', 'L5', 'Avisos de validade', 'F8'),
                  tela('avisos/:avisoId', 'L6', 'Conferência na gôndola', 'F8'),
                  tela('avisos/:avisoId/publicar', 'L7', 'Revisar e publicar oferta', 'F8'),
                  tela('ofertas', 'L9 / G4', 'Ofertas da loja', 'F6', true),
                  tela('ofertas/:ofertaId', 'L10', 'Detalhe da oferta', 'F6'),
                  tela('ofertas/:ofertaId/ajuste', 'L11', 'Ajuste de estoque', 'F6'),
                  tela('retirada', 'L12 / L13', 'Validar retirada', 'F6'),
                  {
                    // Só o responsável (L14 e G1–G6).
                    element: <ExigeVinculo papel="responsavel" />,
                    children: [
                      tela('config', 'L14 / G6', 'Configurações da loja', 'F8', true),
                      tela('painel', 'G1', 'Painel de acompanhamento', 'F7', true),
                      tela('projecao', 'G2', 'Projeção da janela de reserva', 'F7', true),
                      tela('reservas', 'G3', 'Histórico de reservas', 'F7', true),
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
