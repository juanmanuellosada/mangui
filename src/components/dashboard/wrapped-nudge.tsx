"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Sparkles, ChevronRight } from "lucide-react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { es } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"
import { WrappedSheet } from "@/components/wrapped/wrapped-sheet"

const CUTOFF_DAY = 7

async function hasMovementsInRange(from: string, to: string): Promise<boolean> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from("movements")
    .select("id", { count: "exact", head: true })
    .gte("date", from)
    .lte("date", to)
  if (error) throw error
  return (count ?? 0) > 0
}

/**
 * Muestra un banner en el dashboard, solo durante los primeros días del mes,
 * invitando a ver el "wrapped" del mes recién cerrado. No molesta si ese mes
 * no tiene movimientos cargados.
 */
export function WrappedNudge() {
  const [open, setOpen] = useState(false)

  const today = useMemo(() => new Date(), [])
  const showsThisMonth = today.getDate() <= CUTOFF_DAY

  const previousMonthDate = useMemo(() => subMonths(today, 1), [today])
  const previousMonthRef = format(previousMonthDate, "yyyy-MM")
  const previousMonthLabel = format(previousMonthDate, "MMMM", { locale: es })

  const { data: hasData } = useQuery({
    queryKey: ["movements", "wrapped-nudge", previousMonthRef],
    queryFn: () =>
      hasMovementsInRange(
        format(startOfMonth(previousMonthDate), "yyyy-MM-dd"),
        format(endOfMonth(previousMonthDate), "yyyy-MM-dd")
      ),
    enabled: showsThisMonth,
  })

  if (!showsThisMonth || !hasData) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors p-4 group w-full text-left"
      >
        <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">
            Ya está tu resumen de {previousMonthLabel} 🎉
          </p>
          <p className="text-xs text-muted-foreground">Mirá cómo te fue el mes pasado</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
      </button>

      <WrappedSheet open={open} onOpenChange={setOpen} monthRef={previousMonthRef} />
    </>
  )
}
