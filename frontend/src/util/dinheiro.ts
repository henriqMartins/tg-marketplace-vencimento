/*
 * PRÉVIA de total na tela (C4 "Reservar 2 · R$ 6,28"), como o contrato permite na L7:
 * o valor oficial é o `total` que a API devolve. Conta em centavos inteiros.
 */
export function previaTotal(preco: string, quantidade: number): string {
  const [inteiro, frac = '0'] = preco.split('.')
  const centavos = (Number(inteiro) * 100 + Number(frac.padEnd(2, '0').slice(0, 2))) * quantidade
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`
}

/** Preço digitado ("6,99", "6.99", "R$ 6,99") → "6.99"; vazio, zero ou mais de 2 casas → null. */
export function lerPrecoDigitado(texto: string): string | null {
  const limpo = texto.replace(/[R$\s]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null
  const [inteiro, frac = ''] = limpo.split('.')
  const centavos = Number(inteiro) * 100 + Number(frac.padEnd(2, '0'))
  return centavos > 0 ? `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}` : null
}

/**
 * PRÉVIA do preço com desconto na L7 ("De R$ 4,49 por R$ 3,14"), como o contrato permite:
 * original × (1 − desconto/100), meio centavo para cima. O oficial é o que a API devolve ao publicar.
 */
export function previaDesconto(original: string, desconto: number): string {
  const [inteiro, frac = '0'] = original.split('.')
  const centavos = Number(inteiro) * 100 + Number(frac.padEnd(2, '0').slice(0, 2))
  const comDesconto = Math.floor((centavos * (100 - desconto) + 50) / 100)
  return `${Math.floor(comDesconto / 100)}.${String(comDesconto % 100).padStart(2, '0')}`
}
