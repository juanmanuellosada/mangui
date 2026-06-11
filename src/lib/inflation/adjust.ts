export type IpcMap = Record<string, number> // "yyyy-MM" -> índice IPC

/** Construye un mapa "yyyy-MM" -> ipc a partir de las filas de inflation_index. */
export function buildIpcMap(rows: { period: string; ipc: number }[]): IpcMap {
  const m: IpcMap = {}
  for (const r of rows) {
    const key = (r?.period ?? "").slice(0, 7)
    if (key && typeof r.ipc === "number" && r.ipc > 0) m[key] = r.ipc
  }
  return m
}

/** Último mes (yyyy-MM) disponible en el mapa, o null. */
export function latestIpcMonth(ipc: IpcMap): string | null {
  const keys = Object.keys(ipc)
  if (keys.length === 0) return null
  return keys.sort().at(-1) ?? null
}

/** Factor para convertir pesos del mes `fromMonth` a pesos de `refMonth`. 1 si falta alguno. */
export function inflationFactor(fromMonth: string, refMonth: string, ipc: IpcMap): number {
  const from = ipc[fromMonth]
  const to = ipc[refMonth]
  if (!from || !to) return 1
  return to / from
}

/** Ajusta un monto desde el mes de `dateStr` (yyyy-MM-dd) a pesos de `refMonth`. */
export function adjustAmount(amount: number, dateStr: string, refMonth: string, ipc: IpcMap): number {
  const month = (dateStr ?? "").slice(0, 7)
  return amount * inflationFactor(month, refMonth, ipc)
}
