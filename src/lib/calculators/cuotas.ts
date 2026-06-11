export interface CuotasInput {
  contado: number          // precio al contado (ARS)
  cuotas: number           // cantidad de cuotas (>=1)
  valorCuota: number       // valor de cada cuota (ARS)
  inflacionMensual: number // tasa mensual, ej 0.025 = 2,5%
}

export interface CuotasResult {
  totalNominal: number
  recargoNominal: number
  recargoNominalPct: number
  valorPresente: number          // VP de las cuotas en pesos de hoy
  ahorroReal: number             // contado - valorPresente (positivo = conviene financiar)
  convieneCuotas: boolean        // valorPresente < contado
  breakEvenInflacion: number | null // inflación mensual de indiferencia (VP == contado)
}

/** Valor presente de N cuotas iguales (la primera hoy, mes 0), descontando por inflación mensual r. */
export function valorPresenteCuotas(valorCuota: number, cuotas: number, r: number): number {
  if (cuotas <= 0) return 0
  if (r <= 0) return valorCuota * cuotas
  let vp = 0
  for (let i = 0; i < cuotas; i++) vp += valorCuota / Math.pow(1 + r, i)
  return vp
}

/** Inflación mensual a la que VP(cuotas) == contado (binary search). null si nunca se iguala. */
export function breakEvenInflation(contado: number, cuotas: number, valorCuota: number): number | null {
  const totalNominal = cuotas * valorCuota
  if (totalNominal <= contado) return 0            // las cuotas convienen con cualquier inflación
  if (valorCuota >= contado) return null            // ni con inflación infinita el VP baja al contado
  let lo = 0, hi = 5                               // 0% a 500% mensual
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (valorPresenteCuotas(valorCuota, cuotas, mid) > contado) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function cuotasVsContado(input: CuotasInput): CuotasResult {
  const { contado, cuotas, valorCuota, inflacionMensual } = input
  const totalNominal = cuotas * valorCuota
  const recargoNominal = totalNominal - contado
  const recargoNominalPct = contado > 0 ? (recargoNominal / contado) * 100 : 0
  const valorPresente = valorPresenteCuotas(valorCuota, cuotas, inflacionMensual)
  const ahorroReal = contado - valorPresente
  return {
    totalNominal, recargoNominal, recargoNominalPct, valorPresente, ahorroReal,
    convieneCuotas: valorPresente < contado,
    breakEvenInflacion: breakEvenInflation(contado, cuotas, valorCuota),
  }
}
