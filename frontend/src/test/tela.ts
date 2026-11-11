/*
 * Largura de tela falsa para os testes (o jsdom não tem matchMedia).
 * Padrão: 390 px (celular). Para o layout do gestor: definirLarguraTela(1280).
 */
let largura = 390

export function definirLarguraTela(px: number) {
  largura = px
}

export function instalarMatchMedia() {
  window.matchMedia = (consulta: string) => {
    const minimo = /min-width:\s*(\d+)px/.exec(consulta)
    return {
      matches: minimo ? largura >= Number(minimo[1]) : false,
      media: consulta,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList
  }
}
