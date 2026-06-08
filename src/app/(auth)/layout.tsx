import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { Shield, TrendingUp, BarChart3 } from "lucide-react";

const brandPoints = [
  {
    icon: TrendingUp,
    title: "Multimoneda real",
    desc: "ARS y USD en un lugar. Cotización blue, MEP y oficial.",
  },
  {
    icon: BarChart3,
    title: "Control total",
    desc: "Presupuestos, metas y flujo de caja en tiempo real.",
  },
  {
    icon: Shield,
    title: "100% seguro",
    desc: "Tus datos protegidos con cifrado de punta a punta.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel: brand art — desktop only */}
      <div className="hidden lg:flex flex-col relative overflow-hidden bg-gradient-to-br from-[oklch(0.12_0.03_145)] via-[oklch(0.16_0.035_185)] to-[oklch(0.12_0.025_145)] border-r border-border">
        {/* Background glow blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-primary/20 blur-[80px] translate-x-1/3 -translate-y-1/4" />
        <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-accent/20 blur-[60px] -translate-x-1/4 translate-y-1/4" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-primary/10 blur-[40px]" />

        {/* Top logo */}
        <div className="relative z-10 p-8">
          <Link href="/" className="flex items-center w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            <BrandLockup size={28} wordClassName="text-white" />
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col items-start justify-center px-12 py-8 gap-10">
          <div className="space-y-3">
            <h2
              className="text-4xl text-white leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Tus finanzas,
              <br />
              <span className="text-primary">en tus manos</span>
            </h2>
            <p className="text-white/60 text-base max-w-xs leading-relaxed">
              La app pensada para Argentina. Inflación, cuotas, tipo de cambio —
              todo en un solo lugar.
            </p>
          </div>

          <div className="space-y-5 w-full max-w-xs">
            {brandPoints.map((point) => (
              <div key={point.title} className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <point.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold mb-0.5">{point.title}</p>
                  <p className="text-white/50 text-xs leading-relaxed">{point.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10 p-8 border-t border-white/10">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} mangui · Hecho en Argentina
          </p>
        </div>
      </div>

      {/* Right panel: form */}
      <div className="flex flex-col min-h-screen">
        {/* Mobile top logo */}
        <div className="lg:hidden flex items-center gap-2.5 px-6 pt-6 pb-4 bg-gradient-to-br from-[oklch(0.12_0.03_145)] via-[oklch(0.16_0.035_185)] to-[oklch(0.12_0.025_145)]">
          <Link href="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            <BrandLockup size={28} wordClassName="text-white" />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-8 md:px-12">
          <div className="w-full max-w-sm animate-fade-up">{children}</div>
        </div>
      </div>
    </div>
  );
}
