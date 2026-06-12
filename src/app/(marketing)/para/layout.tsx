import Link from "next/link"
import { BrandLockup } from "@/components/brand-lockup"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SiteFooter } from "@/components/marketing/site-footer"

export default function ParaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative z-10 flex flex-col min-h-[100dvh]">
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
            aria-label="Para vos"
          >
            <Link
              href="/para"
              className="hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            >
              Para vos
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

      <SiteFooter />
    </div>
  )
}
