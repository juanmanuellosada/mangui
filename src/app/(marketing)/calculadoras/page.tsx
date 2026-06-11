import type { Metadata } from "next"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "Calculadoras financieras para Argentina",
  description:
    "Herramientas gratis para decidir mejor con tu plata: cuotas vs contado con inflación, y más. Pensadas para la realidad argentina.",
}

export default function CalculadorasPage() {
  return (
    <div className="container mx-auto px-5 max-w-6xl py-16 md:py-24">
      <div className="mb-12 max-w-2xl">
        <h1
          className="text-foreground leading-tight tracking-tight text-wrap-balance mb-4"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem,4vw,2.6rem)",
            letterSpacing: "-0.025em",
          }}
        >
          Calculadoras financieras
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-[48ch]">
          Herramientas gratuitas pensadas para la realidad argentina: inflación, cuotas, dólares. Tomá mejores decisiones con tu plata.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
        {/* Live: Cuotas vs Contado */}
        <Link
          href="/calculadoras/cuotas-vs-contado"
          className="rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/30 transition-colors duration-200 flex flex-col gap-3 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-0.5">
              Disponible
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-150" aria-hidden="true" />
          </div>
          <div>
            <h2
              className="text-base font-bold text-foreground mb-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Cuotas vs Contado
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ¿Conviene financiar o pagar al contado? Con inflación, en pesos de hoy.
            </p>
          </div>
        </Link>

        {/* Coming soon: Sueldo ajustado */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-3 opacity-60 cursor-not-allowed">
          <div>
            <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">
              Próximamente
            </span>
          </div>
          <div>
            <h2
              className="text-base font-bold text-foreground mb-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Sueldo ajustado por inflación
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ¿Cuánto vale tu sueldo en términos reales comparado con años anteriores?
            </p>
          </div>
        </div>

        {/* Coming soon: Conversor */}
        <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-3 opacity-60 cursor-not-allowed">
          <div>
            <span className="text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">
              Próximamente
            </span>
          </div>
          <div>
            <h2
              className="text-base font-bold text-foreground mb-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Conversor Blue / MEP / CCL
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Convertí entre pesos y dólares usando el tipo de cambio que te conviene.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-border/60 pt-12 text-center space-y-4">
        <p className="text-muted-foreground text-sm max-w-[38ch] mx-auto">
          ¿Querés seguir el detalle de tus cuotas y ver cómo te afecta la inflación mes a mes?
        </p>
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
      </div>
    </div>
  )
}
