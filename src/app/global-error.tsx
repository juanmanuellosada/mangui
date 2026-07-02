"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import localFont from "next/font/local";
import "./globals.css";

// global-error reemplaza el root layout ante un error fatal, así que no
// puede depender de él — necesita su propia fuente y sus propios <html><body>.
const iaWriterQuattro = localFont({
  src: [
    {
      path: "./fonts/iAWriterQuattroS-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/iAWriterQuattroS-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/iAWriterQuattroS-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/iAWriterQuattroS-BoldItalic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-quattro",
  display: "swap",
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html
      lang="es-AR"
      className={`${iaWriterQuattro.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col items-center justify-center bg-background px-6 py-12 text-center">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
          style={{ background: "oklch(0.748 0.219 131.7)" }}
        >
          <span className="text-4xl" role="img" aria-label="Mango">
            🥭
          </span>
        </div>

        <h1
          className="text-3xl font-bold tracking-tight mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Algo salió mal
        </h1>
        <p className="text-muted-foreground max-w-[36ch] leading-relaxed mb-8">
          Encontramos un error inesperado. Ya lo estamos revisando — probá
          recargar la página.
        </p>

        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all duration-150 hover:opacity-90 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
