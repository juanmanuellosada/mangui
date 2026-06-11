"use client"

import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { adjustSalary, availableMonths, ipcMap, latestMonth } from "@/lib/calculators/sueldo"
import { type IpcPoint } from "@/lib/calculators/ipc-data"
import { cn, formatCurrency } from "@/lib/utils"

function monthLabel(m: string): string {
  const label = format(parseISO(m + "-01"), "MMMM yyyy", { locale: es })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const selectClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

export function SueldoCalculator({ ipcData }: { ipcData: IpcPoint[] }) {
  const months = useMemo(() => availableMonths(ipcData), [ipcData])
  const latest = useMemo(() => latestMonth(ipcData), [ipcData])
  const map = useMemo(() => ipcMap(ipcData), [ipcData])

  // Default "from" = one year before latest, if present; else first month
  const oneYearBefore = latest.replace(/^(\d{4})/, (y) => String(Number(y) - 1))
  const defaultFrom = months.includes(oneYearBefore) ? oneYearBefore : months[0]

  const [amount, setAmount] = useState(500000)
  const [fromMonth, setFromMonth] = useState(() => defaultFrom)
  const [toMonth, setToMonth] = useState(() => latest)

  const r = useMemo(
    () => adjustSalary(isNaN(amount) || amount === 0 ? 0 : amount, fromMonth, toMonth, map),
    [amount, fromMonth, toMonth, map]
  )

  const fromLabel = monthLabel(fromMonth)
  const toLabel = monthLabel(toMonth)

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del sueldo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="amount">Sueldo (monto)</Label>
              <MoneyInput
                id="amount"
                currency="ARS"
                value={amount || ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setAmount(isNaN(v) ? 0 : v)
                }}
                placeholder="500000"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="fromMonth">Mes del sueldo</Label>
              <select
                id="fromMonth"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                className={selectClass}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="toMonth">Compararlo con</Label>
              <select
                id="toMonth"
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
                className={selectClass}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Resultado</CardTitle>
        </CardHeader>
        <CardContent>
          {r === null ? (
            <p className="text-sm text-muted-foreground">Elegí meses válidos.</p>
          ) : (
            <div className="space-y-5">
              {/* Main headline */}
              <div className="rounded-xl bg-muted/40 border border-border/40 px-4 py-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  Para igualar el poder de compra de {fromLabel}, hoy ({toLabel}) necesitás
                </p>
                <p
                  className="tabular-nums font-bold text-foreground"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.5rem,4vw,2rem)",
                  }}
                >
                  {formatCurrency(r.equivalente, "ARS")}
                </p>
              </div>

              {/* Secondary tiles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/40 border border-border/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    Inflación acumulada
                  </p>
                  <p
                    className={cn(
                      "tabular-nums font-bold text-xl",
                      r.inflacionAcumuladaPct >= 0 ? "text-amber-400" : "text-lime-400"
                    )}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {r.inflacionAcumuladaPct >= 0 ? "+" : ""}
                    {r.inflacionAcumuladaPct.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-xl bg-muted/40 border border-border/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    Poder de compra perdido
                  </p>
                  <p
                    className="tabular-nums font-bold text-xl text-red-400"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {r.perdidaPoderPct.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    si tu sueldo siguió igual en pesos
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
