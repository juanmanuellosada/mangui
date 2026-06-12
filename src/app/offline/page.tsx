import Link from "next/link"
import { WifiOff, CheckCircle2, XCircle } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sin conexión",
}

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 py-12 text-center">
      {/* Brand mark */}
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: "oklch(0.748 0.219 131.7)" }}
      >
        <WifiOff className="h-9 w-9 text-white" />
      </div>

      <h1
        className="text-3xl font-bold tracking-tight mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Estás sin conexión
      </h1>
      <p className="text-muted-foreground max-w-[36ch] leading-relaxed mb-10">
        No pudimos conectarnos a internet. Tus datos ya cargados siguen disponibles.
      </p>

      {/* What works offline */}
      <div className="w-full max-w-sm space-y-3 text-left mb-10">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Disponible sin conexión
        </p>
        {[
          "Ver datos ya cargados",
          "Navegar entre secciones visitadas",
          "Revisar tus cuentas y saldos guardados",
          "Cargar movimientos (se sincronizan al volver la señal)",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm">{item}</span>
          </div>
        ))}

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-2">
          Requiere conexión
        </p>
        {[
          "Refrescar cotizaciones del dólar",
          "Sincronizar con el servidor",
        ].map((item) => (
          <div key={item} className="flex items-center gap-3">
            <XCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">{item}</span>
          </div>
        ))}
      </div>

      <Link
        href="/inicio"
        className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:opacity-90 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        Ir al inicio
      </Link>
    </div>
  )
}
