"use client"

/**
 * QuickAddProvider — global quick-add modal for new movements/transfers.
 *
 * Mount once in the (app) layout. Any component in the tree can call
 * `useQuickAdd().open(mode?, type?)` to open the modal, regardless of route.
 *
 * Supported modes:
 *  - "movement" (default) — opens MovementForm with a 3-way toggle
 *    (Gasto / Ingreso / Transferencia) so the user can switch inline.
 *    When the account is a credit card and type=expense, cuotas are
 *    handled inline — selecting ≥2 cuotas creates an installment purchase.
 *  - "transfer"           — opens directly in transfer mode (same sheet)
 *
 * AI mode ("ai") was removed: the AI entry points now navigate to /ia.
 */

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { MovementForm, type MovementFormValues, type PendingAttachments, type MovementMode } from "@/components/movements/movement-form"
import type { TransferFormValues } from "@/components/transfers/transfer-form"
import type { InstallmentFormValues } from "@/components/installments/installment-form"
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
import { enqueueMovement } from "@/lib/offline-queue"

type Category = Tables<"categories">
export type QuickAddMode = "movement" | "transfer"

// ── Context ───────────────────────────────────────────────────────────────────

export interface QuickAddPreset {
  account_id?: string
  date?: string
}

interface QuickAddContextValue {
  open: (mode?: QuickAddMode, defaultType?: "income" | "expense", preset?: QuickAddPreset) => void
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
  const [preset, setPreset] = React.useState<QuickAddPreset | undefined>(undefined)
  const queryClient = useQueryClient()

  const { data: accounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: categories = [] } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: fetchCategories,
  })

  const open = React.useCallback((m: QuickAddMode = "movement", type: "income" | "expense" = "expense", p?: QuickAddPreset) => {
    // Both "movement" and "transfer" are served by the same MovementForm sheet.
    // Map "transfer" to "movement" mode so the sheet opens with the 3-way toggle,
    // but store the intended initial mode so MovementForm starts on the transfer tab.
    setMode(m === "transfer" ? "movement" : m)
    setDefaultType(type)
    setPreset(p)
    setIsOpen(true)
  }, [])


  // Re-derive on every open call using a ref to capture the original QuickAddMode.
  const [openedAsTransfer, setOpenedAsTransfer] = React.useState(false)

  const openWithTransferTracking = React.useCallback(
    (m: QuickAddMode = "movement", type: "income" | "expense" = "expense", p?: QuickAddPreset) => {
      setOpenedAsTransfer(m === "transfer")
      open(m, type, p)
    },
    [open]
  )

  // Helper: enqueue a movement payload for offline sync and register background sync.
  // Returns a sentinel so onSuccess closes the form without trying to read server data.
  const enqueueOfflineMovement = React.useCallback(
    async (payload: Record<string, unknown>): Promise<{ __offline: true }> => {
      await enqueueMovement(payload)
      toast.success("Movimiento guardado sin conexión", {
        description: "Se sincroniza solo cuando vuelva la señal.",
      })
      // Best-effort background sync registration
      try {
        if (typeof navigator !== "undefined" && "serviceWorker" in navigator && "SyncManager" in window) {
          const reg = await navigator.serviceWorker.ready
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (reg as any).sync.register("mangui-sync").catch(() => {})
        }
      } catch { /* never breaks the enqueue */ }
      return { __offline: true }
    },
    []
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
      const isCreditCard = account?.type === "tarjeta_credito"
      const isCross = account && values.original_currency !== account.currency

      // Route to installment purchase when expense + credit card + cuotas >= 2
      if (values.type === "expense" && isCreditCard && (values.cuotas ?? 1) >= 2) {
        const category = categories.find((c) => c.id === values.category_id)
        const installmentValues: InstallmentFormValues = {
          description: values.note || category?.name || "Gasto en cuotas",
          total_amount: values.amount,
          installments_count: values.cuotas,
          start_date: values.date,
          account_id: values.account_id,
          category_id: values.category_id,
          currency: values.original_currency,
          dollar_type: isCross ? values.dollar_type : null,
        }
        await createInstallmentPurchaseWithMovements(installmentValues, accounts)
        return null
      }

      // Standard single-movement insert
      // 3.2 — derive is_future from the date
      const is_future = isFutureDate(values.date)

      const movementInsert = {
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
      }

      // Offline: skip Supabase entirely, enqueue and close
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return enqueueOfflineMovement(movementInsert as Record<string, unknown>)
      }

      let movementId: string
      try {
        const result = await supabase
          .from("movements")
          .insert(movementInsert)
          .select()
          .single()
        if (result.error) throw result.error
        movementId = result.data.id
      } catch (err) {
        // Network failure (TypeError = fetch failed, no response) → fall back to offline queue
        if (err instanceof TypeError) {
          return enqueueOfflineMovement(movementInsert as Record<string, unknown>)
        }
        throw err
      }
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

      return null
    },
    onSuccess: (data) => {
      // If we enqueued offline, don't invalidate (nothing to fetch) — just close the form.
      if (data && typeof data === "object" && "__offline" in data) {
        setIsOpen(false)
        return
      }
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: INSTALLMENTS_KEY })
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

  // Determine initial movement mode for the 3-way toggle
  const movementInitialMode: MovementMode = openedAsTransfer
    ? "transfer"
    : defaultType

  const sheetTitle = "Nuevo movimiento"
  const sheetDescription = "Registrá un movimiento o transferencia."

  return (
    <QuickAddContext.Provider value={{ open: openWithTransferTracking }}>
      {children}

      {/* MangoSheet — movement (3-way toggle: Gasto / Ingreso / Transferencia) */}
      <MangoSheet
        open={isOpen}
        onOpenChange={setIsOpen}
        title={sheetTitle}
        description={sheetDescription}
      >
        {/* MovementForm handles the 3-way toggle (Gasto/Ingreso/Transferencia).
            Credit card expenses with cuotas ≥ 2 are routed to installment purchase
            inside movementMutation — no separate sheet needed. */}
        <MovementForm
          accounts={accounts}
          categories={categories}
          defaultValues={{ type: defaultType, ...preset }}
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
      </MangoSheet>
    </QuickAddContext.Provider>
  )
}
