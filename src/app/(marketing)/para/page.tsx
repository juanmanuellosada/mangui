import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AUDIENCES } from "@/lib/marketing/audiences"

export const metadata: Metadata = {
  title: "Mangui para vos: freelancers y monotributistas",
  description:
    "Mirá cómo Mangui se adapta a vos: freelancers que cobran en dólares o monotributistas con ingresos variables.",
}

export default function ParaIndexPage() {
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
          Mangui para vos
        </h1>
        <p className="text-muted-foreground text-base leading-relaxed max-w-[48ch]">
          Cómo Mangui se adapta a tu situación — sin el mismo discurso genérico para todos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
        {AUDIENCES.map((audience) => (
          <Link
            key={audience.slug}
            href={`/para/${audience.slug}`}
            className="rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/30 transition-colors duration-200 flex flex-col gap-3 group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2.5 py-0.5">
                Para vos
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-150" aria-hidden="true" />
            </div>
            <div>
              <h2
                className="text-base font-bold text-foreground mb-1"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Mangui para {audience.name}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {audience.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
