import type { Metadata } from "next"
import Link from "next/link"
import { CuotasCalculator } from "./calculator"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "Calculadora: Cuotas vs Contado con inflación",
  description:
    "¿Conviene pagar en cuotas o al contado en Argentina? Calculá el costo real en pesos de hoy descontando la inflación, y mirá a partir de qué inflación mensual te conviene financiar.",
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿Conviene pagar en cuotas o al contado?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Depende de la inflación. En Argentina, con inflación alta, una cuota fija pierde poder adquisitivo cada mes. Si la inflación supera cierto umbral (la 'inflación de indiferencia'), el valor real de las cuotas termina siendo menor que el precio al contado, y financiar conviene. Usá esta calculadora para comparar tu caso concreto.",
      },
    },
    {
      "@type": "Question",
      name: "¿Cómo afecta la inflación a las cuotas?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cuando pagás cuotas fijas en pesos, cada cuota te cuesta nominalmente lo mismo, pero en términos reales vale menos porque el peso se deprecia con la inflación. Cuanto más alta la inflación y más larga la financiación, más barato resulta pagar en cuotas en términos reales.",
      },
    },
    {
      "@type": "Question",
      name: "¿Qué es la inflación de indiferencia?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Es la tasa de inflación mensual a partir de la cual te da exactamente igual pagar al contado o en cuotas, porque el valor presente de todas las cuotas (descontando la inflación) iguala el precio al contado. Si la inflación real supera ese número, conviene financiar.",
      },
    },
  ],
}

export default function CuotasVsContadoPage() {
  return (
    <div className="container mx-auto px-5 max-w-3xl py-12 md:py-20">
      <div className="mb-8">
        <h1
          className="text-foreground leading-tight tracking-tight text-wrap-balance mb-4"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.8rem,4vw,2.6rem)",
            letterSpacing: "-0.025em",
          }}
        >
          Cuotas vs Contado
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-[52ch]">
          En Argentina, con inflación alta, una cuota fija vale menos cada mes. Esta calculadora compara el costo real de financiar contra pagar al contado — en pesos de hoy.
        </p>
      </div>

      <CuotasCalculator />

      {/* SEO explainer */}
      <section className="mt-14 space-y-5 border-t border-border/60 pt-10">
        <h2
          className="text-foreground font-bold"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}
        >
          ¿Cómo funciona?
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Cuando pagás cuotas fijas en pesos, cada cuota cuesta nominalmente lo mismo, pero en términos reales vale menos porque el peso pierde poder adquisitivo con la inflación. Esta calculadora descuenta cada cuota futura por la inflación esperada y suma todos esos valores para obtener el <strong className="text-foreground">valor presente</strong> — es decir, cuánto te cuestan las cuotas en pesos de hoy.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Si ese valor presente es menor que el precio al contado, conviene financiar: la inflación "licuó" parte del recargo. Si es mayor, el contado sigue siendo más barato aunque los bancos ofrezcan "sin interés".
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          La <strong className="text-foreground">inflación de indiferencia</strong> es el número clave: la tasa mensual a partir de la cual da exactamente lo mismo pagar en cuotas o al contado. Si creés que la inflación va a superar ese umbral, financiar es la decisión racional.
        </p>
      </section>

      {/* CTA block */}
      <div className="mt-14 rounded-2xl border border-border/60 bg-card p-7 text-center space-y-4">
        <p
          className="text-foreground font-bold text-base"
          style={{ fontFamily: "var(--font-display)" }}
        >
          ¿Querés seguir todas tus cuotas en tiempo real?
        </p>
        <p className="text-muted-foreground text-sm max-w-[40ch] mx-auto">
          Mangui te muestra cuánto pagás por cuota, cuántas faltan y el total proyectado de cada financiación.
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
