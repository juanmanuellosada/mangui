"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  PlusCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  Sparkles,
} from "lucide-react"
import { useQuickAdd } from "@/components/quick-add-provider"
import type { Account } from "@/lib/accounts"
import { cn } from "@/lib/utils"

export function QuickAddMenu({ accounts }: { accounts: Account[] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const quickAdd = useQuickAdd()
  const router = useRouter()

  const openDialog = (m: "movement" | "transfer", type?: "income" | "expense") => {
    setMenuOpen(false)
    quickAdd.open(m, type)
  }

  if (!accounts.length) return null

  return (
    <div className="relative">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => openDialog("movement", "expense")}
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-l-lg border-r-0 px-2.5 text-sm font-semibold",
            "bg-primary text-primary-foreground border border-transparent",
            "shadow-sm shadow-primary/20 press-effect",
            "hover:bg-primary/80 transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          <PlusCircle className="h-4 w-4" />
          Nuevo
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={cn(
            "inline-flex h-8 items-center px-1.5 rounded-r-lg",
            "bg-primary text-primary-foreground border border-transparent border-l border-primary-foreground/20",
            "shadow-sm shadow-primary/20 press-effect",
            "hover:bg-primary/80 transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="Opciones de nuevo registro"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-border/60 bg-popover shadow-lg overflow-hidden">
            <button type="button" onClick={() => openDialog("movement", "income")} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
              <ArrowUpCircle className="h-4 w-4 text-success flex-shrink-0" />
              <span className="font-medium">Ingreso</span>
            </button>
            <button type="button" onClick={() => openDialog("movement", "expense")} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
              <ArrowDownCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="font-medium">Gasto</span>
            </button>
            <div className="h-px bg-border/60 mx-2" />
            <button type="button" onClick={() => openDialog("transfer")} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium">Transferencia</span>
            </button>
            <div className="h-px bg-border/60 mx-2" />
            <button type="button" onClick={() => { setMenuOpen(false); router.push("/ia") }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-medium">Cargar con IA</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
