"use client"

/**
 * QuickAddProvider — global quick-add modal for new movements/transfers/cuotas/AI.
 *
 * Mount once in the (app) layout. Any component in the tree can call
 * `useQuickAdd().open(mode?, type?)` to open the modal, regardless of route.
 *
 * Supported modes:
 *  - "movement" (default) — opens MovementForm with a 3-way toggle
 *    (Gasto / Ingreso / Transferencia) so the user can switch inline.
 *  - "transfer"           — opens directly in transfer mode (same sheet)
 *  - "installment"        — opens InstallmentForm
 *  - "ai"                 — opens AiQuickAddSheet
 */

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { MovementForm, type MovementFormValues, type PendingAttachments, type MovementMode } from "@/components/movements/movement-form"
import type { TransferFormValues } from "@/components/transfers/transfer-form"
import { InstallmentForm, type InstallmentFormValues } from "@/components/installments/installment-form"
import { AiQuickAddSheet } from "@/components/ai/ai-quick-add-sheet"
import { createClient } from "@/lib/supabase/client"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import {
  MOVEMENTS_KEY,
  TRANSFERS_KEY,
  ACCOUNTS_KEY,
  BALANCES_KEY,
  CATEGORIES_KEY,
  type DollarType,
} from "@/lib/movements"
import { INSTALLMENTS_KEY, computeInstallmentAmounts, computeInstallmentDate, isInstallmentFuture } from "@/lib/installments"
import { isFutureDate } from "@/lib/date-utils"
import { uploadAttachment } from "@/lib/attachments"
import { fetchDolarRates } from "@/lib/rates/dolar"

type Category = Tables<"categories">
export type QuickAddMode = "movement" | "transfer" | "installment" | "ai"

// ── Context ───────────────────────────────────────────────────────────────────

interface QuickAddContextValue {
  open: (mode?: QuickAddMode, defaultType?: "income" | "expense") => void
}

const QuickAddContext = React.createContext<QuickAddContextValue | null>(null)

export function useQuickAdd(): QuickAddContextValue {
  const ctx = React.useContext(QuickAddContext)
  if (!ctx) throw new Error("useQuickAdd must be used inside QuickAddProvider")
  return ctx
}

// ── Data fetchers (shared with movements-list, same query keys = no refetch) ──

async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at")
  if (error) throw error
  return data
}

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name")
  if (error) throw error
  return data
}

// ── Installment helper (same logic as movements-list) ────────────────────────

async function createInstallmentPurchaseWithMovements(
  values: InstallmentFormValues,
  accounts: Account[]
): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const account = accounts.find((a) => a.id === values.account_id)
  const accountCurrency = account?.currency ?? "ARS"
  const isCross = values.currency !== accountCurrency

  let rateValue: number | null = null
  if (isCross && values.dollar_type && values.dollar_type !== "tarjeta") {
    try {
      const rates = await fetchDolarRates()
      const rateKey = values.dollar_type as Exclude<DollarType, "tarjeta">
      const rateData = rates[rateKey]
      if (rateData) {
        rateValue = values.currency === "ARS" ? rateData.sell : rateData.buy
      }
    } catch { /* proceed without rate */ }
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from("installment_purchases")
    .insert({
      user_id: user.id,
      description: values.description,
      total_amount: values.total_amount,
      installments_count: values.installments_count,
      start_date: values.start_date,
      account_id: values.account_id,
      category_id: values.category_id,
      currency: values.currency,
      dollar_type: isCross ? values.dollar_type : null,
    })
    .select()
    .single()

  if (purchaseError) throw purchaseError

  const { perAmount, lastAmount } = computeInstallmentAmounts(
    values.total_amount,
    values.installments_count
  )

  const movementRows = []
  for (let i = 1; i <= values.installments_count; i++) {
    const cuotaDate = computeInstallmentDate(values.start_date, i)
    const isFuture = isInstallmentFuture(cuotaDate)
    const cuotaAmount = i === values.installments_count ? lastAmount : perAmount

    let convertedAmount: number | null = null
    if (isCross && rateValue !== null) {
      const raw = values.currency === "ARS" ? cuotaAmount / rateValue : cuotaAmount * rateValue
      convertedAmount = Math.round(raw * 100) / 100
    }

    movementRows.push({
      user_id: user.id,
      type: "expense" as const,
      amount: cuotaAmount,
      original_currency: values.currency,
      account_id: values.account_id,
      category_id: values.category_id,
      date: cuotaDate,
      is_future: isFuture,
      installment_purchase_id: purchase.id,
      installment_number: i,
      installment_total: values.installments_count,
      dollar_type: isCross ? values.dollar_type : null,
      converted_amount: convertedAmount,
      note: null,
    })
  }

  const { error: movError } = await supabase.from("movements").insert(movementRows)
  if (movError) throw movError
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [mode, setMode] = React.useState<QuickAddMode>("movement")
  const [defaultType, setDefaultType] = React.useState<"income" | "expense">("expense")
  const queryClient = useQueryClient()

  const { data: accounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: categories = [] } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: fetchCategories,
  })

  const open = React.useCallback((m: QuickAddMode = "movement", type: "income" | "expense" = "expense") => {
    // Both "movement" and "transfer" are served by the same MovementForm sheet now.
    // Map "transfer" to "movement" mode so the sheet opens with the 3-way toggle,
    // but store the intended initial mode so MovementForm starts on the transfer tab.
    setMode(m === "transfer" ? "movement" : m)
    setDefaultType(type)
    setIsOpen(true)
  }, [])


  // Re-derive on every open call using a ref to capture the original QuickAddMode.
  const [openedAsTransfer, setOpenedAsTransfer] = React.useState(false)

  const openWithTransferTracking = React.useCallback(
    (m: QuickAddMode = "movement", type: "income" | "expense" = "expense") => {
      setOpenedAsTransfer(m === "transfer")
      open(m, type)
    },
    [open]
  )

  const movementMutation = useMutation({
    mutationFn: async ({
      values,
      pending,
    }: {
      values: MovementFormValues
      pending: PendingAttachments
    }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const account = accounts.find((a) => a.id === values.account_id)
      const isCross = account && values.original_currency !== account.currency

      // 3.2 — derive is_future from the date
      const is_future = isFutureDate(values.date)

      const { data, error } = await supabase
        .from("movements")
        .insert({
          user_id: user.id,
          type: values.type,
          amount: values.amount,
          original_currency: values.original_currency,
          account_id: values.account_id,
          category_id: values.category_id,
          date: values.date,
          note: values.note || null,
          is_future,
          dollar_type: isCross ? values.dollar_type : null,
          converted_amount: isCross ? values.converted_amount : null,
        })
        .select()
        .single()
      if (error) throw error

      // 4.3 — upload pending attachments (non-blocking on failure)
      const movementId = data.id
      const uploads: Array<{ file: File; kind: "factura" | "recibo" | "comprobante" }> = []
      if (values.type === "expense") {
        if (pending.factura) uploads.push({ file: pending.factura, kind: "factura" })
        if (pending.recibo) uploads.push({ file: pending.recibo, kind: "recibo" })
      } else if (values.type === "income") {
        if (pending.comprobante) uploads.push({ file: pending.comprobante, kind: "comprobante" })
      }

      for (const { file, kind } of uploads) {
        const result = await uploadAttachment({ file, userId: user.id, movementId, kind })
        if (result.error) {
          // D4: toast but don't fail — the movement was already created
          toast.warning(`Movimiento creado, pero no se pudo adjuntar "${file.name}": ${result.error}`)
        }
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Movimiento creado")
      setIsOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear el movimiento", { description: err.message })
    },
  })

  const transferMutation = useMutation({
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

      // 3.2 — derive is_future from the date
      const is_future = isFutureDate(values.date)

      const { data, error } = await supabase
        .from("transfers")
        .insert({
          user_id: user.id,
          from_account_id: values.from_account_id,
          to_account_id: values.to_account_id,
          from_amount: values.from_amount,
          to_amount: values.to_amount,
          date: values.date,
          note: values.note || null,
          is_future,
        })
        .select()
        .single()
      if (error) throw error

      // Upload comprobante if provided (non-blocking on failure)
      if (pendingComprobante) {
        const result = await uploadAttachment({
          file: pendingComprobante,
          userId: user.id,
          kind: "comprobante",
          transferId: data.id,
        })
        if (result.error) {
          toast.warning(`Transferencia creada, pero no se pudo adjuntar el comprobante: ${result.error}`)
        }
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Transferencia creada")
      setIsOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear la transferencia", { description: err.message })
    },
  })

  const installmentMutation = useMutation({
    mutationFn: (values: InstallmentFormValues) =>
      createInstallmentPurchaseWithMovements(values, accounts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: INSTALLMENTS_KEY })
      toast.success("Compra en cuotas creada")
      setIsOpen(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear las cuotas", { description: err.message })
    },
  })

  // Determine initial movement mode for the 3-way toggle
  const movementInitialMode: MovementMode = openedAsTransfer
    ? "transfer"
    : defaultType

  const sheetTitle =
    mode === "movement"
      ? "Nuevo movimiento"
      : "Nuevo gasto en cuotas"

  const sheetDescription =
    mode === "movement"
      ? "Registrá un movimiento o transferencia."
      : "Dividí una compra en cuotas mensuales."

  return (
    <QuickAddContext.Provider value={{ open: openWithTransferTracking }}>
      {children}

      {/* AI Quick Add Sheet */}
      <AiQuickAddSheet
        open={isOpen && mode === "ai"}
        onOpenChange={(v) => { if (!v) setIsOpen(false) }}
        accounts={accounts}
        categories={categories}
      />

      {/* MangoSheet — movement (3-way) / installment */}
      <MangoSheet
        open={isOpen && mode !== "ai"}
        onOpenChange={setIsOpen}
        title={sheetTitle}
        description={sheetDescription}
      >
        {mode === "movement" ? (
          /* 5.1/5.2 — MovementForm handles the 3-way toggle (Gasto/Ingreso/Transferencia) */
          <MovementForm
            accounts={accounts}
            categories={categories}
            defaultValues={{ type: defaultType }}
            onSubmit={async (v, pending) => {
              await movementMutation.mutateAsync({ values: v, pending })
            }}
            onTransferSubmit={
              (async (v: TransferFormValues, pendingComprobante?: File | null) => {
                await transferMutation.mutateAsync({ values: v, pendingComprobante })
              }) as (v: TransferFormValues) => Promise<void>
            }
            isLoading={movementMutation.isPending}
            transferLoading={transferMutation.isPending}
            submitLabel="Crear movimiento"
            isCreateMode
            initialMode={movementInitialMode}
          />
        ) : (
          <InstallmentForm
            accounts={accounts}
            categories={categories}
            onSubmit={async (v) => { await installmentMutation.mutateAsync(v) }}
            isLoading={installmentMutation.isPending}
          />
        )}
      </MangoSheet>
    </QuickAddContext.Provider>
  )
}
