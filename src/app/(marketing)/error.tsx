"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function MarketingError({
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
    <div className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1.5">
        <h1
          className="text-xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Algo salió mal
        </h1>
        <p className="text-sm text-muted-foreground max-w-[36ch]">
          Ocurrió un error inesperado. Podés intentar de nuevo o volver al
          inicio.
        </p>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <Button onClick={() => reset()}>Reintentar</Button>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
