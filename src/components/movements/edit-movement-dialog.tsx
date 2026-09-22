"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { MovementForm, movementToFormValues, type MovementFormValues, type PendingAttachments } from "./movement-form"
import { cn } from "@/lib/utils"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/client"
import {
  ACCOUNTS_KEY,
  BALANCES_KEY,
  MOVEMENTS_KEY,
  type DollarType,
} from "@/lib/movements"
import {
  INSTALLMENTS_KEY,
  isDateInPaidCycle,
  fetchInstallmentMovements,
  fetchAllMovementsForAccount,
  fetchStatementsForAccount,
} from "@/lib/installments"
import { listCardCycles, type CardCycle } from "@/lib/cards"
import { LEARNING_KEY, recordCategoryLearning } from "@/lib/category-learning"
import { ACCOUNT_LEARNING_KEY, recordAccountLearning } from "@/lib/account-learning"
import { listAttachments, uploadAttachment } from "@/lib/attachments"
import { isFutureDate } from "@/lib/date-utils"

type Movement = Tables<"movements">
type Category = Tables<"categories">

/**
 * For a sibling cuota (not the one being edited), recompute dollar_type/converted_amount
 * coherently with its own amount when the edit changes account/currency — never copy the
 * edited movement's converted_amount literally.
 */
function computeSiblingConversion({
  siblingAmount,
  siblingOriginalCurrency,
  newAccountCurrency,
  dollarType,
  editedAmount,
  editedConvertedAmount,
}: {
  siblingAmount: number
  siblingOriginalCurrency: string
  newAccountCurrency: string
  dollarType: DollarType | null
  editedAmount: number
  editedConvertedAmount: number | null
}): { dollar_type: DollarType | null; converted_amount: number | null } {
  const isCross = siblingOriginalCurrency !== newAccountCurrency
  if (!isCross) return { dollar_type: null, converted_amount: null }
  if (!dollarType || editedConvertedAmount === null || editedAmount === 0) {
    return { dollar_type: dollarType, converted_amount: null }
  }
  const ratio = editedConvertedAmount / editedAmount
  return { dollar_type: dollarType, converted_amount: Math.round(siblingAmount * ratio * 100) / 100 }
}

export function EditMovementDialog({
  movement,
  accounts,
  categories,
  open,
  onOpenChange,
}: {
  movement: Movement
  accounts: Account[]
  categories: Category[]
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const queryClient = useQueryClient()
  const purchaseId = movement.installment_purchase_id
  const isCuota = purchaseId !== null

  const { data: existingAttachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ["movement_attachments", movement.id],
    queryFn: async () => {
      const { data } = await listAttachments(movement.id)
      return data
    },
    enabled: open,
  })

  // ── Data needed to detect paid/unpaid siblings when this movement is a cuota ──
  const cardAccount = isCuota ? accounts.find((a) => a.id === movement.account_id) : undefined

  const { data: siblings = [] } = useQuery({
    queryKey: ["installment_movements", purchaseId],
    queryFn: () => fetchInstallmentMovements(purchaseId!),
    enabled: open && isCuota,
  })
  const { data: cardMovements = [] } = useQuery({
    queryKey: ["movements", "card", cardAccount?.id],
    queryFn: () => fetchAllMovementsForAccount(cardAccount!.id),
    enabled: open && isCuota && !!cardAccount,
  })
  const { data: cardStatements = [] } = useQuery({
    queryKey: ["card_statements", cardAccount?.id],
    queryFn: () => fetchStatementsForAccount(cardAccount!.id),
    enabled: open && isCuota && !!cardAccount,
  })

  const cycles: CardCycle[] = cardAccount
    ? listCardCycles(cardAccount.id, cardAccount, cardMovements, cardStatements)
    : []
  const unpaidSiblings = siblings.filter((m) => !isDateInPaidCycle(m.date, cycles))
  const otherUnpaidSiblings = unpaidSiblings.filter((m) => m.id !== movement.id)
  const paidCount = siblings.length - unpaidSiblings.length

  // Values pending confirmation of scope ("solo esta cuota" vs "todas las no pagadas")
  const [pendingSubmit, setPendingSubmit] = useState<{
    values: MovementFormValues
    pending: PendingAttachments
  } | null>(null)

  const mutation = useMutation({
    mutationFn: async ({
      values,
      pending,
      scope,
    }: {
      values: MovementFormValues
      pending: PendingAttachments
      scope: "single" | "all"
    }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const account = accounts.find((a) => a.id === values.account_id)
      const isCross = account && values.original_currency !== account.currency
      const is_future = isFutureDate(values.date)

      const { data, error } = await supabase
        .from("movements")
        .update({
          type: values.type,
          amount: values.amount,
          original_currency: values.original_currency,
          account_id: values.account_id,
          category_id: values.category_id,
          date: values.date,
          note: values.note || null,
          tags: values.tags,
          is_future,
          dollar_type: isCross ? values.dollar_type : null,
          converted_amount: isCross ? values.converted_amount : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", movement.id)
        .select()
        .single()
      if (error) throw error

      if (scope === "all") {
        const newAccountCurrency = account?.currency ?? "ARS"
        for (const sibling of otherUnpaidSiblings) {
          const { dollar_type, converted_amount } = computeSiblingConversion({
            siblingAmount: sibling.amount,
            siblingOriginalCurrency: sibling.original_currency,
            newAccountCurrency,
            dollarType: values.dollar_type,
            editedAmount: values.amount,
            editedConvertedAmount: values.converted_amount,
          })
          const { error: siblingErr } = await supabase
            .from("movements")
            .update({
              category_id: values.category_id,
              note: values.note || null,
              tags: values.tags,
              account_id: values.account_id,
              dollar_type,
              converted_amount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sibling.id)
          if (siblingErr) throw siblingErr
        }
      }

      const uploads: Array<{ file: File; kind: "factura" | "recibo" | "comprobante" }> = []
      if (values.type === "expense") {
        if (pending.factura) uploads.push({ file: pending.factura, kind: "factura" })
        if (pending.recibo) uploads.push({ file: pending.recibo, kind: "recibo" })
      } else if (values.type === "income") {
        if (pending.comprobante) uploads.push({ file: pending.comprobante, kind: "comprobante" })
      }
      for (const { file, kind } of uploads) {
        const result = await uploadAttachment({ file, userId: user.id, movementId: movement.id, kind })
        if (result.error) {
          toast.warning(`Movimiento actualizado, pero no se pudo adjuntar "${file.name}": ${result.error}`)
        }
      }

      return data
    },
    onMutate: async ({ values }) => {
      await queryClient.cancelQueries({ queryKey: MOVEMENTS_KEY })
      const previousAll = queryClient.getQueriesData<Movement[]>({ queryKey: MOVEMENTS_KEY })
      queryClient.setQueriesData<Movement[]>({ queryKey: MOVEMENTS_KEY }, (old) =>
        Array.isArray(old)
          ? old.map((m) =>
              m.id === movement.id
                ? {
                    ...m,
                    type: values.type,
                    amount: values.amount,
                    original_currency: values.original_currency,
                    account_id: values.account_id,
                    category_id: values.category_id,
                    date: values.date,
                    note: values.note || null,
                    is_future: isFutureDate(values.date),
                  }
                : m
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
      toast.error("Error al actualizar", { description: err.message })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      if (isCuota) {
        queryClient.invalidateQueries({ queryKey: INSTALLMENTS_KEY })
        queryClient.invalidateQueries({ queryKey: ["installment_movements", purchaseId] })
        queryClient.invalidateQueries({ queryKey: ["movements", "card"] })
      }
      // A category correction on edit is the strongest learning signal —
      // only record when the category actually changed (not on every save).
      if (
        variables.values.category_id &&
        variables.values.category_id !== movement.category_id &&
        variables.values.note
      ) {
        recordCategoryLearning(createClient(), variables.values.note, variables.values.category_id)
        queryClient.invalidateQueries({ queryKey: LEARNING_KEY })
      }
      // Same criterio: una corrección de cuenta en la edición es la señal más
      // fuerte de aprendizaje — solo se registra cuando la cuenta cambió.
      if (variables.values.account_id !== movement.account_id) {
        recordAccountLearning(
          createClient(),
          {
            categoryId: variables.values.category_id,
            currency: variables.values.original_currency,
            note: variables.values.note,
          },
          variables.values.account_id
        )
        queryClient.invalidateQueries({ queryKey: ACCOUNT_LEARNING_KEY })
      }
      toast.success(variables.scope === "all" ? "Cuotas actualizadas" : "Movimiento actualizado")
      onOpenChange(false)
    },
  })

  async function handleFormSubmit(values: MovementFormValues, pending: PendingAttachments) {
    if (isCuota && otherUnpaidSiblings.length > 0) {
      setPendingSubmit({ values, pending })
      return
    }
    await mutation.mutateAsync({ values, pending, scope: "single" })
  }

  return (
    <MangoSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Editar movimiento"
      description="Modificá los datos del movimiento."
    >
      <MovementForm
        accounts={accounts}
        categories={categories}
        defaultValues={movementToFormValues(movement)}
        onSubmit={handleFormSubmit}
        isLoading={mutation.isPending}
        submitLabel="Guardar cambios"
        existingAttachments={existingAttachments}
        onAttachmentDeleted={() => refetchAttachments()}
      />

      {/* Scope choice — only shown for cuotas that have other unpaid siblings */}
      <Dialog
        open={pendingSubmit !== null}
        onOpenChange={(v) => { if (!v && !mutation.isPending) setPendingSubmit(null) }}
      >
        <DialogContent compact className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿A qué cuotas aplicás el cambio?</DialogTitle>
            <DialogDescription>
              Esta compra tiene {otherUnpaidSiblings.length + 1} cuota{otherUnpaidSiblings.length + 1 !== 1 ? "s" : ""} no pagada{otherUnpaidSiblings.length + 1 !== 1 ? "s" : ""}
              {paidCount > 0 ? ` (${paidCount} pagada${paidCount !== 1 ? "s" : ""} no se toca${paidCount !== 1 ? "n" : ""}).` : "."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                const submit = pendingSubmit
                setPendingSubmit(null)
                if (submit) mutation.mutate({ ...submit, scope: "single" })
              }}
              className={cn(
                "w-full text-left rounded-xl border border-border/60 px-3.5 py-3",
                "hover:border-primary/50 hover:bg-muted/40 transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <p className="text-sm font-semibold">Solo esta cuota</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Actualiza únicamente la cuota {movement.installment_number}/{movement.installment_total}.
              </p>
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                const submit = pendingSubmit
                setPendingSubmit(null)
                if (submit) mutation.mutate({ ...submit, scope: "all" })
              }}
              className={cn(
                "w-full text-left rounded-xl border border-primary/40 bg-primary/5 px-3.5 py-3",
                "hover:bg-primary/10 transition-colors duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <p className="text-sm font-semibold text-primary">
                Todas las cuotas no pagadas ({otherUnpaidSiblings.length + 1})
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Actualiza esta cuota y las demás no pagadas. Las pagadas no se modifican.
              </p>
            </button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingSubmit(null)}
              disabled={mutation.isPending}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MangoSheet>
  )
}

