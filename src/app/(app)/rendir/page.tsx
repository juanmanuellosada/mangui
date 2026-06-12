import type { Metadata } from "next"
import { TrendingUp } from "lucide-react"
import { RendirView } from "@/components/rendir/rendir-view"

export const metadata: Metadata = {
  title: "Dónde rendir",
}

export default function RendirPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center gap-2 pt-1">
        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">
            ¿Dónde rendir tu plata?
          </h1>
          <p className="text-xs text-muted-foreground">
            Tasas de plazo fijo, billeteras y fondos de dinero
          </p>
        </div>
      </div>

      <RendirView />
    </div>
  )
}
