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
 * Shows compra, venta and spread per rate. Highlights the user's preferred rate.
 */
export async function RatesStrip({ preferredRateType = "blue" }: RatesStripProps) {
  const rates = await fetchDolarRates()

  const activeRates = RATE_ORDER.filter((rt) => rates[rt] !== undefined)

  if (activeRates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Cotizaciones no disponibles
      </p>
    )
  }

  // Determine if all rates share the same fetchedAt (show once) or differ (show per pill)
  const fetchedAtValues = activeRates.map((rt) => rates[rt]!.fetchedAt)
  const allSameFetchedAt = fetchedAtValues.every((v) => v === fetchedAtValues[0])
  const sharedFetchedAt = allSameFetchedAt ? fetchedAtValues[0] : null

  return (
    <div className="rounded-xl bg-muted/50 border border-border/40 px-3 py-2.5 space-y-2">
      {/* Header row: label + shared update time */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          USD/ARS
        </span>
        {sharedFetchedAt && (
          <span className="text-[10px] text-muted-foreground/70 tabular-nums">
            Actualizado {formatFetchedAt(sharedFetchedAt)}
          </span>
        )}
      </div>

      {/* Rate pills: 2-col grid on mobile, single row on sm+ */}
      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-stretch sm:gap-1.5">
        {activeRates.map((rateType) => {
          const data = rates[rateType]!
          const isPreferred =
            preferredRateType !== "manual" && rateType === preferredRateType
          const spread = computeSpread(data.buy, data.sell)

          return (
            <div
              key={rateType}
              className={cn(
                "flex flex-col gap-1 rounded-lg px-2.5 py-2 transition-all",
                "sm:flex-1 sm:min-w-[88px]",
                isPreferred
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 ring-1 ring-primary/40"
                  : "bg-background/70 border border-border/60"
              )}
            >
              {/* Rate name + per-pill update time (only when timestamps differ) */}
              <div className="flex items-center justify-between gap-1">
                <span
                  className={cn(
                    "text-[11px] font-semibold leading-none",
                    isPreferred ? "text-primary-foreground" : "text-foreground"
                  )}
                >
                  {RATE_LABELS[rateType]}
                </span>
                {!sharedFetchedAt && (
                  <span
                    className={cn(
                      "text-[9px] leading-none tabular-nums",
                      isPreferred
                        ? "text-primary-foreground/55"
                        : "text-muted-foreground/60"
                    )}
                  >
                    {formatFetchedAt(data.fetchedAt)}
                  </span>
                )}
              </div>

              {/* Compra / Venta values */}
              <div
                className={cn(
                  "flex items-baseline gap-2 tabular-nums",
                  isPreferred ? "text-primary-foreground" : "text-foreground"
                )}
              >
                <span className="flex items-baseline gap-0.5">
                  <span
                    className={cn(
                      "text-[9px] font-bold uppercase",
                      isPreferred
                        ? "text-primary-foreground/55"
                        : "text-muted-foreground/60"
                    )}
                  >
                    C
                  </span>
                  <span className="text-xs font-semibold leading-none">
                    {formatRate(data.buy)}
                  </span>
                </span>
                <span className="flex items-baseline gap-0.5">
                  <span
                    className={cn(
                      "text-[9px] font-bold uppercase",
                      isPreferred
                        ? "text-primary-foreground/55"
                        : "text-muted-foreground/60"
                    )}
                  >
                    V
                  </span>
                  <span className="text-xs font-semibold leading-none">
                    {formatRate(data.sell)}
                  </span>
                </span>
              </div>

              {/* Spread badge */}
              {spread !== null && (
                <span
                  className={cn(
                    "self-start text-[9px] font-medium px-1 py-0.5 rounded leading-none",
                    isPreferred
                      ? "bg-primary-foreground/15 text-primary-foreground/75"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  spread {spread}%
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRate(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function computeSpread(buy: number, sell: number): string | null {
  if (!buy || !sell || buy <= 0) return null
  const pct = ((sell - buy) / buy) * 100
  // Show 1 decimal if < 10, 0 decimals if >= 10 (keeps it compact)
  return pct.toFixed(pct < 10 ? 1 : 0)
}

/**
 * Extracts the wall-clock HH:mm from an ISO 8601 string without any timezone
 * conversion. The string after "T" always carries the local Argentine time as
 * provided by the API, whether it has an offset suffix or not.
 *
 * Matches: "2024-01-15T14:30:00-03:00", "2024-01-15T14:30:00", "2024-01-15T14:30"
 * Returns "" on no match so the caller can skip rendering safely.
 */
function formatFetchedAt(isoString: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(isoString)
  if (!match) return ""
  return `${match[1]}:${match[2]}`
}
