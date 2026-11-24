/*
 * CNPJ: só dígitos, máscara e dígitos verificadores (algoritmo da Receita, módulo 11).
 * O backend confere de novo (400 cnpj_invalido); aqui é para avisar antes de consultar.
 */

export const soDigitos = (texto: string) => texto.replace(/\D/g, '')

/** "12345678000190" → "12.345.678/0001-90" (aceita parcial, para formatar enquanto digita). */
export function mascararCnpj(texto: string): string {
  const d = soDigitos(texto).slice(0, 14)
  const partes = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8), d.slice(8, 12), d.slice(12, 14)]
  let saida = partes[0]
  if (partes[1]) saida += `.${partes[1]}`
  if (partes[2]) saida += `.${partes[2]}`
  if (partes[3]) saida += `/${partes[3]}`
  if (partes[4]) saida += `-${partes[4]}`
  return saida
}

function digito(base: string): number {
  // Pesos 2..9 da direita para a esquerda, recomeçando em 2.
  let soma = 0
  let peso = 2
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/** Os 14 dígitos com os dois verificadores certos (e não todos iguais, como 00000000000000). */
export function cnpjValido(texto: string): boolean {
  const d = soDigitos(texto)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const primeiro = digito(d.slice(0, 12))
  const segundo = digito(d.slice(0, 12) + primeiro)
  return d.endsWith(`${primeiro}${segundo}`)
}

/** Completa os 12 primeiros dígitos com os verificadores (usado pelo mock para montar a semente). */
export function completarCnpj(doze: string): string {
  const primeiro = digito(doze)
  return `${doze}${primeiro}${digito(doze + primeiro)}`
}
