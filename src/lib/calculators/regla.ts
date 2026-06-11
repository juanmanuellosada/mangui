export interface ReglaInput {
  ingreso: number
  pctNecesidades: number
  pctGustos: number
  pctAhorro: number
}

export interface ReglaResult {
  necesidades: number
  gustos: number
  ahorro: number
  sumaPct: number
  balanceado: boolean
}

export const DEFAULT_REGLA = { necesidades: 50, gustos: 30, ahorro: 20 } as const

export function calcularRegla({ ingreso, pctNecesidades, pctGustos, pctAhorro }: ReglaInput): ReglaResult {
  const g = Number.isFinite(ingreso) && ingreso > 0 ? ingreso : 0
  const sumaPct = pctNecesidades + pctGustos + pctAhorro
  return {
    necesidades: g * (pctNecesidades / 100),
    gustos: g * (pctGustos / 100),
    ahorro: g * (pctAhorro / 100),
    sumaPct,
    balanceado: Math.abs(sumaPct - 100) < 0.5,
  }
}
