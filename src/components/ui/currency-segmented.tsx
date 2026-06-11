import { cn } from "@/lib/utils"

const COIN_ICONS: Record<"ARS" | "USD", string> = {
  ARS: "/icons/ar/monedas/ARS.svg",
  USD: "/icons/ar/monedas/USD.svg",
}

/** Three-option currency segmented toggle: Todas | ARS | USD. */
export function CurrencySegmented({
  value,
  onChange,
  className,
}: {
  value: "all" | "ARS" | "USD"
  onChange: (v: "all" | "ARS" | "USD") => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Moneda"
      className={cn("items-center rounded-full border border-border/60 bg-muted/40 p-0.5 gap-0", className ?? "inline-flex")}
    >
      {/* Todas */}
      <button
        type="button"
        onClick={() => onChange("all")}
        aria-pressed={value === "all"}
        className={cn(
          "inline-flex flex-1 justify-center items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          value === "all"
            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Todas
      </button>

      {/* ARS */}
      <button
        type="button"
        onClick={() => onChange("ARS")}
        aria-pressed={value === "ARS"}
        className={cn(
          "inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          value === "ARS"
            ? "bg-lime-500/15 text-lime-700 dark:text-lime-400 shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={COIN_ICONS.ARS} alt="" className="h-3.5 w-3.5 object-contain shrink-0" aria-hidden="true" />
        ARS
      </button>

      {/* USD */}
      <button
        type="button"
        onClick={() => onChange("USD")}
        aria-pressed={value === "USD"}
        className={cn(
          "inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          value === "USD"
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={COIN_ICONS.USD} alt="" className="h-3.5 w-3.5 object-contain shrink-0" aria-hidden="true" />
        USD
      </button>
    </div>
  )
}
