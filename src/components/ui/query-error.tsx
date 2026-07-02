"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Estado a mostrar cuando una useQuery de TanStack Query falla (isError).
 *
 * Uso:
 *   const { data, isError, refetch } = useQuery(...)
 *   if (isError) return <QueryError onRetry={() => refetch()} />
 */
export function QueryError({
  message = "No pudimos cargar tus datos.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </div>
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
