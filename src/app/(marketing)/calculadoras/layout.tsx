import Link from "next/link"
import { BrandLockup } from "@/components/brand-lockup"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function CalculadorasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-[100dvh]">
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
            aria-label="Calculadoras"
          >
            <Link
              href="/calculadoras"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            >
              Calculadoras
            </Link>
          </nav>

          <Link
            href="/register"
            className={cn(buttonVariants({ size: "sm" }), "font-semibold")}
          >
            Crear cuenta
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10 bg-black/40 backdrop-blur-[2px] py-10">
        <div className="container mx-auto px-5 max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col gap-3">
            <Link
              href="/"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded w-fit"
            >
              <BrandLockup size={24} />
            </Link>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} mangui
            </p>
          </div>

          <nav className="flex flex-wrap gap-5 text-xs text-muted-foreground" aria-label="Footer">
            <Link
              href="/privacidad"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Privacidad
            </Link>
            <Link
              href="/terminos"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Términos
            </Link>
            <Link
              href="/register"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Crear cuenta
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
