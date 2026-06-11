import { IPC_DATA, type IpcPoint } from "./ipc-data"

export type IpcMap = Record<string, number>

/** Mapa yyyy-MM -> índice IPC. */
export function ipcMap(data: IpcPoint[] = IPC_DATA): IpcMap {
  const m: IpcMap = {}
  for (const p of data) if (p.ipc > 0) m[p.period] = p.ipc
  return m
}

/** Meses disponibles (yyyy-MM) ordenados ascendente. */
export function availableMonths(data: IpcPoint[] = IPC_DATA): string[] {
  return data.map((p) => p.period).slice().sort()
}

/** Último mes disponible (yyyy-MM). */
export function latestMonth(data: IpcPoint[] = IPC_DATA): string {
  const months = availableMonths(data)
  return months[months.length - 1]
}

export interface SalaryResult {
  /** Monto equivalente en pesos de refMonth para igualar el poder de compra de fromMonth */
  equivalente: number
  /** Inflación acumulada entre fromMonth y refMonth, en % */
  inflacionAcumuladaPct: number
  /** Poder de compra perdido si el sueldo quedó nominal, en % */
  perdidaPoderPct: number
  /** factor = IPC[ref] / IPC[from] */
  factor: number
}

/** Ajusta `amount` (de fromMonth) a pesos de refMonth con el IPC. null si falta algún mes. */
export function adjustSalary(
  amount: number,
  fromMonth: string,
  refMonth: string,
  map: IpcMap = ipcMap()
): SalaryResult | null {
  const from = map[fromMonth]
  const to = map[refMonth]
  if (!from || !to) return null
  const factor = to / from
  return {
    equivalente: amount * factor,
    inflacionAcumuladaPct: (factor - 1) * 100,
    perdidaPoderPct: (1 - 1 / factor) * 100,
    factor,
  }
}
