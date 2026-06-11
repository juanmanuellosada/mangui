import Image from "next/image";
import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { fetchDolarRates, type RatesMap } from "@/lib/rates/dolar";
import { PricingToggle } from "@/app/(marketing)/pricing-toggle";
import {
  ArrowRight,
  Download,
  CreditCard,
  RefreshCcw,
  Target,
  Smartphone,
  MessageSquare,
  TrendingUp,
  ChevronRight,
  Zap,
  BarChart3,
  Check,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const revalidate = 1800

/* ─── Helpers ───────────────────────────────────────────────── */
function formatRate(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/* ─── Demo CTA ──────────────────────────────────────────────── */
function DemoCTA({
  className,
  variant = "outline-dark",
}: {
  className?: string;
  variant?: "outline-dark" | "outline-light";
}) {
  return (
    <Link
      href="/demo"
      className={cn(
        "inline-flex items-center justify-center gap-2 h-11 px-6 text-sm font-semibold rounded-lg transition-colors duration-150 press-effect focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "outline-dark"
          ? "border border-white/20 text-white/80 hover:bg-white/8 hover:text-white"
          : "border border-border/70 text-foreground hover:bg-muted",
        className
      )}
    >
      Ver demo
    </Link>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default async function LandingPage() {
  const dolarRates: RatesMap = await fetchDolarRates()

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* ══ NAV ══════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-white/10 glass bg-[#1A1F1A]/80">
        <div className="container mx-auto px-5 h-16 flex items-center justify-between max-w-6xl">
          <Link
            href="/"
            className="flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <BrandLockup size={28} />
          </Link>

          <nav
            className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground"
            aria-label="Navegación principal"
          >
            <Link
              href="#funciones"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            >
              Funciones
            </Link>
            <Link
              href="#manguito"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            >
              Manguito IA
            </Link>
            <Link
              href="#precios"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            >
              Precios
            </Link>
            <Link
              href="/calculadoras"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            >
              Calculadoras
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "inline-flex font-medium text-sm"
              )}
            >
              Ingresar
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "sm" }), "font-semibold press-effect")}
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ══ HERO ═════════════════════════════════════════════ */}
        {/*
          The aurora canvas is now a fixed full-viewport backdrop mounted in the
          marketing layout. This section is transparent so the aurora shows through.
        */}
        <section
          className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-36"
        >
          <div className="container mx-auto px-5 max-w-6xl relative" style={{ zIndex: 10 }}>
            <div className="grid lg:grid-cols-[1fr_1.15fr] gap-14 lg:gap-20 items-center">
              {/* ── Left: copy ── */}
              <div className="flex flex-col gap-7 animate-fade-up">
                <h1
                  className="leading-[1.08] tracking-tight text-wrap-balance"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(2.1rem,5.2vw,3.4rem)",
                    letterSpacing: "-0.03em",
                    color: "#F0F4EE",
                  }}
                >
                  Tu plata en pesos
                  <br />y dólares,{" "}
                  <span style={{ color: "#84CC16" }}>bajo control</span>
                </h1>

                {/* subtext — muted light tone, WCAG-AA on #1A1F1A: rgba(240,244,238,0.70) ≈ 5.8:1 */}
                <p
                  className="text-base leading-relaxed max-w-[44ch]"
                  style={{ color: "rgba(240,244,238,0.70)" }}
                >
                  Seguí el Blue, el MEP y el CCL. Controlá cuotas y resúmenes de tarjeta.
                  Entendé la inflación en tus propios números. Para argentinos, con datos reales.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  {/* Primary: lime bg with dark text (same default variant) */}
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "gap-2 font-semibold shadow-lg shadow-primary/25 press-effect h-11 px-7 text-sm"
                    )}
                  >
                    Crear cuenta
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  {/* Secondary: outline on dark */}
                  <Link
                    href="/demo"
                    className="inline-flex items-center justify-center gap-2 h-11 px-6 text-sm font-medium rounded-lg border press-effect w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-150 border-white/20 text-white/80 hover:bg-white/[0.06] hover:border-white/35 hover:text-white"
                  >
                    Ver demo
                  </Link>
                </div>

                <p className="text-xs leading-relaxed" style={{ color: "rgba(240,244,238,0.45)" }}>
                  "Ver demo" abre una cuenta de ejemplo, solo lectura. Sin registro.
                </p>

                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 text-sm w-fit group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded transition-colors duration-150 text-white/50 hover:text-[#84CC16]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Instalá como app — sin App Store
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-150" aria-hidden="true" />
                </Link>
              </div>

              {/* ── Right: dashboard mockup ── */}
              <div
                className="relative flex justify-center lg:justify-end animate-scale-in stagger-2"
                aria-hidden="true"
              >
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
                </div>

                {/* Double-bezel frame */}
                <div className="relative z-10 w-full max-w-[530px]">
                  {/* Outer bezel */}
                  <div className="rounded-[20px] bg-[oklch(0.13_0.02_185)] border border-white/12 p-[3px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)]">
                    {/* Inner bezel */}
                    <div className="rounded-[18px] bg-[oklch(0.16_0.025_185)] border border-white/8 overflow-hidden">
                      {/* Browser chrome */}
                      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/6 bg-[oklch(0.14_0.02_185)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.65_0.2_27)]" />
                        <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.75_0.18_80)]" />
                        <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.72_0.2_140)]" />
                        <div className="ml-3 flex-1 h-4 rounded-sm bg-white/5 max-w-[200px] flex items-center px-2">
                          <span className="text-[9px] text-white/25 font-mono">mangui.com.ar/inicio</span>
                        </div>
                      </div>

                      {/* Dashboard */}
                      <div className="p-4 space-y-3">
                        {/* App nav row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Image src="/logo-square.png" alt="" width={22} height={22} className="rounded-md" />
                            <span className="text-white/75 text-xs font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                              mangui
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {["Inicio", "Movimientos", "Cuentas"].map((item) => (
                              <span key={item} className="text-[9px] text-white/30">{item}</span>
                            ))}
                          </div>
                        </div>

                        {/* Balance hero card */}
                        <div className="rounded-xl bg-primary/18 border border-primary/12 px-4 py-3">
                          <p className="text-[10px] text-white/45 font-medium mb-0.5">Balance total</p>
                          <p
                            className="text-white text-[26px] tabular-nums font-bold leading-none"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            $1.450.789
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-primary font-semibold">+8,4% este mes</span>
                            <span className="text-[10px] text-white/30">·</span>
                            <span className="text-[10px] text-white/40">ARS + USD consolidado</span>
                          </div>
                        </div>

                        {/* ARS / USD split */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-white/5 border border-white/6 px-3 py-2.5">
                            <p className="text-[9px] text-white/35 mb-1">Pesos</p>
                            <p className="text-white text-sm tabular-nums font-bold">$1.215.000</p>
                            <p className="text-[8px] text-white/25 mt-0.5">3 cuentas</p>
                          </div>
                          <div className="rounded-lg bg-accent/10 border border-accent/12 px-3 py-2.5">
                            <p className="text-[9px] text-white/35 mb-1">Dólares</p>
                            <p
                              className="text-sm tabular-nums font-bold"
                              style={{ color: "oklch(0.73 0.21 47.6)" }}
                            >
                              U$D 680
                            </p>
                            <p className="text-[8px] text-white/25 mt-0.5">Blue · MEP</p>
                          </div>
                        </div>

                        {/* Sparkline */}
                        <div className="rounded-lg bg-white/4 px-3 py-2.5 h-14 flex items-end gap-0.5 overflow-hidden">
                          {[32,48,38,62,50,74,60,88,70,85,68,92,78,95].map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-sm"
                              style={{
                                height: `${h}%`,
                                background:
                                  i > 9
                                    ? "oklch(0.748 0.219 131.7 / 0.85)"
                                    : "oklch(0.748 0.219 131.7 / 0.25)",
                              }}
                            />
                          ))}
                        </div>

                        {/* Recent movements */}
                        <div className="space-y-1">
                          {[
                            { label: "Supermercado Día", cat: "Mercado", amt: "-$18.400", neg: true },
                            { label: "Sueldo junio", cat: "Ingresos", amt: "+$890.000", neg: false },
                            { label: "Cuota 3/12 · Visa", cat: "Tarjeta", amt: "-$6.800", neg: true },
                          ].map((tx) => (
                            <div key={tx.label} className="flex items-center justify-between py-0.5">
                              <div>
                                <p className="text-[11px] text-white/55 font-medium">{tx.label}</p>
                                <p className="text-[9px] text-white/25">{tx.cat}</p>
                              </div>
                              <span
                                className={cn(
                                  "text-[11px] font-semibold tabular-nums",
                                  tx.neg ? "text-red-400/80" : "text-primary"
                                )}
                              >
                                {tx.amt}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Laptop stand */}
                  <div className="mx-auto w-[58%] h-2 bg-[oklch(0.20_0.02_185)] rounded-b-md border-x border-b border-white/6" />
                  <div className="mx-auto w-[68%] h-1 bg-[oklch(0.18_0.02_185)] rounded-b-lg" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ FEATURES BENTO ═══════════════════════════════════ */}
        <section id="funciones" className="py-24 md:py-32 bg-black/25 backdrop-blur-[1px]">
          <div className="container mx-auto px-5 max-w-6xl">
            <div className="mb-14 max-w-lg">
              <h2
                className="text-foreground leading-tight tracking-tight text-wrap-balance"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.7rem,4vw,2.5rem)",
                  letterSpacing: "-0.025em",
                }}
              >
                Todo lo que necesitás
                <br />
                para manejar tu plata.
              </h2>
            </div>

            {/* Asymmetric bento grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" style={{ gridAutoFlow: "dense" }}>
              {/* Large: Multimoneda — 2 cols */}
              <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-5 hover:border-primary/30 transition-colors duration-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3
                      className="text-base font-bold text-foreground mb-1"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Multimoneda real
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[36ch]">
                      Registrá gastos en pesos y dólares. Conversión automática con Blue, MEP y CCL — siempre en tu tipo de cambio, no en el oficial.
                    </p>
                  </div>
                  {/* Toggle pill */}
                  <div className="flex-shrink-0 flex items-center gap-2 bg-primary/10 border border-primary/15 rounded-full px-3 py-1.5">
                    <span className="text-xs font-bold text-primary">ARS</span>
                    <div className="w-8 h-4 rounded-full bg-primary/80 flex items-center justify-end pr-0.5 flex-shrink-0">
                      <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">USD</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "ARS", val: "$1.215.000", sub: "3 cuentas", accent: false },
                    { label: "USD Blue", val: "U$D 320", sub: "× $1.290", accent: true },
                    { label: "USD MEP", val: "U$D 218", sub: "× $1.271", accent: true },
                    { label: "USD CCL", val: "U$D 142", sub: "× $1.289", accent: true },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        "rounded-xl px-3 py-2.5",
                        item.accent
                          ? "bg-accent/8 border border-accent/12"
                          : "bg-muted/60"
                      )}
                    >
                      <p className="text-[10px] text-muted-foreground font-medium mb-1">{item.label}</p>
                      <p
                        className={cn(
                          "text-sm font-bold tabular-nums leading-tight",
                          item.accent ? "text-accent" : "text-foreground"
                        )}
                      >
                        {item.val}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{item.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tarjetas y cuotas */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-4 hover:border-primary/30 transition-colors duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-4 w-4 text-accent" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Tarjetas y cuotas</h3>
                    <p className="text-[10px] text-muted-foreground">Ciclo de resumen incluido</p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/40 overflow-hidden border border-border/40">
                  <div className="grid grid-cols-3 text-[9px] font-semibold text-muted-foreground px-3 py-1.5 border-b border-border/40 uppercase tracking-wide">
                    <span>Tarjeta</span>
                    <span>Cuota</span>
                    <span className="text-right">Monto</span>
                  </div>
                  {[
                    { tipo: "Visa Galicia", cuota: "3/12", monto: "$6.800" },
                    { tipo: "Mastercard", cuota: "1/6", monto: "$12.400" },
                    { tipo: "MODO", cuota: "Débito", monto: "$8.300" },
                  ].map((row) => (
                    <div
                      key={row.tipo}
                      className="grid grid-cols-3 text-[10px] text-muted-foreground px-3 py-1.5 border-b border-border/20 last:border-0"
                    >
                      <span className="font-medium text-foreground truncate">{row.tipo}</span>
                      <span className="text-primary font-semibold">{row.cuota}</span>
                      <span className="text-right tabular-nums">{row.monto}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Fecha de cierre y vencimiento por tarjeta. Cuotas que quedan, cuotas pagas.
                </p>
              </div>

              {/* Presupuestos y metas */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-4 hover:border-primary/30 transition-colors duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Target className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Presupuestos y metas</h3>
                    <p className="text-[10px] text-muted-foreground">Metas en ARS o USD</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { label: "Supermercado", pct: 68, limit: "$80.000", color: "var(--color-primary)" },
                    { label: "Ocio", pct: 35, limit: "$30.000", color: "var(--color-accent)" },
                    { label: "Meta ahorro", pct: 82, limit: "U$D 500", color: "var(--color-primary)" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                        <span className="font-medium text-foreground">{item.label}</span>
                        <span className="tabular-nums">{item.pct}% · {item.limit}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.pct}%`, background: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recurrentes */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-4 hover:border-primary/30 transition-colors duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <RefreshCcw className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Recurrentes y reglas</h3>
                    <p className="text-[10px] text-muted-foreground">Clasificación automática</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { label: "Sueldo", amt: "+$890.000", freq: "Mensual", pos: true },
                    { label: "Alquiler", amt: "-$295.000", freq: "1° del mes", pos: false },
                    { label: "Netflix", amt: "-$5.800", freq: "Mensual", pos: false },
                    { label: "Seguro auto", amt: "-$42.000", freq: "Mensual", pos: false },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-0.5">
                      <div>
                        <p className="text-[11px] font-medium text-foreground">{item.label}</p>
                        <p className="text-[9px] text-muted-foreground">{item.freq}</p>
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-bold tabular-nums",
                          item.pos ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {item.amt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PWA */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-4 hover:border-primary/30 transition-colors duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Instalable y offline</h3>
                    <p className="text-[10px] text-muted-foreground">PWA · Sin App Store</p>
                  </div>
                </div>

                <div className="rounded-xl bg-muted/40 border border-border/40 flex items-center gap-3 px-4 py-3">
                  <Download className="h-5 w-5 text-primary flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Instalá desde el navegador</p>
                    <p className="text-[10px] text-muted-foreground">Android · iOS · Desktop</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Consultá tus finanzas sin señal. Funciona sin conexión, sincroniza al volver.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══ MANGUITO IA ══════════════════════════════════════ */}
        <section id="manguito" className="relative z-10 py-24 md:py-32">
          <div className="container mx-auto px-5 max-w-6xl">
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-14 lg:gap-20 items-center">
              {/* Left: copy */}
              <div className="flex flex-col gap-6">
                <div className="inline-flex items-center gap-2 w-fit">
                  <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-accent" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-bold text-accent">Manguito IA</span>
                </div>

                <h2
                  className="text-foreground leading-tight tracking-tight text-wrap-balance"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.7rem,4vw,2.5rem)",
                    letterSpacing: "-0.025em",
                  }}
                >
                  Preguntale a Manguito.
                  <br />
                  Sobre tus datos.
                </h2>

                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed max-w-[40ch]">
                  <p>
                    Manguito conoce tus gastos, tus cuentas y tu historial. Preguntale en español, sin formularios, sin categorías.
                  </p>
                  <p>
                    También cargás gastos hablando: "gasté 3500 en el kiosco" y listo.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "gap-1.5 font-semibold press-effect"
                    )}
                  >
                    Crear cuenta
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <span className="text-xs text-muted-foreground">Incluido, sin costo adicional</span>
                </div>
              </div>

              {/* Right: chat mockup */}
              <div aria-hidden="true">
                <div className="rounded-2xl bg-[oklch(0.14_0.025_185)] border border-white/8 shadow-[0_24px_48px_-8px_rgba(0,0,0,0.4)] overflow-hidden">
                  {/* Chat header */}
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/8 bg-[oklch(0.12_0.02_185)]">
                    <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm">🥭</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white/80">Manguito</p>
                      <p className="text-[9px] text-white/35">Tu asistente financiero</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-[9px] text-white/35">en línea</span>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="p-4 space-y-3">
                    {/* User message */}
                    <div className="flex justify-end">
                      <div className="bg-primary/20 border border-primary/15 rounded-2xl rounded-tr-sm px-3.5 py-2 max-w-[75%]">
                        <p className="text-[12px] text-white/80">¿Cuánto gasté este mes en supermercado?</p>
                      </div>
                    </div>

                    {/* Manguito reply */}
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[11px]">🥭</span>
                      </div>
                      <div className="bg-white/5 border border-white/8 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[80%]">
                        <p className="text-[12px] text-white/70 leading-relaxed">
                          Este mes llevás{" "}
                          <span className="text-white font-semibold tabular-nums">$54.200</span>{" "}
                          en supermercados: Día, Carrefour y Coto. El mes pasado fueron{" "}
                          <span className="text-primary font-semibold tabular-nums">$48.900</span>.
                        </p>
                      </div>
                    </div>

                    {/* User message 2 */}
                    <div className="flex justify-end">
                      <div className="bg-primary/20 border border-primary/15 rounded-2xl rounded-tr-sm px-3.5 py-2 max-w-[75%]">
                        <p className="text-[12px] text-white/80">Cargá 3500 en el kiosco</p>
                      </div>
                    </div>

                    {/* Manguito reply 2 */}
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[11px]">🥭</span>
                      </div>
                      <div className="bg-white/5 border border-white/8 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                        <p className="text-[12px] text-white/70 leading-relaxed">
                          Listo. Registré <span className="text-white font-semibold">-$3.500</span> en{" "}
                          <span className="text-white/80">Almacén / Kiosco</span>, hoy 6 de junio.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-6 rounded-lg bg-primary/15 border border-primary/20 flex items-center px-2.5">
                            <span className="text-[10px] text-primary font-semibold">Confirmar</span>
                          </div>
                          <div className="flex-1 h-6 rounded-lg bg-white/5 flex items-center px-2.5">
                            <span className="text-[10px] text-white/40">Editar</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick input */}
                    <div className="mt-2 flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2">
                      <Zap className="h-3.5 w-3.5 text-accent flex-shrink-0" aria-hidden="true" />
                      <span className="text-[11px] text-white/25 italic">Preguntá o cargá un gasto...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ ARGENTINA DIFFERENTIATORS ════════════════════════ */}
        <section className="bg-black/35 backdrop-blur-[1px] py-24 md:py-32">
          <div className="container mx-auto px-5 max-w-6xl">
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-14 lg:gap-20 items-center">
              {/* Left: copy */}
              <div className="flex flex-col gap-6">
                <h2
                  className="text-white leading-tight tracking-tight text-wrap-balance"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.7rem,4vw,2.5rem)",
                    letterSpacing: "-0.025em",
                  }}
                >
                  Hecha para la realidad
                  <br />
                  argentina.
                </h2>

                <div className="space-y-5 text-sm text-white/55 leading-relaxed max-w-[36ch]">
                  <p>
                    Tres tipos de dólar. Cuotas que se actualizan. Inflación que come el poder adquisitivo semana a semana. El resto de las apps los ignoran.
                  </p>
                  <p>
                    mangui entiende todo eso porque fue construido acá.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants(),
                      "inline-flex items-center justify-center gap-2 h-11 px-6 text-sm font-semibold press-effect"
                    )}
                  >
                    Crear cuenta
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <DemoCTA variant="outline-dark" />
                </div>
              </div>

              {/* Right: feature cards */}
              <div className="flex flex-col gap-4">
                {/* Cotizaciones */}
                <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white">Cotizaciones del dólar</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                      <span className="text-[10px] text-white/35">Tiempo real</span>
                    </div>
                  </div>
                  <div className="divide-y divide-white/6">
                    {(
                      [
                        { key: "blue" as const, tipo: "Blue", highlight: true },
                        { key: "mep" as const, tipo: "MEP", highlight: false },
                        { key: "ccl" as const, tipo: "CCL", highlight: false },
                        { key: "oficial" as const, tipo: "Oficial", highlight: false },
                      ] satisfies { key: keyof RatesMap; tipo: string; highlight: boolean }[]
                    )
                      .filter(({ key }) => dolarRates[key] !== undefined)
                      .map(({ key, tipo, highlight }) => {
                        const rate = dolarRates[key]!
                        return (
                          <div key={tipo} className="flex justify-between py-2.5 text-xs">
                            <span
                              className={cn(
                                "font-semibold",
                                highlight ? "text-primary" : "text-white/70"
                              )}
                            >
                              {tipo}
                            </span>
                            <div className="flex gap-5 tabular-nums">
                              <span className="text-white/35">${formatRate(rate.buy)}</span>
                              <span className="text-white/70 font-semibold">${formatRate(rate.sell)}</span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* Ciclo resumen + cuotas */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                    <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
                      <CreditCard className="h-4 w-4 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="text-xs font-bold text-white mb-2">Ciclo de resumen</h3>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-white/40">Cierre</span>
                        <span className="text-white/65 font-medium">10 jun</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-white/40">Vencimiento</span>
                        <span className="text-white/65 font-medium">28 jun</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-white/40">A pagar</span>
                        <span className="text-primary font-bold tabular-nums">$124.800</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                    <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center mb-3">
                      <BarChart3 className="h-4 w-4 text-accent" aria-hidden="true" />
                    </div>
                    <h3 className="text-xs font-bold text-white mb-2">Inflación en contexto</h3>
                    <div className="space-y-1">
                      <p className="text-[10px] text-white/40">Hace 12 meses gastabas</p>
                      <p className="text-xs text-white/60 tabular-nums font-medium">$48.900 en super</p>
                      <p className="text-[10px] text-white/40">Hoy equivale a</p>
                      <p className="text-xs text-accent font-bold tabular-nums">$107.000</p>
                    </div>
                  </div>
                </div>

                {/* Cuotas en curso */}
                <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-white">Cuotas en curso</h3>
                    <TrendingUp className="h-3.5 w-3.5 text-white/30" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: "iPhone 15 · Visa", cuotas: "5/12", monto: "$28.400" },
                      { label: "Smart TV · Master", cuotas: "3/6", monto: "$18.700" },
                      { label: "Vuelo BUE-MDP", cuotas: "2/3", monto: "$42.000" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between py-0.5">
                        <div>
                          <p className="text-[11px] text-white/60 font-medium">{item.label}</p>
                          <p className="text-[9px] text-white/30">Cuota {item.cuotas}</p>
                        </div>
                        <span className="text-[11px] text-white/55 font-semibold tabular-nums">{item.monto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ PRODUCT SHOWCASE ═════════════════════════════════ */}
        <section className="relative z-10 py-24 md:py-32">
          <div className="container mx-auto px-5 max-w-6xl">
            <div className="grid lg:grid-cols-[1fr_1.4fr] gap-14 lg:gap-20 items-center">
              {/* Left */}
              <div className="flex flex-col gap-6">
                <h2
                  className="text-foreground leading-tight tracking-tight text-wrap-balance"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.7rem,4vw,2.5rem)",
                    letterSpacing: "-0.025em",
                  }}
                >
                  El dashboard que
                  <br />
                  realmente querías.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[34ch]">
                  Balances por cuenta, movimientos con categoría, gráficos de gastos en el tiempo. Todo en un vistazo.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants(),
                      "inline-flex items-center justify-center gap-2 h-11 px-6 text-sm font-semibold press-effect"
                    )}
                  >
                    Crear cuenta
                  </Link>
                  <DemoCTA variant="outline-dark" />
                </div>
              </div>

              {/* Right: bigger mockup */}
              <div className="relative" aria-hidden="true">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-96 h-64 rounded-full bg-primary/8 blur-3xl" />
                </div>
                {/* Double-bezel */}
                <div className="relative z-10 rounded-[20px] bg-[oklch(0.13_0.02_185)] border border-white/10 p-[3px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)]">
                  <div className="rounded-[18px] bg-[oklch(0.16_0.025_185)] border border-white/6 overflow-hidden">
                    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5 bg-[oklch(0.13_0.02_185)]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.65_0.2_27)]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.75_0.18_80)]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.72_0.2_140)]" />
                      <div className="ml-3 h-4 rounded-sm bg-white/4 w-32 flex items-center px-2">
                        <span className="text-[9px] text-white/20 font-mono">mangui.com.ar/inicio</span>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Image src="/logo-square.png" alt="" width={18} height={18} className="rounded-md" />
                          <span className="text-white/65 text-[11px] font-bold" style={{ fontFamily: "var(--font-display)" }}>mangui</span>
                        </div>
                        <div className="flex gap-3">
                          {["Inicio", "Mov.", "Cuentas", "Stats"].map((item) => (
                            <span key={item} className="text-[9px] text-white/25">{item}</span>
                          ))}
                        </div>
                      </div>

                      {/* Balance */}
                      <div>
                        <p className="text-white/35 text-[10px] mb-0.5">Saldo total</p>
                        <p
                          className="text-white text-3xl tabular-nums font-bold"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          $1.450.789
                        </p>
                        <p className="text-[10px] text-primary font-semibold mt-1">+8,4% este mes · inflación: +105%</p>
                      </div>

                      {/* Chart + donut */}
                      <div className="grid grid-cols-[2fr_1fr] gap-3">
                        <div className="rounded-xl bg-white/4 p-3 h-[88px] flex items-end gap-0.5 overflow-hidden">
                          {[28,42,35,58,48,74,60,80,65,85,72,92,78,96].map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-sm"
                              style={{
                                height: `${h}%`,
                                background:
                                  i > 11
                                    ? "oklch(0.748 0.219 131.7 / 0.9)"
                                    : "oklch(0.748 0.219 131.7 / 0.2)",
                              }}
                            />
                          ))}
                        </div>
                        <div className="rounded-xl bg-white/4 p-3 h-[88px] flex flex-col items-center justify-center gap-1.5">
                          <div
                            className="w-12 h-12 rounded-full border-[5px] border-primary/50"
                            style={{ borderRightColor: "oklch(0.714 0.213 47.6 / 0.55)", borderTopColor: "oklch(0.714 0.213 47.6 / 0.3)" }}
                          />
                          <p className="text-[9px] text-white/25">Categorías</p>
                        </div>
                      </div>

                      {/* Movements */}
                      <div className="space-y-1.5">
                        {[
                          { label: "Almacén Central", cat: "Mercado", amt: "-$3.200", neg: true },
                          { label: "Sueldo junio", cat: "Ingresos", amt: "+$890.000", neg: false },
                          { label: "Cuota Visa 3/12", cat: "Tarjeta", amt: "-$28.400", neg: true },
                          { label: "Spotify", cat: "Suscripción", amt: "-$5.800", neg: true },
                        ].map((tx) => (
                          <div key={tx.label} className="flex items-center justify-between py-0.5">
                            <div>
                              <p className="text-[11px] text-white/60 font-medium">{tx.label}</p>
                              <p className="text-[9px] text-white/25">{tx.cat}</p>
                            </div>
                            <span
                              className={cn(
                                "text-[11px] font-semibold tabular-nums",
                                tx.neg ? "text-red-400/70" : "text-primary"
                              )}
                            >
                              {tx.amt}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mx-auto w-[52%] h-2 bg-[oklch(0.18_0.02_185)] rounded-b-md border-x border-b border-white/5" />
                <div className="mx-auto w-[62%] h-1 bg-[oklch(0.15_0.02_185)] rounded-b-lg" />
              </div>
            </div>
          </div>
        </section>

        {/* ══ PRECIOS ══════════════════════════════════════════ */}
        <section id="precios" className="py-24 md:py-32 bg-black/25 backdrop-blur-[1px]">
          <div className="container mx-auto px-5 max-w-6xl">
            <div className="mb-14 max-w-lg">
              <h2
                className="text-foreground leading-tight tracking-tight text-wrap-balance"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.7rem,4vw,2.5rem)",
                  letterSpacing: "-0.025em",
                }}
              >
                Simple y sin sorpresas.
              </h2>
              <p className="text-sm text-muted-foreground mt-4 leading-relaxed max-w-[42ch]">
                Empezá gratis. Mejorá cuando quieras. Cancelás cuando quieras.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Free card */}
              <div className="rounded-2xl border border-border/60 bg-card p-7 flex flex-col gap-6">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Free</p>
                  <p
                    className="text-4xl font-bold text-foreground tabular-nums"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    $0
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">para siempre</p>
                </div>

                <ul className="space-y-2.5 flex-1">
                  {[
                    "1 cuenta",
                    "1 presupuesto",
                    "1 meta",
                    "3 recurrentes",
                    "IA hasta 10 consultas/día",
                    "Movimientos ilimitados",
                    "Cuotas y transferencias",
                    "Estadísticas",
                    "Multimoneda (ARS + USD)",
                  ].map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                      {feat}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full font-semibold press-effect h-11 text-sm"
                  )}
                >
                  Crear cuenta gratis
                </Link>
              </div>

              {/* Premium card — client island with Mensual/Anual toggle */}
              <PricingToggle />
            </div>
          </div>
        </section>

        {/* ══ FINAL CTA ═══════════════════════════════════════ */}
        <section className="bg-black/40 backdrop-blur-[2px]">
          <div className="container mx-auto px-5 max-w-3xl py-24 md:py-32 text-center space-y-7">
            <h2
              className="text-white leading-tight tracking-tight text-wrap-balance"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.9rem,4.5vw,3rem)",
                letterSpacing: "-0.03em",
              }}
            >
              ¿Listo para tomar el control?
            </h2>
            <p className="text-white/50 text-base max-w-[38ch] mx-auto">
              Empezá con tu cuenta o explorá la demo — sin registros previos.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "gap-2 font-semibold press-effect h-11 px-8 text-sm shadow-xl shadow-primary/30"
                )}
              >
                Crear cuenta
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 h-11 px-8 text-sm font-semibold rounded-lg border border-white/20 text-white/75 hover:bg-white/8 hover:text-white transition-colors duration-150 press-effect focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full sm:w-auto"
              >
                Ver demo
              </Link>
            </div>
            <p className="text-xs text-white/30">
              "Ver demo" abre una cuenta de ejemplo, solo lectura.
            </p>
          </div>
        </section>
      </main>

      {/* ══ FOOTER ═══════════════════════════════════════════ */}
      <footer className="border-t border-white/10 bg-black/40 backdrop-blur-[2px] py-10">
        <div className="container mx-auto px-5 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-[1.8fr_1fr_1fr] gap-8">
            {/* Brand column */}
            <div className="flex flex-col gap-4">
              <Link
                href="/"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded w-fit"
              >
                <BrandLockup size={26} />
              </Link>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[24ch]">
                Finanzas personales para la realidad argentina.
              </p>
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} mangui
              </p>
            </div>

            {/* Producto */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-foreground">Producto</p>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="#funciones"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Funciones
                  </Link>
                </li>
                <li>
                  <Link
                    href="#precios"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Precios
                  </Link>
                </li>
                <li>
                  <Link
                    href="/calculadoras"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Calculadoras
                  </Link>
                </li>
                <li>
                  <Link
                    href="/register"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Crear cuenta
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Ingresar
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-foreground">Legal</p>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/privacidad"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Privacidad
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terminos"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Términos
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
