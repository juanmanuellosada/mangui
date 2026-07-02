import Link from "next/link";
import { Compass } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 py-12 text-center">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{ background: "oklch(0.748 0.219 131.7)" }}
      >
        <Compass className="h-9 w-9 text-white" />
      </div>

      <h1
        className="text-3xl font-bold tracking-tight mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Página no encontrada
      </h1>
      <p className="text-muted-foreground max-w-[36ch] leading-relaxed mb-10">
        La página que buscás no existe o se movió de lugar.
      </p>

      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:opacity-90 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        Ir al inicio
      </Link>
    </div>
  );
}
