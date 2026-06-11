import type { Metadata } from "next"
import Link from "next/link"
import { fetchDolarRates } from "@/lib/rates/dolar"
import { ReglaCalculator } from "./calculator"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"
import { BackToCalculadoras } from "@/components/marketing/back-to-calculadoras"

export const revalidate = 1800

export const metadata: Metadata = {
  title: "Calculadora regla 50/30/20 (adaptada a Argentina)",
  description:
    "Dividí tu sueldo con la regla 50/30/20: necesidades, gustos y ahorro. Ajustá los porcentajes a la realidad argentina y mirá tu ahorro en dólares.",
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿Qué es la regla 50/30/20?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "La regla 50/30/20 es una guía de presupuesto personal que divide el ingreso neto en tres categorías: 50% para necesidades (alquiler, servicios, supermercado), 30% para gustos (salidas, streaming, hobbies) y 20% para ahorro e inversiones. Es una forma simple de organizar las finanzas sin necesidad de llevar un presupuesto detallado.",
      },
    },
    {
      "@type": "Question",
      name: "¿Sirve la regla 50/30/20 en Argentina?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "La regla sirve como punto de partida, pero en Argentina la inflación y el costo de vida suelen hacer que las necesidades superen el 50% del ingreso, especialmente en grandes ciudades donde el alquiler puede absorber el 40% o más del sueldo. Por eso esta calculadora permite ajustar los porcentajes libremente: si tus necesidades son el 65%, reasignás y ves cuánto queda para gustos y ahorro.",
      },
    },
    {
      "@type": "Question",
      name: "¿Qué entra en cada categoría?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Necesidades incluye todo lo que no puede dejar de pagarse: alquiler y expensas, servicios (luz, gas, internet), supermercado básico, transporte (SUBE o nafta), salud o prepaga, y monotributo si sos monotributista. Gustos son opcionales pero deseados: salidas, delivery, streaming, ropa, viajes y hobbies. Ahorro cubre dólares, plazo fijo, FCI, fondo de emergencia e inversiones en general.",
      },
    },
  ],
}

export default async function ReglaPage() {
  const rates = await fetchDolarRates()
  const blueSell = rates.blue?.sell ?? null

  return (
    <div className="container mx-auto px-5 max-w-3xl py-12 md:py-20">
      <div className="mb-6">
        <BackToCalculadoras />
      </div>
      <div className="mb-8">
        <h1
          className="text-foreground leading-tight tracking-tight text-wrap-balance mb-4"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem,4vw,2.6rem)",
            letterSpacing: "-0.025em",
          }}
        >
          Regla 50/30/20
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-[52ch]">
          Dividí tu ingreso mensual neto en necesidades, gustos y ahorro. Ajustá los porcentajes a tu realidad y mirá cuánto te queda para ahorrar, incluso en dólares.
        </p>
      </div>

      <ReglaCalculator blueSell={blueSell} />

      {/* SEO explainer */}
      <section className="mt-14 space-y-5 border-t border-border/60 pt-10">
        <h2
          className="text-foreground font-bold"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}
        >
          Qué es la regla 50/30/20
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          La regla 50/30/20 es una guía de presupuesto personal que divide el ingreso neto en tres categorías:{" "}
          <strong className="text-foreground">50% para necesidades</strong> (todo lo que no podés dejar de pagar),{" "}
          <strong className="text-foreground">30% para gustos</strong> (lo que querés pero no es imprescindible) y{" "}
          <strong className="text-foreground">20% para ahorro e inversión</strong>. Es una forma de organizar las finanzas sin necesidad de detallar cada gasto.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          En Argentina, con inflación alta y alquileres que pueden consumir el 40% o más del sueldo, las necesidades suelen superar el 50%. Por eso los porcentajes son editables: si tus necesidades reales son el 65%, ajustás el slider y la calculadora te muestra cuánto queda para gustos y ahorro.
        </p>
      </section>

      {/* CTA block */}
      <div className="mt-14 rounded-2xl border border-border/60 bg-card p-7 text-center space-y-4">
        <p
          className="text-foreground font-bold text-base"
          style={{ fontFamily: "var(--font-display)" }}
        >
          ¿Querés hacer un seguimiento real de tus gastos mes a mes?
        </p>
        <p className="text-muted-foreground text-sm max-w-[40ch] mx-auto">
          Mangui te muestra en qué categorías gastás, si estás cumpliendo tu presupuesto y cómo evoluciona tu ahorro con el tiempo.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "gap-2 font-semibold press-effect h-11 px-7 text-sm"
            )}
          >
            Crear cuenta gratis
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center gap-2 h-11 px-6 text-sm font-medium rounded-lg border border-white/20 text-white/80 hover:bg-white/[0.06] hover:border-white/35 hover:text-white transition-colors duration-150 press-effect focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver demo
          </Link>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </div>
  )
}
