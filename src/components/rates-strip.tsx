import { fetchDolarRates, type RateType } from "@/lib/rates/dolar"
import { cn } from "@/lib/utils"
import { TrendingUp } from "lucide-react"

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
    <div className="flex flex-wrap gap-1.5 items-center rounded-xl bg-muted/40 border border-border/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mr-1">
        <TrendingUp className="h-3.5 w-3.5" />
        <span className="uppercase tracking-wider text-[10px] font-semibold">USD/ARS</span>
      </div>
      {RATE_ORDER.map((rateType) => {
        const data = rates[rateType]
        if (!data) return null
        const isPreferred = rateType === preferredRateType

        return (
          <div
            key={rateType}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
              isPreferred
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background/80 text-muted-foreground border border-border/60"
            )}
          >
            <span className="font-semibold">{RATE_LABELS[rateType]}</span>
            <span className={cn("text-[10px]", isPreferred ? "text-primary-foreground/60" : "opacity-50")}>C</span>
            <span className="tabular-nums">{formatRate(data.buy)}</span>
            <span className={cn("text-[10px]", isPreferred ? "text-primary-foreground/60" : "opacity-50")}>V</span>
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
