"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { calcularRegla } from "@/lib/calculators/regla"
import { cn, formatCurrency } from "@/lib/utils"

interface Props {
  blueSell: number | null
}

export function ReglaCalculator({ blueSell }: Props) {
  const [ingreso, setIngreso] = useState(1000000)
  const [pctNecesidades, setPctNecesidades] = useState(50)
  const [pctGustos, setPctGustos] = useState(30)
  const [pctAhorro, setPctAhorro] = useState(20)

  const safeIngreso = isNaN(ingreso) || ingreso < 0 ? 0 : ingreso
  const safeNecesidades = isNaN(pctNecesidades) ? 0 : pctNecesidades
  const safeGustos = isNaN(pctGustos) ? 0 : pctGustos
  const safeAhorro = isNaN(pctAhorro) ? 0 : pctAhorro

  const result = useMemo(
    () => calcularRegla({ ingreso: safeIngreso, pctNecesidades: safeNecesidades, pctGustos: safeGustos, pctAhorro: safeAhorro }),
    [safeIngreso, safeNecesidades, safeGustos, safeAhorro]
  )

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Tu ingreso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ingreso">Ingreso mensual neto</Label>
            <MoneyInput
              id="ingreso"
              currency="ARS"
              value={ingreso || ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setIngreso(isNaN(v) ? 0 : v)
              }}
              placeholder="1000000"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pct-necesidades">Necesidades %</Label>
              <Input
                id="pct-necesidades"
                type="number"
                min={0}
                max={100}
                value={pctNecesidades === 0 ? "" : pctNecesidades}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setPctNecesidades(isNaN(v) ? 0 : v)
                }}
                placeholder="50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pct-gustos">Gustos %</Label>
              <Input
                id="pct-gustos"
                type="number"
                min={0}
                max={100}
                value={pctGustos === 0 ? "" : pctGustos}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setPctGustos(isNaN(v) ? 0 : v)
                }}
                placeholder="30"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pct-ahorro">Ahorro %</Label>
              <Input
                id="pct-ahorro"
                type="number"
                min={0}
                max={100}
                value={pctAhorro === 0 ? "" : pctAhorro}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setPctAhorro(isNaN(v) ? 0 : v)
                }}
                placeholder="20"
              />
            </div>
          </div>

          {!result.balanceado && (
            <p className="text-xs text-amber-400/80">
              Los porcentajes suman {result.sumaPct}% (deberían sumar 100%).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Necesidades */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Necesidades · {safeNecesidades}%
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p
              className="tabular-nums font-bold text-foreground text-2xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatCurrency(result.necesidades, "ARS")}
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
              <li>Alquiler y expensas</li>
              <li>Servicios (luz, gas, internet)</li>
              <li>Supermercado</li>
              <li>Transporte (SUBE, nafta)</li>
              <li>Salud / prepaga</li>
              <li>Monotributo</li>
            </ul>
          </CardContent>
        </Card>

        {/* Gustos */}
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-400/80">
              Gustos · {safeGustos}%
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p
              className="tabular-nums font-bold text-foreground text-2xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatCurrency(result.gustos, "ARS")}
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
              <li>Salidas y delivery</li>
              <li>Streaming</li>
              <li>Ropa</li>
              <li>Viajes</li>
              <li>Hobbies</li>
            </ul>
          </CardContent>
        </Card>

        {/* Ahorro */}
        <Card className="border-lime-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-lime-400/80">
              Ahorro · {safeAhorro}%
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p
                className="tabular-nums font-bold text-foreground text-2xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {formatCurrency(result.ahorro, "ARS")}
              </p>
              {blueSell != null && blueSell > 0 && (
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  ≈ {formatCurrency(result.ahorro / blueSell, "USD")} al dólar blue
                </p>
              )}
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed">
              <li>Dólares</li>
              <li>Plazo fijo</li>
              <li>FCI</li>
              <li>Fondo de emergencia</li>
              <li>Inversiones</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
