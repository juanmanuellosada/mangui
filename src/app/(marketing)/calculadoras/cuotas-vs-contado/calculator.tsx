"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { cuotasVsContado } from "@/lib/calculators/cuotas"
import { cn, formatCurrency } from "@/lib/utils"

export function CuotasCalculator() {
  const [contado, setContado] = useState(100000)
  const [cuotas, setCuotas] = useState(12)
  const [valorCuota, setValorCuota] = useState(10000)
  const [inflacionPct, setInflacionPct] = useState(2.5)

  const result = useMemo(
    () =>
      cuotasVsContado({
        contado: isNaN(contado) ? 0 : contado,
        cuotas: isNaN(cuotas) ? 1 : cuotas,
        valorCuota: isNaN(valorCuota) ? 0 : valorCuota,
        inflacionMensual: isNaN(inflacionPct) ? 0 : inflacionPct / 100,
      }),
    [contado, cuotas, valorCuota, inflacionPct]
  )

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Datos de la compra</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contado">Precio al contado</Label>
              <MoneyInput
                id="contado"
                currency="ARS"
                value={contado || ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setContado(isNaN(v) ? 0 : v)
                }}
                placeholder="100000"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="cuotas">Cantidad de cuotas</Label>
              <Input
                id="cuotas"
                type="number"
                min={1}
                max={60}
                value={cuotas || ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  setCuotas(isNaN(v) ? 1 : Math.max(1, Math.min(60, v)))
                }}
                placeholder="12"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="valorCuota">Valor de cada cuota</Label>
              <MoneyInput
                id="valorCuota"
                currency="ARS"
                value={valorCuota || ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setValorCuota(isNaN(v) ? 0 : v)
                }}
                placeholder="10000"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="inflacion">Inflación mensual esperada (%)</Label>
              <Input
                id="inflacion"
                type="number"
                step="0.1"
                min={0}
                value={inflacionPct || ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setInflacionPct(isNaN(v) ? 0 : v)
                }}
                placeholder="2.5"
              />
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
          <div className="space-y-5">
            {/* Comparison tiles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/40 border border-border/40 px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Al contado</p>
                <p
                  className="tabular-nums font-bold text-foreground text-xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {formatCurrency(isNaN(contado) ? 0 : contado, "ARS")}
                </p>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border/40 px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1 font-medium">En cuotas (pesos de hoy)</p>
                <p
                  className="tabular-nums font-bold text-foreground text-xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {formatCurrency(result.valorPresente, "ARS")}
                </p>
              </div>
            </div>

            {/* Verdict banner */}
            <div
              className={cn(
                "rounded-xl border px-4 py-3",
                result.convieneCuotas
                  ? "border-lime-500/30 bg-lime-500/10 text-lime-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              )}
            >
              <p className="text-sm font-semibold leading-relaxed">
                {result.convieneCuotas ? (
                  <>
                    Conviene financiar: en pesos de hoy ahorrás{" "}
                    <span
                      className="tabular-nums"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {formatCurrency(result.ahorroReal, "ARS")}
                    </span>{" "}
                    pagando en cuotas.
                  </>
                ) : (
                  <>
                    Conviene el contado: las cuotas te cuestan{" "}
                    <span
                      className="tabular-nums"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {formatCurrency(-result.ahorroReal, "ARS")}
                    </span>{" "}
                    más en términos reales.
                  </>
                )}
              </p>
            </div>

            {/* Secondary metrics */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Total nominal en cuotas:{" "}
                <span className="text-foreground tabular-nums font-medium">
                  {formatCurrency(result.totalNominal, "ARS")}
                </span>{" "}
                <span className="text-xs">
                  (+{result.recargoNominalPct.toFixed(0)}% vs contado)
                </span>
              </p>
              {result.breakEvenInflacion !== null && (
                <p>
                  Te conviene financiar si la inflación mensual supera{" "}
                  <span className="text-foreground font-semibold tabular-nums">
                    {(result.breakEvenInflacion * 100).toFixed(1)}%
                  </span>
                  .
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
