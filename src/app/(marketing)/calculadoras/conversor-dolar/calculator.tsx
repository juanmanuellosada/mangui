"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { convertDolar, DOLAR_TYPES } from "@/lib/calculators/conversor"
import type { Direction } from "@/lib/calculators/conversor"
import type { RatesMap } from "@/lib/rates/dolar"
import { cn, formatCurrency } from "@/lib/utils"

interface Props {
  rates: RatesMap
}

export function ConversorCalculator({ rates }: Props) {
  const [amount, setAmount] = useState(100000)
  const [direction, setDirection] = useState<Direction>("ars_to_usd")

  const safeAmount = isNaN(amount) || amount <= 0 ? 0 : amount
  const inputCurrency = direction === "ars_to_usd" ? "ARS" : "USD"
  const outputCurrency = direction === "ars_to_usd" ? "USD" : "ARS"
  const allMissing = DOLAR_TYPES.every(({ key }) => !rates[key])

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Convertir</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Direction toggle */}
          <div className="flex flex-col gap-2">
            <Label>Dirección</Label>
            <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 p-0.5 w-fit">
              <button
                type="button"
                onClick={() => setDirection("ars_to_usd")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150",
                  direction === "ars_to_usd"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Pesos → Dólares
              </button>
              <button
                type="button"
                onClick={() => setDirection("usd_to_ars")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150",
                  direction === "usd_to_ars"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Dólares → Pesos
              </button>
            </div>
          </div>

          {/* Amount input */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">Monto ({inputCurrency})</Label>
            <MoneyInput
              id="amount"
              currency={inputCurrency}
              value={amount || ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setAmount(isNaN(v) ? 0 : v)
              }}
              placeholder={direction === "ars_to_usd" ? "100000" : "100"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Resultado en {outputCurrency}</CardTitle>
        </CardHeader>
        <CardContent>
          {allMissing ? (
            <p className="text-sm text-muted-foreground">Sin cotización disponible.</p>
          ) : (
            <div className="space-y-2">
              {DOLAR_TYPES.map(({ key, label }) => {
                const rate = rates[key]
                const out = rate ? convertDolar(safeAmount, direction, rate) : null
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-xl bg-muted/40 border border-border/40 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-muted-foreground">{label}</span>
                    {out !== null ? (
                      <span
                        className="tabular-nums font-bold text-foreground text-base"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {formatCurrency(out, outputCurrency)}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
