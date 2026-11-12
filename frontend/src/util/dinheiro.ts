/*
 * PRÉVIA de total na tela (C4 "Reservar 2 · R$ 6,28"), como o contrato permite na L7:
 * o valor oficial é o `total` que a API devolve. Conta em centavos inteiros.
 */
export function previaTotal(preco: string, quantidade: number): string {
  const [inteiro, frac = '0'] = preco.split('.')
  const centavos = (Number(inteiro) * 100 + Number(frac.padEnd(2, '0').slice(0, 2))) * quantidade
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`
}
