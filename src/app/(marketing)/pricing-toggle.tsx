"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Sparkles, ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PREMIUM_PRICE_ARS, ANNUAL_PRICE_ARS } from "@/lib/plans"

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)

const PREMIUM_FEATURES = [
  "Todo lo de Free, más:",
  "Cuentas ilimitadas",
  "Presupuestos ilimitados",
  "Metas ilimitadas",
  "Recurrentes ilimitados",
  "Reglas automáticas",
  "Adjuntos en movimientos",
  "Export CSV",
  "IA sin límite diario",
]

export function PricingToggle() {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly")
  const isAnnual = interval === "annual"

  return (
    <div className="relative rounded-2xl border-2 border-primary/40 bg-card p-7 flex flex-col gap-6 shadow-lg shadow-primary/8">
      {/* Recommended badge */}
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary-foreground bg-primary px-3 py-1 rounded-full shadow-sm">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Recomendado
        </span>
      </div>

      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Premium</p>

        {/* Interval toggle */}
        <div className="flex items-center rounded-xl border border-border/60 bg-muted/30 p-1 gap-1 mb-4">
          {(["monthly", "annual"] as const).map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval(iv)}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
                interval === iv
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {iv === "monthly" ? "Mensual" : "Anual"}
            </button>
          ))}
        </div>

        {/* Price */}
        <p
          className="text-4xl font-bold text-foreground tabular-nums"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {isAnnual ? fmt(ANNUAL_PRICE_ARS) : fmt(PREMIUM_PRICE_ARS)}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm text-muted-foreground">
            {isAnnual ? "por año · vía MercadoPago" : "por mes · vía MercadoPago"}
          </p>
          {isAnnual && (
            <span className="inline-flex items-center text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              2 meses gratis
            </span>
          )}
        </div>
      </div>

      {/* Feature list */}
      <ul className="space-y-2.5 flex-1">
        {PREMIUM_FEATURES.map((feat, i) => (
          <li key={feat} className="flex items-start gap-2.5 text-sm">
            {i === 0 ? (
              <span className="text-muted-foreground font-medium">{feat}</span>
            ) : (
              <>
                <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-foreground">{feat}</span>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="space-y-2">
        <Link
          href="/register"
          className={cn(
            buttonVariants(),
            "w-full font-semibold press-effect h-11 text-sm gap-2 shadow-md shadow-primary/25"
          )}
        >
          Empezar
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="text-xs text-muted-foreground text-center">Cancelás cuando quieras</p>
      </div>
    </div>
  )
}
