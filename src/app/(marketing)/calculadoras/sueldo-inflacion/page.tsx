import type { Metadata } from "next"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { createClient as createSbClient } from "@supabase/supabase-js"
import { SueldoCalculator } from "./calculator"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { latestMonth } from "@/lib/calculators/sueldo"
import { IPC_DATA, type IpcPoint } from "@/lib/calculators/ipc-data"
import { ArrowRight } from "lucide-react"

export const revalidate = 86400

async function fetchIpcData(): Promise<IpcPoint[]> {
  try {
    const sb = createSbClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await sb
      .from("inflation_index")
      .select("period, ipc")
      .order("period", { ascending: true })
    if (error || !data || data.length === 0) return IPC_DATA
    return data
      .map((r) => ({ period: String(r.period).slice(0, 7), ipc: Number(r.ipc) }))
      .filter((p) => p.ipc > 0)
  } catch {
    return IPC_DATA
  }
}

export const metadata: Metadata = {
  title: "Calculadora: ¿Cuánto vale tu sueldo ajustado por inflación?",
  description:
    "Calculá cuánto vale en pesos de hoy un sueldo del pasado según el IPC del INDEC. Mirá la inflación acumulada y cuánto poder de compra perdiste.",
}

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿Cómo calculo cuánto vale mi sueldo de hace un año?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Ingresá el monto de tu sueldo, el mes en que lo cobrabas y el mes actual. La calculadora divide el IPC del mes de referencia por el IPC del mes base (ambos del INDEC) para obtener el factor de ajuste, y lo aplica a tu sueldo. El resultado es cuánto necesitás cobrar hoy para tener el mismo poder de compra.",
      },
    },
    {
      "@type": "Question",
      name: "¿Qué es la inflación acumulada?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Es el porcentaje total de aumento de precios entre dos fechas. Por ejemplo, si la inflación acumulada entre enero 2023 y enero 2024 fue del 211%, significa que algo que costaba $100 en enero 2023 cuesta $311 en enero 2024.",
      },
    },
    {
      "@type": "Question",
      name: "¿De dónde salen los datos?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Los índices provienen del IPC Nivel General publicado por el INDEC (Instituto Nacional de Estadística y Censos de Argentina), serie base diciembre 2016=100. Son los mismos datos oficiales que se usan para calcular aumentos salariales y ajuste de haberes.",
      },
    },
  ],
}

export default async function SueldoInflacionPage() {
  const ipcData = await fetchIpcData()
  const latest = latestMonth(ipcData)
  const latestLabel = format(parseISO(latest + "-01"), "MMMM yyyy", { locale: es })
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
          ¿Cuánto vale tu sueldo ajustado por inflación?
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-[52ch]">
          Ingresá un sueldo del pasado y la calculadora te dice cuánto tendrías que cobrar hoy para tener el mismo poder de compra — usando el IPC del INDEC.{" "}
          <span className="text-muted-foreground/70 text-sm">
            Datos actualizados a {latestLabel}.
          </span>
        </p>
      </div>

      <SueldoCalculator ipcData={ipcData} />

      {/* SEO explainer */}
      <section className="mt-14 space-y-5 border-t border-border/60 pt-10">
        <h2
          className="text-foreground font-bold"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}
        >
          ¿Cómo funciona?
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Usamos el <strong className="text-foreground">IPC Nivel General del INDEC</strong> (base diciembre 2016 = 100) para calcular cuánto subieron los precios entre dos meses. El ajuste consiste simplemente en dividir el índice del mes final por el índice del mes inicial: ese factor te dice cuántas veces más necesitás para comprar lo mismo.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Por ejemplo, si en abril 2025 el IPC era 8585.6 y en abril 2026 era 11363.1, el factor es ≈ 1.32. Eso significa que un sueldo de $500.000 en abril 2025 equivale a $663.000 en abril 2026 para mantener el mismo poder de compra.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          La <strong className="text-foreground">pérdida de poder adquisitivo</strong> muestra qué porcentaje del valor real perdiste si tu sueldo en pesos se mantuvo igual. Si la inflación fue del 32%, un sueldo que no subió perdió aproximadamente el 24% de su poder real.
        </p>
      </section>

      {/* CTA block */}
      <div className="mt-14 rounded-2xl border border-border/60 bg-card p-7 text-center space-y-4">
        <p
          className="text-foreground font-bold text-base"
          style={{ fontFamily: "var(--font-display)" }}
        >
          ¿Querés ver cómo evoluciona tu sueldo real mes a mes?
        </p>
        <p className="text-muted-foreground text-sm max-w-[40ch] mx-auto">
          Mangui registra tus ingresos y te muestra cuánto crecieron en términos reales contra la inflación.
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
