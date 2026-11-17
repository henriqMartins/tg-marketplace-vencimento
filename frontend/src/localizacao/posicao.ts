/* Localização do navegador (navigator.geolocation), embrulhada em Promise. */

export type MotivoErroPosicao = 'negada' | 'indisponivel'

export class ErroPosicao extends Error {
  readonly motivo: MotivoErroPosicao
  constructor(motivo: MotivoErroPosicao) {
    super(
      motivo === 'negada'
        ? 'O navegador não liberou sua localização. Use o CEP.'
        : 'Não conseguimos sua localização agora. Use o CEP.',
    )
    this.name = 'ErroPosicao'
    this.motivo = motivo
  }
}

export type ObterPosicao = () => Promise<{ lat: number; lng: number }>

export const obterPosicao: ObterPosicao = () =>
  new Promise((resolver, rejeitar) => {
    if (!('geolocation' in navigator)) {
      rejeitar(new ErroPosicao('indisponivel'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (erro) => rejeitar(new ErroPosicao(erro.code === erro.PERMISSION_DENIED ? 'negada' : 'indisponivel')),
      // Precisão de bairro basta para ordenar lojas; resposta rápida e posição recente aceita.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  })
