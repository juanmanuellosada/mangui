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
    <div className="rounded-xl bg-muted/50 border border-border/40 px-3 py-2">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 sm:hidden">
        USD/ARS
      </span>
      {/* Mobile: 2×2 grid. sm+: single row */}
      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-1.5">
        <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1 shrink-0">
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
                "flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all",
                "sm:inline-flex sm:justify-start sm:shrink-0 sm:px-2.5 sm:py-1",
                isPreferred
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-background/70 text-muted-foreground border border-border/60"
              )}
            >
              <span className="font-semibold">{RATE_LABELS[rateType]}</span>
              <span className="flex items-center gap-0.5 tabular-nums">
                <span className={cn("text-[9px]", isPreferred ? "text-primary-foreground/60" : "opacity-40")}>C</span>
                <span>{formatRate(data.buy)}</span>
                <span className={cn("text-[9px] ml-1", isPreferred ? "text-primary-foreground/60" : "opacity-40")}>V</span>
                <span>{formatRate(data.sell)}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatRate(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
