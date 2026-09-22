"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Tables } from "@/lib/database.types"
import { ACCOUNTS_KEY, BALANCES_KEY, MOVEMENTS_KEY } from "@/lib/movements"
import { createClient } from "@/lib/supabase/client"

type Movement = Tables<"movements">

export function DeleteMovementDialog({
  movement,
  open,
  onOpenChange,
}: {
  movement: Movement
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("movements")
        .delete()
        .eq("id", movement.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: MOVEMENTS_KEY })
      const previousAll = queryClient.getQueriesData<Movement[]>({ queryKey: MOVEMENTS_KEY })
      queryClient.setQueriesData<Movement[]>({ queryKey: MOVEMENTS_KEY }, (old) =>
        Array.isArray(old) ? old.filter((m) => m.id !== movement.id) : old
      )
      return { previousAll }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousAll) {
        for (const [key, data] of context.previousAll) {
          queryClient.setQueryData(key, data)
        }
      }
      toast.error("Error al eliminar", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Movimiento eliminado")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent compact className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar movimiento</DialogTitle>
          <DialogDescription>
            ¿Estás seguro? Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="press-effect"
          >
            {mutation.isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
