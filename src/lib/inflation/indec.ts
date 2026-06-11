/** INDEC IPC Nivel General Nacional, índice base dic-2016, mensual (datos.gob.ar). */
export const IPC_SERIES_ID = "148.3_INIVELNAL_DICI_M_26"
const SERIES_API = "https://apis.datos.gob.ar/series/api/series"

export interface IpcPoint {
  /** Primer día del mes, formato yyyy-MM-dd */
  period: string
  /** Índice IPC nivel general (base dic-2016 = 100) */
  ipc: number
}

interface SeriesResponse {
  data?: unknown
}

/** Parsea el array `data` de la API ([ [fecha, valor], ... ]) a IpcPoint[]. Exportado para tests. */
export function parseIpcSeries(json: SeriesResponse): IpcPoint[] {
  const data = json?.data
  if (!Array.isArray(data)) return []
  const out: IpcPoint[] = []
  for (const row of data) {
    if (!Array.isArray(row)) continue
    const period = row[0]
    const value = row[1]
    if (typeof period === "string" && /^\d{4}-\d{2}-\d{2}$/.test(period) && typeof value === "number" && value > 0) {
      out.push({ period, ipc: value })
    }
  }
  return out
}

export async function fetchIpcSeries(): Promise<IpcPoint[]> {
  try {
    const url = `${SERIES_API}/?ids=${IPC_SERIES_ID}&format=json&limit=5000`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`datos.gob.ar responded ${res.status}`)
    const json = (await res.json()) as SeriesResponse
    return parseIpcSeries(json)
  } catch (err) {
    console.error("[inflation] fetchIpcSeries failed:", err)
    return []
  }
}
