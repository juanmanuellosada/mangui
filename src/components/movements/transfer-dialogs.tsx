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
import { MangoSheet } from "@/components/ui/mango-sheet"
import { TransferForm, transferToFormValues, type TransferFormValues } from "@/components/transfers/transfer-form"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/client"
import { uploadAttachment } from "@/lib/attachments"
import { isFutureDate } from "@/lib/date-utils"
import { ACCOUNTS_KEY, BALANCES_KEY, TRANSFERS_KEY } from "@/lib/movements"

type Transfer = Tables<"transfers">

export function EditTransferDialog({
  transfer,
  accounts,
  open,
  onOpenChange,
}: {
  transfer: Transfer
  accounts: Account[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({
      values,
      pendingComprobante,
    }: {
      values: TransferFormValues
      pendingComprobante?: File | null
    }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const { data, error } = await supabase
        .from("transfers")
        .update({
          from_account_id: values.from_account_id,
          to_account_id: values.to_account_id,
          from_amount: values.from_amount,
          to_amount: values.to_amount,
          date: values.date,
          note: values.note || null,
          is_future: isFutureDate(values.date),
          updated_at: new Date().toISOString(),
        })
        .eq("id", transfer.id)
        .select()
        .single()
      if (error) throw error

      if (pendingComprobante) {
        const result = await uploadAttachment({
          file: pendingComprobante,
          userId: user.id,
          kind: "comprobante",
          transferId: transfer.id,
        })
        if (result.error) {
          toast.warning(`Transferencia actualizada, pero no se pudo adjuntar el comprobante: ${result.error}`)
        }
      }

      return data
    },
    onMutate: async ({ values }) => {
      await queryClient.cancelQueries({ queryKey: TRANSFERS_KEY })
      const previousAll = queryClient.getQueriesData<Transfer[]>({ queryKey: TRANSFERS_KEY })
      queryClient.setQueriesData<Transfer[]>({ queryKey: TRANSFERS_KEY }, (old) =>
        Array.isArray(old)
          ? old.map((t) =>
              t.id === transfer.id
                ? {
                    ...t,
                    from_account_id: values.from_account_id,
                    to_account_id: values.to_account_id,
                    from_amount: values.from_amount,
                    to_amount: values.to_amount,
                    date: values.date,
                    note: values.note || null,
                    is_future: isFutureDate(values.date),
                  }
                : t
            )
          : old
      )
      return { previousAll }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousAll) {
        for (const [key, data] of context.previousAll) {
          queryClient.setQueryData(key, data)
        }
      }
      toast.error("Error al actualizar la transferencia", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY })
      queryClient.invalidateQueries({ queryKey: ["transfer_attachments", transfer.id] })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Transferencia actualizada")
      onOpenChange(false)
    },
  })

  return (
    <MangoSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Editar transferencia"
      description="Modificá los datos de la transferencia."
    >
      <TransferForm
        accounts={accounts}
        defaultValues={transferToFormValues(transfer)}
        onSubmit={async (v, pendingComprobante) => {
          await mutation.mutateAsync({ values: v, pendingComprobante })
        }}
        isLoading={mutation.isPending}
        submitLabel="Guardar cambios"
        transferId={transfer.id}
        onAttachmentDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ["transfer_attachments", transfer.id] })
        }}
      />
    </MangoSheet>
  )
}

export function DeleteTransferDialog({
  transfer,
  open,
  onOpenChange,
}: {
  transfer: Transfer
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from("transfers")
        .delete()
        .eq("id", transfer.id)
      if (error) throw error
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: TRANSFERS_KEY })
      const previousAll = queryClient.getQueriesData<Transfer[]>({ queryKey: TRANSFERS_KEY })
      queryClient.setQueriesData<Transfer[]>({ queryKey: TRANSFERS_KEY }, (old) =>
        Array.isArray(old) ? old.filter((t) => t.id !== transfer.id) : old
      )
      return { previousAll }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousAll) {
        for (const [key, data] of context.previousAll) {
          queryClient.setQueryData(key, data)
        }
      }
      toast.error("Error al eliminar la transferencia", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Transferencia eliminada")
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent compact className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar transferencia</DialogTitle>
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
