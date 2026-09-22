"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UpgradeLink } from "@/components/ui/upgrade-link"
import { GOALS_KEY } from "@/lib/goals"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/database.types"
import { GoalForm, saveGoal, type GoalFormValues } from "./goal-form"

export const GOAL_ACCOUNTS_KEY = ["goal_accounts"] as const
export const GOAL_CATEGORIES_KEY = ["goal_categories"] as const

type Movement = Tables<"movements">
type Category = Tables<"categories">
type Account = Tables<"accounts">

export function CreateGoalDialog({
  categories,
  accounts,
  movements,
  isDemo,
  atLimit,
}: {
  categories: Category[]
  accounts: Account[]
  movements: Movement[]
  isDemo?: boolean
  atLimit?: boolean
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const isDisabled = isDemo || atLimit

  const mutation = useMutation({
    mutationFn: async (values: GoalFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      if (atLimit) {
        throw new Error("Alcanzaste el límite del plan Free. Mejorá a Premium para crear más.")
      }
      return saveGoal(values, undefined, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY })
      queryClient.invalidateQueries({ queryKey: GOAL_ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: GOAL_CATEGORIES_KEY })
      toast.success("Meta creada")
      setOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear la meta", { description: err.message })
    },
  })

  return (
    <>
      {atLimit ? (
        <UpgradeLink
          feature="goals"
          placement="list_limit"
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors duration-150 press-effect"
        />
      ) : (
        <Button
          onClick={() => setOpen(true)}
          size="sm"
          className="gap-1.5 press-effect cursor-pointer font-semibold shadow-sm shadow-primary/20"
          disabled={isDisabled}
          title={isDemo ? "No disponible en el modo demo" : undefined}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Nueva meta</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva meta</DialogTitle>
            <DialogDescription>
              Definí un objetivo de ahorro, ingreso o reducción de gastos.
            </DialogDescription>
          </DialogHeader>
          <GoalForm
            categories={categories}
            accounts={accounts}
            movements={movements}
            onSubmit={async (v) => { await mutation.mutateAsync(v) }}
            isLoading={mutation.isPending}
            submitLabel="Crear meta"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
