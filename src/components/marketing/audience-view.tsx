import Link from "next/link"
import { ArrowLeft, ArrowRight, Info } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Audience } from "@/lib/marketing/audiences"

export function AudienceView({ data }: { data: Audience }) {
  return (
    <div className="space-y-12">
      {/* Back link */}
      <Link
        href="/para"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded w-fit"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Ver para quién es Mangui
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
          {data.headline}
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-[52ch]">
          {data.subhead}
        </p>
      </div>

      {/* Honest note */}
      {data.nota && (
        <div className="rounded-xl border border-border/60 bg-muted/40 p-3 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-muted-foreground leading-relaxed">{data.nota}</p>
        </div>
      )}

      {/* Lo que te ordena */}
      <div className="space-y-4">
        <h2
          className="text-foreground font-bold"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}
        >
          Lo que te ordena
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.retos.map((reto, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/60 bg-card p-5 space-y-1.5"
            >
              <p className="text-sm font-bold text-foreground">{reto.titulo}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{reto.texto}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Funciones que te sirven */}
      <div className="space-y-4">
        <h2
          className="text-foreground font-bold"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}
        >
          Funciones que te sirven
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.features.map((feat, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/60 bg-card p-5 space-y-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xl" aria-hidden>{feat.emoji}</span>
                <p className="text-sm font-bold text-foreground">{feat.titulo}</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{feat.texto}</p>
            </div>
          ))}
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
          ¿Listo para probar Mangui?
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
