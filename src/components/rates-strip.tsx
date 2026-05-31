import { fetchDolarRates, type RateType } from "@/lib/rates/dolar"
import { cn } from "@/lib/utils"

const RATE_LABELS: Record<Exclude<RateType, "manual">, string> = {
  oficial: "Oficial",
  blue: "Blue",
  mep: "MEP",
  ccl: "CCL",
}

const RATE_ORDER: Exclude<RateType, "manual">[] = ["oficial", "blue", "mep", "ccl"]

interface RatesStripProps {
  preferredRateType?: RateType
}

/**
 * Server component — renders a horizontal strip of ARS/USD exchange rates.
 * Highlighted rate matches the user's preferred rate_type.
 */
export async function RatesStrip({ preferredRateType = "blue" }: RatesStripProps) {
  const rates = await fetchDolarRates()

  const hasAny = RATE_ORDER.some((rt) => rates[rt] !== undefined)
  if (!hasAny) {
    return (
      <p className="text-xs text-muted-foreground">
        Cotizaciones no disponibles
      </p>
    )
  }

  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-muted/50 border border-border/40 px-3 py-2 overflow-x-auto no-scrollbar">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1 shrink-0">
        USD/ARS
      </span>
      {RATE_ORDER.map((rateType) => {
        const data = rates[rateType]
        if (!data) return null
        const isPreferred = rateType === preferredRateType

        return (
          <div
            key={rateType}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium shrink-0 transition-all",
              isPreferred
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-background/70 text-muted-foreground border border-border/60"
            )}
          >
            <span className="font-semibold">{RATE_LABELS[rateType]}</span>
            <span className={cn("text-[9px]", isPreferred ? "text-primary-foreground/60" : "opacity-40")}>C</span>
            <span className="tabular-nums">{formatRate(data.buy)}</span>
            <span className={cn("text-[9px]", isPreferred ? "text-primary-foreground/60" : "opacity-40")}>V</span>
            <span className="tabular-nums">{formatRate(data.sell)}</span>
          </div>
        )
      })}
    </div>
  )
}

function formatRate(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
