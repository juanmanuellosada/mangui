import type { Metadata } from "next"
import Link from "next/link"
import { fetchDolarRates } from "@/lib/rates/dolar"
import type { RatesMap } from "@/lib/rates/dolar"
import { ConversorCalculator } from "./calculator"
import { DOLAR_TYPES } from "@/lib/calculators/conversor"
import { buttonVariants } from "@/components/ui/button"
import { cn, formatCurrency } from "@/lib/utils"
import { ArrowRight } from "lucide-react"
import { BackToCalculadoras } from "@/components/marketing/back-to-calculadoras"

export const revalidate = 1800

export const metadata: Metadata = {
  title: "Conversor de dólar: Oficial, Blue, MEP y CCL",
  description:
    "Convertí pesos a dólares (y al revés) con la cotización del dólar Oficial, Blue, MEP y CCL en tiempo real. Gratis y para Argentina.",
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿A qué precio convierto pesos a dólares?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cuando comprás dólares pagás el precio de venta (sell) del banco o casa de cambio. Cuando vendés dólares recibís el precio de compra (buy). Esta calculadora usa esa lógica: ARS→USD divide por el precio de venta, USD→ARS multiplica por el precio de compra.",
      },
    },
    {
      "@type": "Question",
      name: "¿Cuál es la diferencia entre Blue, MEP y CCL?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "El dólar Oficial es el tipo de cambio regulado por el Banco Central. El Blue es el mercado informal (paralelo). El MEP (o dólar bolsa) se obtiene comprando y vendiendo bonos en pesos y dólares en el mercado formal. El CCL (contado con liquidación) es similar al MEP pero permite sacar divisas al exterior.",
      },
    },
    {
      "@type": "Question",
      name: "¿De dónde sale la cotización?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Las cotizaciones provienen de DolarAPI (dolarapi.com), un servicio público que agrega datos del mercado argentino en tiempo real. La página se actualiza automáticamente cada 30 minutos.",
      },
    },
  ],
}

export default async function ConversorDolarPage() {
  const rates: RatesMap = await fetchDolarRates()
  const hasRates = Object.keys(rates).length > 0

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
          Conversor de dólar
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-[52ch]">
          Convertí pesos a dólares (y al revés) con la cotización del Oficial, Blue, MEP y CCL en tiempo real.
        </p>
      </div>

      {/* Cotización de hoy — for SEO: real data in HTML */}
      <section className="mb-8 rounded-2xl border border-border/60 bg-card p-6">
        <h2
          className="text-foreground font-bold mb-4"
          style={{ fontFamily: "var(--font-display)", fontSize: "1rem" }}
        >
          Cotización de hoy
        </h2>
        {hasRates ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {DOLAR_TYPES.map(({ key, label }) => {
              const rate = rates[key]
              return (
                <div key={key} className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                  {rate ? (
                    <>
                      <p className="text-sm text-foreground">
                        <span className="text-muted-foreground">Compra </span>
                        <span className="tabular-nums font-medium">{formatCurrency(rate.buy, "ARS")}</span>
                      </p>
                      <p className="text-sm text-foreground">
                        <span className="text-muted-foreground">Venta </span>
                        <span className="tabular-nums font-medium">{formatCurrency(rate.sell, "ARS")}</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Cotizaciones no disponibles por el momento.</p>
        )}
      </section>

      <ConversorCalculator rates={rates} />

      {/* SEO explainer */}
      <section className="mt-14 space-y-5 border-t border-border/60 pt-10">
        <h2
          className="text-foreground font-bold"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}
        >
          Qué es cada dólar
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          El <strong className="text-foreground">dólar Oficial</strong> es el tipo de cambio regulado por el Banco Central, al que acceden importaciones y exportaciones.{" "}
          El <strong className="text-foreground">dólar Blue</strong> es el mercado informal (paralelo), ilegal pero ampliamente utilizado en Argentina.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          El <strong className="text-foreground">dólar MEP</strong> (o dólar bolsa) es legal y se obtiene comprando bonos en pesos y vendiéndolos en dólares dentro del mercado de capitales.{" "}
          El <strong className="text-foreground">CCL</strong> (contado con liquidación) es similar al MEP pero permite girar los dólares al exterior.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Al <strong className="text-foreground">comprar dólares</strong> pagás el precio de venta (sell). Al <strong className="text-foreground">vender dólares</strong> recibís el precio de compra (buy). La diferencia entre ambos se llama spread y es la ganancia del intermediario.
        </p>
      </section>

      {/* CTA block */}
      <div className="mt-14 rounded-2xl border border-border/60 bg-card p-7 text-center space-y-4">
        <p
          className="text-foreground font-bold text-base"
          style={{ fontFamily: "var(--font-display)" }}
        >
          ¿Querés registrar tus ahorros en dólares y pesos en un solo lugar?
        </p>
        <p className="text-muted-foreground text-sm max-w-[40ch] mx-auto">
          Mangui convierte todo a pesos automáticamente y te muestra el balance real de tus cuentas en cualquier moneda.
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
