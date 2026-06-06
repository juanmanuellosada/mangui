import Link from "next/link"
import { Bot, Sparkles, Zap, ShieldCheck } from "lucide-react"
import { getAiUsageToday } from "@/app/actions/ai-settings"

const DAILY_LIMIT = 30

export default async function IAPage() {
  const usage = await getAiUsageToday()

  const used = usage.ok ? usage.used : 0
  const unlimited = usage.ok ? usage.unlimited : false
  const pct = unlimited ? 100 : Math.min(100, Math.round((used / DAILY_LIMIT) * 100))

  return (
    <div className="space-y-8 max-w-2xl animate-fade-in">
      {/* Header */}
      <div className="space-y-0.5 pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Inteligencia artificial
        </h1>
        <p className="text-sm text-muted-foreground">
          La interpretación inteligente de movimientos está incluida sin costo adicional.
        </p>
      </div>

      {/* Usage card */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-sm font-semibold">Uso hoy</h2>
        </div>

        {unlimited ? (
          <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium text-primary">Ilimitado</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Interpretaciones</span>
              <span className="font-semibold tabular-nums">
                {used}{" "}
                <span className="text-muted-foreground font-normal">/ {DAILY_LIMIT}</span>
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={used}
              aria-valuemin={0}
              aria-valuemax={DAILY_LIMIT}
              aria-label={`${used} de ${DAILY_LIMIT} interpretaciones usadas hoy`}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            {used >= DAILY_LIMIT ? (
              <p className="text-xs text-muted-foreground">
                Límite diario alcanzado. Se renueva a las 00:00 hora argentina.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Te quedan{" "}
                <strong className="text-foreground font-semibold">
                  {DAILY_LIMIT - used}
                </strong>{" "}
                interpretaciones para hoy.
              </p>
            )}
          </div>
        )}
      </div>

      {/* How to use */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <Bot className="h-4 w-4 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold">Cómo usarla</h2>
        </div>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
              1
            </span>
            <span>
              En la pantalla de Movimientos, presioná el botón{" "}
              <strong className="text-foreground font-medium">Interpretar</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
              2
            </span>
            <span>
              Escribí o dictá en texto libre lo que querés registrar, por ejemplo:{" "}
              <em className="not-italic text-foreground">&ldquo;gasté 5000 en el súper con la Visa ayer&rdquo;</em>.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
              3
            </span>
            <span>
              Revisá el borrador que armó la IA y confirmá o editá los datos antes de guardar.
            </span>
          </li>
        </ol>

        <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
          <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-primary" />
          <span>La IA nunca guarda movimientos sin que vos los confirmés.</span>
        </div>
      </div>

      {/* Back link */}
      <div className="pb-4">
        <Link
          href="/ajustes"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer"
        >
          ← Volver a Configuración
        </Link>
      </div>
    </div>
  )
}
