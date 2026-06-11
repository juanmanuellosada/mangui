import Link from "next/link"
import { Check, Minus, X, ArrowLeft, ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Comparison, Cell } from "@/lib/marketing/comparisons"

function CellIcon({ cell }: { cell: Cell }) {
  if (cell.ok === "yes") {
    return (
      <span className="inline-flex flex-col items-center gap-0.5">
        <Check className="h-4 w-4 text-lime-400 shrink-0" aria-label="Sí" />
        {cell.note && (
          <span className="text-[10px] text-muted-foreground leading-tight text-center max-w-[80px]">
            {cell.note}
          </span>
        )}
      </span>
    )
  }
  if (cell.ok === "partial") {
    return (
      <span className="inline-flex flex-col items-center gap-0.5">
        <Minus className="h-4 w-4 text-amber-400 shrink-0" aria-label="Parcial" />
        {cell.note && (
          <span className="text-[10px] text-muted-foreground leading-tight text-center max-w-[80px]">
            {cell.note}
          </span>
        )}
      </span>
    )
  }
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <X className="h-4 w-4 text-muted-foreground shrink-0" aria-label="No" />
      {cell.note && (
        <span className="text-[10px] text-muted-foreground leading-tight text-center max-w-[80px]">
          {cell.note}
        </span>
      )}
    </span>
  )
}

export function ComparisonView({ data }: { data: Comparison }) {
  return (
    <div className="space-y-12">
      {/* Back link */}
      <Link
        href="/comparar"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded w-fit"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Ver todas las comparativas
      </Link>

      {/* Heading */}
      <div className="space-y-4">
        <h1
          className="text-foreground leading-tight tracking-tight text-wrap-balance"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem,4vw,2.6rem)",
            letterSpacing: "-0.025em",
          }}
        >
          Mangui vs {data.rival}
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-[52ch]">
          {data.intro}
        </p>
      </div>

      {/* Comparison table */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left px-4 py-3 font-semibold text-foreground">
                  Función
                </th>
                <th className="text-center px-4 py-3 font-semibold text-foreground w-28">
                  Mangui
                </th>
                <th className="text-center px-4 py-3 font-semibold text-foreground w-28">
                  {data.rival}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-border/40 last:border-0",
                    i % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                  )}
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.feature}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CellIcon cell={row.mangui} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CellIcon cell={row.rival} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cuándo elegir cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-2">
          <p className="text-xs font-semibold text-lime-400 uppercase tracking-wide">
            Elegí Mangui si…
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.cuandoMangui}
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-2">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
            Elegí {data.rival} si…
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.cuandoRival}
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-6">
        <h2
          className="text-foreground font-bold"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}
        >
          Preguntas frecuentes
        </h2>
        <div className="space-y-5">
          {data.faq.map((item, i) => (
            <div key={i} className="space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground">{item.q}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-border/60 pt-10 text-center space-y-4">
        <p className="text-muted-foreground text-sm max-w-[40ch] mx-auto">
          ¿Listo para probar Mangui con la plata argentina de verdad?
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "gap-2 font-semibold press-effect h-11 px-8 text-sm"
            )}
          >
            Crear cuenta gratis
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center h-11 px-6 text-sm font-semibold rounded-lg border border-border/70 text-foreground hover:bg-muted transition-colors duration-150 press-effect focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver demo
          </Link>
        </div>
      </div>
    </div>
  )
}
