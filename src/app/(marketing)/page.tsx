import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Globe,
  RefreshCcw,
  Smartphone,
  Zap,
  Target,
  Check,
  Star,
  CreditCard,
  TrendingUp,
  Shield,
  Download,
  ChevronRight,
  BarChart3,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Globe,
    title: "Multimoneda ARS & USD",
    description:
      "Registrá gastos en pesos y dólares. Conversión automática con tipo de cambio real, oficial y MEP.",
    accent: "primary",
  },
  {
    icon: CreditCard,
    title: "Tarjetas y cuotas",
    description:
      "Seguí tus compras en cuotas, resúmenes de tarjeta y vencimientos sin complicaciones.",
    accent: "accent",
  },
  {
    icon: RefreshCcw,
    title: "Gastos recurrentes",
    description:
      "Configurá sueldos, alquileres, servicios y suscripciones. mangui los registra solo.",
    accent: "primary",
  },
  {
    icon: Target,
    title: "Presupuestos y metas",
    description:
      "Fijá límites por categoría y metas de ahorro. Visualizá tu progreso en tiempo real.",
    accent: "accent",
  },
  {
    icon: Zap,
    title: "Quick-add con IA",
    description:
      "Dictá o escribí en lenguaje natural: \"gasté 5k en el super hoy\" y mangui lo clasifica solo.",
    accent: "primary",
  },
  {
    icon: Smartphone,
    title: "PWA — siempre disponible",
    description:
      "Instalala como app en tu celular. Funciona offline para consultas; sincroniza al volver.",
    accent: "accent",
  },
];

const steps = [
  {
    step: "01",
    icon: Wallet,
    title: "Creá tu cuenta",
    description: "Registro gratuito en segundos. Sin tarjeta de crédito.",
  },
  {
    step: "02",
    icon: TrendingUp,
    title: "Conectá tus fuentes",
    description:
      "Importá movimientos o empezá a registrar manualmente con nuestro quick-add.",
  },
  {
    step: "03",
    icon: BarChart3,
    title: "Tomá el control",
    description:
      "Visualizá tu flujo de caja, ajustá presupuestos y alcanzá tus metas.",
  },
];

const plans = [
  {
    name: "Gratis",
    price: "ARS 0",
    period: "para siempre",
    description: "Para empezar a ordenar tus finanzas",
    features: [
      "Hasta 100 transacciones/mes",
      "2 cuentas (ARS + USD)",
      "Presupuestos básicos",
      "Historial 3 meses",
    ],
    cta: "Empezar gratis",
    href: "/register",
    highlight: false,
  },
  {
    name: "Pro",
    price: "ARS 4.990",
    period: "por mes",
    description: "Para quienes toman en serio su plata",
    features: [
      "Transacciones ilimitadas",
      "Cuentas ilimitadas",
      "Quick-add con IA",
      "Historial completo",
      "Exportación CSV/PDF",
      "Alertas y notificaciones",
    ],
    cta: "Comenzar Pro",
    href: "/register",
    highlight: true,
  },
];

const testimonials = [
  {
    name: "Valentina R.",
    role: "Freelancer",
    text: "Por fin una app que entiende la realidad argentina. ARS y USD en un lugar, sin complicaciones.",
  },
  {
    name: "Martín G.",
    role: "Emprendedor",
    text: "Las cuotas y el resumen de tarjeta me salvaron. Ahora sé exactamente qué vence cada mes.",
  },
  {
    name: "Lucía P.",
    role: "Docente",
    text: "El quick-add es un juego de cambio. Anoto un gasto en dos segundos y listo.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-border/40 glass bg-background/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
          <Link href="/" className="flex items-center gap-2.5 press-effect">
            <Image
              src="/logo.png"
              alt="mangui logo"
              width={34}
              height={34}
              className="rounded-xl shadow-sm"
            />
            <span
              className="font-display text-xl tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              mangui
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <Link
              href="#features"
              className="hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Funciones
            </Link>
            <Link
              href="#how"
              className="hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Cómo funciona
            </Link>
            <Link
              href="#pricing"
              className="hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Precios
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "font-medium")}
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5 font-semibold press-effect")}
            >
              Crear cuenta
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-32">
          {/* Background gradient blobs */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/15 blur-[100px] translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[80px] -translate-x-1/4 translate-y-1/4" />
            <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] rounded-full bg-[oklch(0.65_0.15_185)]/8 blur-[60px]" />
          </div>

          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left: copy */}
              <div className="flex flex-col gap-7">
                <div className="animate-fade-up">
                  <Badge className="w-fit bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 gap-1.5 font-medium">
                    <Shield className="h-3 w-3" />
                    Hecho para Argentina
                  </Badge>
                </div>

                <h1
                  className="text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.1] tracking-tight animate-fade-up stagger-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Controlá tu plata
                  <br />
                  en{" "}
                  <span className="text-primary">pesos</span>{" "}
                  y{" "}
                  <span className="text-accent">dólares</span>
                  <br />
                  sin volverte loco
                </h1>

                <p className="text-lg text-muted-foreground leading-relaxed max-w-lg animate-fade-up stagger-2">
                  La app de finanzas personales diseñada para la realidad argentina.
                  Inflación, tipo de cambio, cuotas — mangui lo entiende todo.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 animate-fade-up stagger-3">
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants({ size: "lg" }),
                      "gap-2 font-semibold shadow-lg shadow-primary/25 press-effect text-base h-11 px-6"
                    )}
                  >
                    Crear cuenta gratis
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/login"
                    className={cn(
                      buttonVariants({ size: "lg", variant: "outline" }),
                      "press-effect font-semibold text-base h-11 px-6 gap-2"
                    )}
                  >
                    <Download className="h-4 w-4" />
                    Instalar app
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground animate-fade-up stagger-4">
                  <div className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" />
                    Sin tarjeta de crédito
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" />
                    Gratis para siempre
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-primary" />
                    Funciona offline
                  </div>
                </div>
              </div>

              {/* Right: dashboard mockup */}
              <div className="relative flex justify-center lg:justify-end animate-scale-in stagger-2">
                {/* Glow ring */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
                </div>

                {/* Mock dashboard */}
                <div className="relative z-10 w-full max-w-[360px]">
                  <div className="rounded-3xl border border-border/60 bg-card shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden">
                    {/* Mockup header */}
                    <div className="bg-primary px-5 pt-5 pb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <Image
                            src="/logo.png"
                            alt="mangui"
                            width={28}
                            height={28}
                            className="rounded-lg"
                          />
                          <span
                            className="text-primary-foreground font-semibold text-sm"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            mangui
                          </span>
                        </div>
                        <span className="text-primary-foreground/70 text-xs font-medium bg-primary-foreground/10 px-2 py-0.5 rounded-full">
                          +12% este mes
                        </span>
                      </div>
                      <p className="text-primary-foreground/70 text-xs font-medium mb-1">
                        Balance total
                      </p>
                      <p
                        className="text-primary-foreground text-3xl tabular-nums font-bold"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        $ 2.847.500
                      </p>
                    </div>

                    {/* Mockup body */}
                    <div className="px-5 pt-4 pb-5 space-y-4">
                      {/* Mini balances */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-xl bg-muted/60 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground font-medium mb-0.5">ARS</p>
                          <p className="font-semibold text-sm tabular-nums">$2.487.500</p>
                        </div>
                        <div className="rounded-xl bg-accent/10 px-3 py-2.5">
                          <p className="text-xs text-muted-foreground font-medium mb-0.5">USD</p>
                          <p className="font-semibold text-sm tabular-nums text-accent">U$D 285</p>
                        </div>
                      </div>

                      <Separator className="opacity-50" />

                      {/* Mini transactions */}
                      <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Últimos movimientos
                        </p>
                        {[
                          { label: "Supermercado Coto", amt: "-$ 28.400", positive: false },
                          { label: "Sueldo", amt: "+$ 850.000", positive: true },
                          { label: "Netflix", amt: "-$ 4.900", positive: false },
                        ].map((tx) => (
                          <div key={tx.label} className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{tx.label}</span>
                            <span
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                tx.positive ? "text-success" : "text-destructive"
                              )}
                              style={tx.positive ? { color: "var(--success)" } : undefined}
                            >
                              {tx.amt}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Floating AI badge */}
                  <div className="absolute -bottom-3 -right-3 bg-accent text-accent-foreground rounded-2xl px-3.5 py-2 shadow-lg shadow-accent/30 flex items-center gap-1.5 text-sm font-semibold">
                    <Zap className="h-3.5 w-3.5" />
                    IA incluida
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Social proof bar ── */}
        <section className="border-y border-border/60 bg-muted/20 py-5">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <span className="font-medium">4.9/5 en reseñas</span>
              </div>
              <Separator orientation="vertical" className="h-5 hidden sm:block opacity-40" />
              <span className="font-medium">+2.000 usuarios en lista de espera</span>
              <Separator orientation="vertical" className="h-5 hidden sm:block opacity-40" />
              <div className="flex items-center gap-1.5 font-medium">
                <Shield className="h-4 w-4 text-primary" />
                Construido en Argentina
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-24">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-14 space-y-4">
              <Badge
                variant="outline"
                className="border-primary/30 text-primary font-medium"
              >
                Funciones
              </Badge>
              <h2
                className="text-3xl md:text-4xl lg:text-5xl tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Todo lo que necesitás,
                <br />
                <span className="text-primary">nada que no usarías</span>
              </h2>
              <p className="text-muted-foreground max-w-sm mx-auto text-base">
                Diseñado específicamente para la realidad financiera argentina.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((feature, i) => (
                <Card
                  key={feature.title}
                  className={cn(
                    "group border-border/60 hover:border-primary/30 transition-all duration-250 hover:shadow-lg hover:shadow-primary/8 press-effect animate-fade-up",
                    `stagger-${(i % 5) + 1}`
                  )}
                >
                  <CardHeader className="pb-3">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-2xl flex items-center justify-center mb-3 transition-all duration-200 group-hover:scale-110",
                        feature.accent === "primary"
                          ? "bg-primary/10 group-hover:bg-primary/20"
                          : "bg-accent/10 group-hover:bg-accent/20"
                      )}
                    >
                      <feature.icon
                        className={cn(
                          "h-5 w-5",
                          feature.accent === "primary" ? "text-primary" : "text-accent"
                        )}
                      />
                    </div>
                    <CardTitle className="text-base font-semibold">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" className="py-24 bg-muted/15 border-y border-border/40">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-14 space-y-4">
              <Badge
                variant="outline"
                className="border-accent/30 text-accent font-medium"
              >
                Cómo funciona
              </Badge>
              <h2
                className="text-3xl md:text-4xl lg:text-5xl tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                En tres pasos{" "}
                <span className="text-primary">estás adentro</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-10 max-w-4xl mx-auto">
              {steps.map((step, idx) => (
                <div key={step.step} className="flex flex-col items-center text-center gap-5">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-3xl bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/25">
                      <step.icon className="h-7 w-7" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center shadow-sm">
                      {idx + 1}
                    </span>
                    {idx < steps.length - 1 && (
                      <div className="hidden md:flex absolute top-8 left-[calc(100%+1rem)] items-center w-[calc(100vw/3-5rem)]">
                        <div className="flex-1 h-px bg-gradient-to-r from-primary/40 to-transparent" />
                        <ChevronRight className="h-3 w-3 text-primary/30 -ml-1" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-base mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "gap-2 font-semibold shadow-lg shadow-primary/25 press-effect text-base h-11 px-7"
                )}
              >
                Empezar ahora — es gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="py-24">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-12 space-y-3">
              <Badge variant="outline" className="border-primary/30 text-primary font-medium">
                Lo que dicen
              </Badge>
              <h2
                className="text-3xl md:text-4xl tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Usuarios que ya lo usan
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-5">
              {testimonials.map((t, i) => (
                <Card
                  key={t.name}
                  className={cn(
                    "border-border/60 animate-fade-up",
                    `stagger-${i + 1}`
                  )}
                >
                  <CardContent className="pt-5">
                    <div className="flex gap-0.5 mb-3">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="h-3.5 w-3.5 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      &ldquo;{t.text}&rdquo;
                    </p>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="py-24 bg-muted/15 border-y border-border/40">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center mb-14 space-y-4">
              <Badge variant="outline" className="border-primary/30 text-primary font-medium">
                Precios
              </Badge>
              <h2
                className="text-3xl md:text-4xl lg:text-5xl tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Simple y transparente
              </h2>
              <p className="text-muted-foreground">
                Sin sorpresas. Sin cobros en USD. Todo en pesos.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {plans.map((plan) => (
                <Card
                  key={plan.name}
                  className={cn(
                    "relative transition-all duration-250",
                    plan.highlight
                      ? "border-primary shadow-xl shadow-primary/12 bg-primary/3 ring-1 ring-primary/20"
                      : "border-border/60"
                  )}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground shadow-md font-semibold px-3">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        Más popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {plan.name}
                    </p>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span
                        className="text-4xl font-bold tabular-nums"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {plan.price}
                      </span>
                      <span className="text-sm text-muted-foreground">/{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <ul className="space-y-2.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5 text-sm">
                          <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                            <Check className="h-2.5 w-2.5 text-primary" />
                          </div>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={plan.href}
                      className={cn(
                        buttonVariants({
                          variant: plan.highlight ? "default" : "outline",
                        }),
                        "w-full justify-center font-semibold h-10 press-effect"
                      )}
                    >
                      {plan.cta}
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA Final ── */}
        <section className="py-28 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
          </div>
          <div className="container mx-auto px-4 max-w-2xl text-center space-y-7">
            <Image
              src="/logo.png"
              alt="mangui"
              width={80}
              height={80}
              className="mx-auto rounded-3xl shadow-2xl shadow-primary/30"
            />
            <h2
              className="text-3xl md:text-4xl lg:text-5xl tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Listo para tomar
              <br />
              el control?
            </h2>
            <p className="text-muted-foreground text-base max-w-sm mx-auto">
              Unite a los primeros usuarios de mangui y empezá a manejar tu plata
              de manera inteligente.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "gap-2 font-semibold shadow-xl shadow-primary/30 press-effect text-base h-12 px-8"
                )}
              >
                Crear cuenta gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg", variant: "outline" }),
                  "press-effect font-semibold text-base h-12 px-8 gap-2"
                )}
              >
                <Download className="h-4 w-4" />
                Instalar como app
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              PWA — instalala desde el navegador. Sin App Store.
            </p>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border/60 bg-muted/10 py-10">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="mangui" width={24} height={24} className="rounded-md" />
              <span
                className="font-bold text-sm"
                style={{ fontFamily: "var(--font-display)" }}
              >
                mangui
              </span>
              <span className="text-xs text-muted-foreground ml-1.5">
                Hecho con amor en Argentina
              </span>
            </div>
            <nav className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/login" className="hover:text-foreground transition-colors">
                Iniciar sesión
              </Link>
              <Link href="/register" className="hover:text-foreground transition-colors">
                Registrarse
              </Link>
            </nav>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} mangui. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
