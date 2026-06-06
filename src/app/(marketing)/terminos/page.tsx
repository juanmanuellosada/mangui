import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones · mangui",
};

export default function TerminosPage() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 z-50 border-b border-border/50 glass bg-background/85">
        <div className="container mx-auto px-5 h-16 flex items-center max-w-6xl">
          <Link
            href="/"
            className="flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <BrandLockup size={28} />
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-5 max-w-2xl py-16 md:py-24">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1
              className="text-foreground leading-tight tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.8rem,4vw,2.6rem)",
                letterSpacing: "-0.025em",
              }}
            >
              Términos y condiciones
            </h1>
            <p className="text-sm text-muted-foreground">
              Última actualización: junio de 2025
            </p>
          </div>

          <div className="flex flex-col gap-6 text-sm text-muted-foreground leading-relaxed">
            <p>
              Al usar mangui aceptás estos términos. mangui es una herramienta
              de gestión financiera personal; la información que muestra no
              constituye asesoramiento financiero ni de inversión.
            </p>
            <p>
              El servicio se brinda "tal como está". Hacemos nuestro mejor
              esfuerzo para mantenerlo disponible y actualizado, pero no podemos
              garantizar disponibilidad ininterrumpida ni exactitud absoluta de
              las cotizaciones o datos externos que procesamos.
            </p>
            <p>
              Estamos trabajando en la versión completa de estos términos. Si
              tenés preguntas en el mientras tanto, podés escribirnos a
              hola@mangui.app y te respondemos a la brevedad.
            </p>
          </div>

          <div className="pt-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/50 bg-card py-8">
        <div className="container mx-auto px-5 max-w-6xl">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} mangui
          </p>
        </div>
      </footer>
    </div>
  );
}
