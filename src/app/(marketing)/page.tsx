import Image from "next/image";
import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import {
  ArrowRight,
  Shield,
  Download,
  CreditCard,
  RefreshCcw,
  Target,
  Zap,
  Smartphone,
  Globe,
  TrendingUp,
  ChevronRight,
  Play,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─── Data ──────────────────────────────────────────────────── */

const footerLinks = {
  Producto: ["Funciones", "Changelog"],
  Soporte: ["Contacto", "Centro de Ayuda", "Estado del servicio"],
  Legal: ["Privacidad", "Términos"],
};

/* ─── Page ───────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* ══ NAV ══════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-border/50 glass bg-background/85">
        <div className="container mx-auto px-5 h-16 flex items-center justify-between max-w-6xl">
          {/* Logo lockup */}
          <Link href="/" className="flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            <BrandLockup size={28} />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground" aria-label="Navegación principal">
            <Link href="#features" className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1">
              Funciones
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex font-medium")}
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
        <section className="relative overflow-hidden pt-16 pb-24 md:pt-20 md:pb-32">
          {/* Background blobs — lime + orange, warm */}
          <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
            <div className="absolute top-0 right-0 w-[520px] h-[520px] rounded-full bg-primary/12 blur-[96px] translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/8 blur-[72px] -translate-x-1/4 translate-y-1/4" />
          </div>

          <div className="container mx-auto px-5 max-w-6xl">
            <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-center">
              {/* ── Left: copy ── */}
              <div className="flex flex-col gap-6 animate-fade-up">
                {/* Eyebrow — only one for the entire hero section */}
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary w-fit">
                  <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                  Hecho en Argentina
                </div>

                <h1
                  className="leading-[1.1] tracking-tight text-foreground"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(2rem,5vw,3.25rem)",
                  }}
                >
                  Controlá tu plata
                  <br />
                  en pesos y{" "}
                  <span className="text-accent">dólares</span>
                </h1>

                <p className="text-base text-muted-foreground leading-relaxed max-w-[42ch]">
                  La app de finanzas personales para argentinos que quieren entender cada peso.
                </p>

                {/* CTAs — stacked on mobile, row on sm+ */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "gap-2 font-semibold shadow-md shadow-primary/20 press-effect h-11 px-6 text-sm"
                    )}
                  >
                    Crear cuenta gratis
                  </Link>
                  <Link
                    href="/login"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "gap-2 font-medium h-11 px-5 text-sm press-effect"
                    )}
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    Ver demo
                  </Link>
                </div>

                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors duration-150 w-fit group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Instalar app — sin App Store
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-150" aria-hidden="true" />
                </Link>
              </div>

              {/* ── Right: device mockup (laptop frame) ── */}
              <div className="relative flex justify-center lg:justify-end animate-scale-in stagger-2" aria-hidden="true">
                {/* Subtle glow behind the device */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-72 h-72 rounded-full bg-primary/10 blur-3xl" />
                </div>

                {/* Laptop shell */}
                <div className="relative z-10 w-full max-w-[520px]">
                  {/* Screen bezel */}
                  <div className="relative rounded-2xl bg-[oklch(0.18_0.025_185)] border border-white/10 shadow-[0_24px_48px_-8px_rgba(0,0,0,0.35)] overflow-hidden">
                    {/* Fake browser bar */}
                    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/8 bg-[oklch(0.16_0.025_185)]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.65_0.2_27)]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.75_0.18_80)]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.72_0.2_140)]" />
                      <div className="ml-3 flex-1 h-4 rounded-sm bg-white/5 max-w-[180px] flex items-center px-2">
                        <span className="text-[9px] text-white/30 font-mono">mangui.app</span>
                      </div>
                    </div>

                    {/* Dashboard content */}
                    <div className="p-4 space-y-3">
                      {/* Dashboard header row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Image
                            src="/logo.png"
                            alt=""
                            width={22}
                            height={22}
                            className="rounded-md"
                          />
                          <span className="text-white/80 text-xs font-semibold" style={{ fontFamily: "var(--font-display)" }}>mangui</span>
                        </div>
                        <div className="text-[10px] text-white/30">Mayo 2026</div>
                      </div>

                      {/* Balance hero */}
                      <div className="rounded-xl bg-primary/20 border border-primary/15 px-4 py-3">
                        <p className="text-[10px] text-white/50 font-medium mb-0.5">Balance total</p>
                        <p
                          className="text-white text-2xl tabular-nums font-bold leading-none"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          $1.450.789,50
                        </p>
                        <p className="text-[10px] text-primary font-medium mt-1">+8.4% este mes</p>
                      </div>

                      {/* 2-col mini stats */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-white/5 px-3 py-2">
                          <p className="text-[9px] text-white/40 mb-0.5">ARS</p>
                          <p className="text-white text-sm tabular-nums font-semibold">$1.215.000</p>
                        </div>
                        <div className="rounded-lg bg-white/5 px-3 py-2">
                          <p className="text-[9px] text-white/40 mb-0.5">USD</p>
                          <p className="text-sm tabular-nums font-semibold" style={{ color: "var(--color-accent, #F97316)" }}>U$D 680</p>
                        </div>
                      </div>

                      {/* Sparkline placeholder */}
                      <div className="rounded-lg bg-white/4 px-3 py-2.5 h-14 flex items-end gap-0.5 overflow-hidden">
                        {[35, 55, 42, 68, 50, 78, 62, 90, 75, 88, 72, 95].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-sm opacity-70"
                            style={{
                              height: `${h}%`,
                              background: i > 8
                                ? "var(--color-primary, #84CC16)"
                                : "oklch(0.748 0.219 131.7 / 0.3)",
                            }}
                          />
                        ))}
                      </div>

                      {/* Recent movements */}
                      <div className="space-y-1.5">
                        {[
                          { label: "Supermercado Día", amt: "-$18.400", neg: true },
                          { label: "Sueldo", amt: "+$850.000", neg: false },
                          { label: "Netflix", amt: "-$5.200", neg: true },
                        ].map((tx) => (
                          <div key={tx.label} className="flex justify-between items-center py-0.5">
                            <span className="text-[11px] text-white/50">{tx.label}</span>
                            <span
                              className={cn(
                                "text-[11px] font-semibold tabular-nums",
                                tx.neg ? "text-red-400" : "text-primary"
                              )}
                            >
                              {tx.amt}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Laptop base/stand */}
                  <div className="mx-auto w-[60%] h-2 bg-[oklch(0.22_0.02_185)] rounded-b-md border border-white/8" />
                  <div className="mx-auto w-[70%] h-1 bg-[oklch(0.2_0.02_185)] rounded-b-lg" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ FEATURES BENTO ═══════════════════════════════════ */}
        <section id="features" className="py-24 md:py-32 bg-muted/20">
          <div className="container mx-auto px-5 max-w-6xl">
            {/* Heading — left-aligned, no eyebrow */}
            <div className="mb-12 max-w-xl">
              <h2
                className="text-foreground leading-tight tracking-tight"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.6rem,4vw,2.4rem)",
                }}
              >
                Todo lo que necesitás
                <br />
                para manejar tu plata.
              </h2>
            </div>

            {/* Asymmetric bento — not 3-equal columns */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              style={{ gridAutoFlow: "dense" }}
            >
              {/* Large card: Multimoneda (spans 2 cols on lg) */}
              <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-4 hover:border-primary/30 transition-colors duration-200 hover:-translate-y-0.5 transition-transform">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Multimoneda</p>
                    <h3 className="text-base font-semibold text-foreground">ARS y USD</h3>
                  </div>
                  {/* Toggle UI illustration */}
                  <div className="flex items-center gap-2 bg-primary/10 rounded-full px-3 py-1.5">
                    <span className="text-xs font-semibold text-primary">ARS</span>
                    <div className="w-8 h-4 rounded-full bg-primary flex items-center justify-end pr-0.5">
                      <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">USD</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/60 px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-medium mb-0.5">ARS</p>
                    <p className="text-lg font-bold tabular-nums">$2.450.123,50</p>
                  </div>
                  <div className="rounded-xl bg-accent/10 border border-accent/15 px-4 py-3">
                    <p className="text-[11px] text-muted-foreground font-medium mb-0.5">USD</p>
                    <p className="text-lg font-bold tabular-nums text-accent">1.876,45 USD</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  Registrá gastos en pesos y dólares. Conversión automática con tipo de cambio Blue, MEP y oficial.
                </p>
              </div>

              {/* Card: Tarjetas y cuotas */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-3 hover:border-primary/30 transition-colors duration-200 hover:-translate-y-0.5 transition-transform">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-4 w-4 text-accent" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Tarjetas y cuotas</h3>
                </div>
                {/* Mini table */}
                <div className="rounded-lg bg-muted/40 overflow-hidden">
                  <div className="grid grid-cols-3 gap-0 text-[10px] font-semibold text-muted-foreground px-3 py-1.5 border-b border-border/40">
                    <span>Tipo</span>
                    <span>Fecha</span>
                    <span className="text-right">Monto</span>
                  </div>
                  {[
                    { tipo: "Visa", fecha: "10/06", monto: "$28.400" },
                    { tipo: "Master", fecha: "15/06", monto: "$12.800" },
                    { tipo: "MODO", fecha: "01/07", monto: "$8.300" },
                  ].map((row) => (
                    <div key={row.tipo} className="grid grid-cols-3 gap-0 text-[10px] text-muted-foreground px-3 py-1.5 border-b border-border/25 last:border-0">
                      <span className="font-medium text-foreground">{row.tipo}</span>
                      <span>{row.fecha}</span>
                      <span className="text-right tabular-nums">{row.monto}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Seguí compras en cuotas y resúmenes sin complicaciones.
                </p>
              </div>

              {/* Card: Presupuestos y metas */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-3 hover:border-primary/30 transition-colors duration-200 hover:-translate-y-0.5 transition-transform">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Target className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Presupuestos y metas</h3>
                </div>
                {/* Progress bars */}
                <div className="space-y-2.5">
                  {[
                    { label: "Comida", pct: 72, amt: "$45.000" },
                    { label: "Ocio", pct: 40, amt: "$12.000" },
                    { label: "Ahorro", pct: 85, amt: "$320.000" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{item.label}</span>
                        <span className="tabular-nums">{item.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card: Gastos recurrentes y reglas */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-3 hover:border-primary/30 transition-colors duration-200 hover:-translate-y-0.5 transition-transform">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <RefreshCcw className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Gastos recurrentes y reglas</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Sueldo", amt: "+$850.000", freq: "Mensual" },
                    { label: "Alquiler", amt: "-$280.000", freq: "1° del mes" },
                    { label: "Netflix", amt: "-$5.200", freq: "Mensual" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-0.5">
                      <div>
                        <p className="text-[11px] font-medium text-foreground">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.freq}</p>
                      </div>
                      <span className={cn(
                        "text-[11px] font-semibold tabular-nums",
                        item.amt.startsWith("+") ? "text-success" : "text-destructive"
                      )}>
                        {item.amt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card: Carga rápida */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-3 hover:border-accent/30 transition-colors duration-200 hover:-translate-y-0.5 transition-transform">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-4 w-4 text-accent" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Carga rápida</h3>
                </div>
                {/* Quick-add fake input */}
                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground italic">
                  &ldquo;gasté 5k en el super hoy&rdquo;
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Dictá en lenguaje natural y mangui lo clasifica automáticamente.
                </p>
              </div>

              {/* Card: Funciona offline (PWA) */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col gap-3 hover:border-primary/30 transition-colors duration-200 hover:-translate-y-0.5 transition-transform">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">Funciona offline (PWA)</h3>
                </div>
                <div className="rounded-lg bg-muted/40 flex items-center gap-2.5 px-3 py-2">
                  <Download className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-[11px] font-medium text-foreground">Instalá desde el navegador</p>
                    <p className="text-[10px] text-muted-foreground">Android · iOS · Desktop</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Consultá tus finanzas sin señal. Sincroniza al volver.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══ PRODUCT SHOWCASE (dark section) ═════════════════ */}
        <section className="bg-[oklch(0.14_0.025_185)] py-24 md:py-32">
          <div className="container mx-auto px-5 max-w-6xl">
            <div className="grid lg:grid-cols-[1fr_1.3fr] gap-12 lg:gap-16 items-center">
              {/* Left: copy */}
              <div className="flex flex-col gap-6">
                <h2
                  className="text-white leading-tight tracking-tight"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.7rem,4vw,2.6rem)",
                  }}
                >
                  El dashboard que
                  <br />
                  realmente querías.
                </h2>
                <p className="text-white/60 text-base leading-relaxed max-w-[36ch]">
                  Balances, movimientos, gráficos. Todo en un vistazo, sin ruido.
                </p>
                <div>
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "gap-2 font-semibold press-effect h-11 px-6 text-sm"
                    )}
                  >
                    Empezar gratis
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* Right: dark laptop mockup */}
              <div className="relative" aria-hidden="true">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
                </div>
                <div className="relative z-10 rounded-2xl bg-[oklch(0.12_0.025_185)] border border-white/8 shadow-[0_24px_48px_-8px_rgba(0,0,0,0.5)] overflow-hidden">
                  {/* Browser bar */}
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/6 bg-[oklch(0.10_0.02_185)]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.65_0.2_27)]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.75_0.18_80)]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.72_0.2_140)]" />
                    <div className="ml-3 h-4 rounded-sm bg-white/5 w-28 flex items-center px-2">
                      <span className="text-[9px] text-white/25 font-mono">mangui.app/dashboard</span>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Image src="/logo.png" alt="" width={20} height={20} className="rounded-md" />
                        <span className="text-white/70 text-xs font-semibold" style={{ fontFamily: "var(--font-display)" }}>mangui</span>
                      </div>
                      <div className="flex gap-2">
                        {["Inicio", "Movimientos", "Cuentas"].map((item) => (
                          <span key={item} className="text-[9px] text-white/30 hover:text-white/50">{item}</span>
                        ))}
                      </div>
                    </div>
                    {/* Big balance */}
                    <div>
                      <p className="text-white/40 text-[10px] mb-0.5">Saldo total</p>
                      <p className="text-white text-3xl tabular-nums font-bold" style={{ fontFamily: "var(--font-display)" }}>
                        $ 487.320
                      </p>
                    </div>
                    {/* Charts area */}
                    <div className="grid grid-cols-[2fr_1fr] gap-3">
                      {/* Area chart */}
                      <div className="rounded-xl bg-white/4 p-3 h-24 flex items-end gap-0.5 overflow-hidden">
                        {[30,45,38,60,52,80,68,75,62,88,78,95,82,90].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-sm"
                            style={{
                              height: `${h}%`,
                              background: i > 10
                                ? "oklch(0.748 0.219 131.7 / 0.8)"
                                : "oklch(0.748 0.219 131.7 / 0.25)",
                            }}
                          />
                        ))}
                      </div>
                      {/* Donut placeholder */}
                      <div className="rounded-xl bg-white/4 p-3 h-24 flex flex-col items-center justify-center gap-1">
                        <div className="w-12 h-12 rounded-full border-4 border-primary/60" style={{ borderRightColor: "oklch(0.714 0.213 47.6 / 0.6)" }} />
                        <p className="text-[9px] text-white/30">Categorías</p>
                      </div>
                    </div>
                    {/* Movement rows */}
                    <div className="space-y-1.5">
                      {[
                        { label: "Almacén Central", cat: "Mercado", amt: "-$3.200", neg: true },
                        { label: "Sueldo Mayo", cat: "Ingresos", amt: "+$580.000", neg: false },
                        { label: "Spotify", cat: "Suscripción", amt: "-$2.500", neg: true },
                      ].map((tx) => (
                        <div key={tx.label} className="flex items-center justify-between py-0.5">
                          <div>
                            <p className="text-[11px] text-white/70 font-medium">{tx.label}</p>
                            <p className="text-[9px] text-white/30">{tx.cat}</p>
                          </div>
                          <span className={cn("text-[11px] font-semibold tabular-nums", tx.neg ? "text-red-400" : "text-primary")}>
                            {tx.amt}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Laptop stand */}
                <div className="mx-auto w-[55%] h-2 bg-[oklch(0.16_0.02_185)] rounded-b-md border border-white/5" />
                <div className="mx-auto w-[65%] h-1 bg-[oklch(0.14_0.02_185)] rounded-b-lg" />
              </div>
            </div>
          </div>
        </section>

        {/* ══ ARGENTINA DIFFERENTIATORS ════════════════════════ */}
        <section className="py-24 md:py-32">
          <div className="container mx-auto px-5 max-w-6xl">
            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16 items-start">
              {/* Left: copy */}
              <div className="flex flex-col gap-5 lg:pt-2">
                <h2
                  className="text-foreground leading-tight tracking-tight"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(1.6rem,4vw,2.4rem)",
                  }}
                >
                  Hecha para la realidad
                  <br />
                  argentina.
                </h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">Multidólar: Blue, MEP y CCL</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Seguí en tiempo real las cotizaciones del dólar. Convertí entre distintos tipos de cambio de forma simple y transparente.
                    </p>
                  </div>
                </div>
                <Link
                  href="/register"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "w-fit gap-1.5 font-semibold press-effect mt-2"
                  )}
                >
                  Probar gratis
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              {/* Right: feature cards stacked */}
              <div className="flex flex-col gap-4">
                {/* Cotizaciones dólar */}
                <div className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Cotizaciones dólar</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                      <span className="text-[10px] text-muted-foreground">En vivo</span>
                    </div>
                  </div>
                  <div className="divide-y divide-border/40">
                    {[
                      { tipo: "USD Blue", compra: "$1.285,50", venta: "$1.295,00" },
                      { tipo: "MEP", compra: "$1.271,00", venta: "$1.275,00" },
                      { tipo: "CCL", compra: "$1.289,00", venta: "$1.295,50" },
                      { tipo: "Oficial", compra: "$1.290,00", venta: "$1.300,00" },
                    ].map((row) => (
                      <div key={row.tipo} className="flex justify-between py-2 text-xs">
                        <span className="font-medium text-foreground">{row.tipo}</span>
                        <div className="flex gap-4 tabular-nums text-muted-foreground">
                          <span>{row.compra}</span>
                          <span className="font-semibold text-foreground">{row.venta}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ciclo de resumen + cuotas */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-border/60 bg-card p-4">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <CreditCard className="h-4 w-4 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="text-xs font-semibold text-foreground mb-1">Ciclo de resumen de tarjeta</h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Entendé cuándo cierra y cuándo vence tu tarjeta. Organizá tus pagos y cuotas inteligentemente.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
                    <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
                      <TrendingUp className="h-4 w-4 text-accent" aria-hidden="true" />
                    </div>
                    <h3 className="text-xs font-semibold text-foreground mb-1">Cuotas sin recargo inteligentes</h3>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Cuota 5/12 — $6.400 — Visa Santander
                    </p>
                  </div>
                </div>

                {/* Inflación en contexto */}
                <div className="rounded-2xl border border-border/60 bg-[oklch(0.14_0.025_185)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xs font-semibold text-white mb-1">Inflación en contexto</h3>
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        Hace 4 meses: $920.000 → hoy: $1.047.320
                      </p>
                      <p className="text-[11px] text-primary font-semibold mt-1">+12,5% · +105% inflación</p>
                    </div>
                    {/* Mini sparkline */}
                    <div className="flex items-end gap-0.5 h-10 flex-shrink-0">
                      {[40,55,60,72,68,80,88,95].map((h, i) => (
                        <div
                          key={i}
                          className="w-1.5 rounded-sm bg-primary/50"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ FINAL CTA ════════════════════════════════════════ */}
        <section className="bg-[oklch(0.14_0.025_185)] relative overflow-hidden">
          {/* Brand gradient accent blobs */}
          <div className="absolute inset-0 -z-0 overflow-hidden" aria-hidden="true">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/10 blur-[64px] translate-x-1/4 -translate-y-1/4" />
            <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full bg-accent/10 blur-[48px] translate-y-1/4" />
          </div>

          <div className="relative z-10 container mx-auto px-5 max-w-3xl py-20 md:py-28 text-center space-y-6">
            <h2
              className="text-white leading-tight tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.8rem,4.5vw,2.8rem)",
              }}
            >
              ¿Listo para tomar el control?
            </h2>
            <p className="text-white/60 text-base">
              Empezá gratis. Sin tarjeta. Sin compromiso.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "gap-2 font-semibold press-effect h-11 px-7 text-sm shadow-lg shadow-primary/30"
                )}
              >
                Crear cuenta gratis
              </Link>
              <Link
                href="/login"
                className={cn(
                  "inline-flex items-center justify-center gap-2 h-11 px-7 text-sm font-semibold rounded-lg border border-white/20 text-white/80 hover:bg-white/8 transition-colors duration-150 press-effect focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                Ver demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ══ FOOTER ═══════════════════════════════════════════ */}
      <footer className="border-t border-border/50 bg-card py-12">
        <div className="container mx-auto px-5 max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8">
            {/* Brand column */}
            <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
              <Link href="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded w-fit">
                <BrandLockup size={28} />
              </Link>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[22ch]">
                Finanzas personales<br />para Argentina.
              </p>
              {/* Social icons row */}
              <div className="flex items-center gap-3 mt-1">
                {/* Instagram placeholder */}
                <a
                  href="https://instagram.com/mangui.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram de mangui"
                  className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </a>
                <a
                  href="https://twitter.com/mangui_app"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter/X de mangui"
                  className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Link columns */}
            {Object.entries(footerLinks).map(([section, links]) => (
              <div key={section} className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-foreground">{section}</p>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link}>
                      <Link
                        href="#"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      >
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* 4th column: Developed with love */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-foreground">Desarrollado con</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span aria-label="amor">♥</span> en Argentina
              </p>
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} mangui
              </p>
              <p className="text-xs text-muted-foreground">
                Datos almacenados<br />en tu dispositivo.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
