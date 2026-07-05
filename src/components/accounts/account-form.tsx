"use client"

import { useState, useEffect } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { MangoSelect } from "@/components/ui/mango-select"
import { CurrencyToggle } from "@/components/ui/currency-toggle"
import { Switch } from "@/components/ui/switch"
import { IconPicker } from "@/components/ui/icon-picker"
import { MangoDatePicker } from "@/components/ui/mango-date-picker"
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_EMOJIS,
  renderAccountIcon,
  type Account,
} from "@/lib/accounts"
import { toDateString } from "@/lib/cards"
import { cn } from "@/lib/utils"
import { useIsDemo } from "@/lib/use-is-demo"

// Explicit type — avoids inference issues with z.coerce in zod v4
export type AccountFormValues = {
  name: string
  type:
    | "caja_ahorro"
    | "cuenta_corriente"
    | "efectivo"
    | "inversion"
    | "tarjeta_credito"
    | "billetera_virtual"
    | "otro"
  currency: "ARS" | "USD"
  initial_balance: number
  icon: string
  color: string
  is_hidden: boolean
  account_number?: string | null
  closing_date?: string | null
  due_date?: string | null
}

const accountSchema = z
  .object({
    name: z.string().min(1, "El nombre es requerido").max(60, "Máximo 60 caracteres"),
    type: z.enum([
      "caja_ahorro",
      "cuenta_corriente",
      "efectivo",
      "inversion",
      "tarjeta_credito",
      "billetera_virtual",
      "otro",
    ]),
    currency: z.enum(["ARS", "USD"]),
    initial_balance: z.coerce.number(),
    icon: z.string().min(1),
    color: z.string(),
    is_hidden: z.boolean(),
    account_number: z.string().max(120).nullable().optional(),
    closing_date: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "tarjeta_credito") {
      if (!data.closing_date) {
        ctx.addIssue({
          path: ["closing_date"],
          code: z.ZodIssueCode.custom,
          message: "Seleccioná la fecha de cierre",
        })
      }
      if (!data.due_date) {
        ctx.addIssue({
          path: ["due_date"],
          code: z.ZodIssueCode.custom,
          message: "Seleccioná la fecha de vencimiento",
        })
      }
    }
  })

// Account type options with emoji glyphs
const ACCOUNT_TYPE_OPTIONS = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => {
  const emoji = ACCOUNT_TYPE_EMOJIS[value as keyof typeof ACCOUNT_TYPE_EMOJIS]
  return {
    value,
    label,
    leading: (
      <span className="text-base leading-none select-none" aria-hidden>
        {emoji}
      </span>
    ),
  }
})

/** Parse a stored closing_date/due_date (yyyy-MM-dd) into a Date for the picker. */
function parseStoredDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  return parseISO(dateStr)
}

interface AccountFormProps {
  defaultValues?: Partial<AccountFormValues>
  onSubmit: (values: AccountFormValues) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
  /** Supabase user ID — needed for icon image upload */
  userId?: string
}

export function AccountForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Guardar",
  userId,
}: AccountFormProps) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const isDemo = useIsDemo()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AccountFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(accountSchema) as unknown as Resolver<AccountFormValues, any>,
    defaultValues: {
      name: "",
      type: "caja_ahorro",
      currency: "ARS",
      initial_balance: 0,
      icon: "🏦",
      color: "#65a30d",
      is_hidden: false,
      account_number: null,
      closing_date: null,
      due_date: null,
      ...defaultValues,
    },
  })

  const selectedType = watch("type")
  const selectedIcon = watch("icon")
  const selectedCurrency = watch("currency")
  const isHidden = watch("is_hidden")
  const isCreditCard = selectedType === "tarjeta_credito"

  // Local Date state for the two calendar pickers, parsed from the stored
  // closing_date/due_date — shows exactly the date the user picked/saved,
  // not a projected "next occurrence".
  const [closeDate, setCloseDate] = useState<Date | null>(
    () => parseStoredDate(defaultValues?.closing_date)
  )
  const [dueDate, setDueDate] = useState<Date | null>(
    () => parseStoredDate(defaultValues?.due_date)
  )

  // Force ARS when credit card is selected; restore toggle when switching away
  useEffect(() => {
    if (isCreditCard && selectedCurrency !== "ARS") {
      setValue("currency", "ARS", { shouldValidate: true })
    }
  }, [isCreditCard, selectedCurrency, setValue])

  // Dynamic currency prefix for the balance input — credit cards are always ARS ($)
  const currencyPrefix = !isCreditCard && selectedCurrency === "USD" ? "US$" : "$"

  // When user picks a close date, store the exact date in the form
  function handleCloseDate(date: Date) {
    setCloseDate(date)
    setValue("closing_date", toDateString(date), { shouldValidate: true })
  }

  // When user picks a due date, store the exact date in the form
  function handleDueDate(date: Date) {
    setDueDate(date)
    setValue("due_date", toDateString(date), { shouldValidate: true })
  }

  // Validate due is after close if both are set
  const dueDateWarning: string | null = (() => {
    if (!closeDate || !dueDate) return null
    // Allow same day; only warn if due is strictly before close
    if (dueDate.getTime() < closeDate.getTime()) {
      return "El vencimiento debería ser igual o posterior al cierre."
    }
    return null
  })()

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* ── Ícono picker (top) ───────────────────────────── */}
        <div className="flex flex-col items-center gap-2 pb-1">
          <Label className="self-start">Ícono</Label>
          <button
            type="button"
            onClick={() => setIconPickerOpen(true)}
            className="h-16 w-16 rounded-2xl bg-muted/60 border border-border/60 flex items-center justify-center hover:bg-muted transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden"
            aria-label="Seleccionar ícono"
            title="Cambiar ícono"
          >
            {renderAccountIcon(selectedIcon, { size: "h-8 w-8", logoFill: true })}
          </button>
          <span className="text-[11px] text-muted-foreground">
            Tocá para cambiar
          </span>
        </div>

        {/* ── Nombre ───────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            placeholder="Ej: Cuenta Galicia"
            {...register("name")}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* ── Tipo de cuenta ───────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="account-type">Tipo de cuenta</Label>
          <MangoSelect
            id="account-type"
            options={ACCOUNT_TYPE_OPTIONS}
            value={selectedType}
            onChange={(v) =>
              setValue("type", v as AccountFormValues["type"], { shouldValidate: true })
            }
            aria-invalid={!!errors.type}
          />
          {errors.type && (
            <p className="text-xs text-destructive">{errors.type.message}</p>
          )}
        </div>

        {/* ── Número de cuenta (opcional, hidden for credit cards) ── */}
        {!isCreditCard && (
          <div className="space-y-1.5">
            <Label htmlFor="account_number">
              Número de cuenta{" "}
              <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="account_number"
              placeholder="CBU, CVU o alias (opcional)"
              {...register("account_number")}
              aria-invalid={!!errors.account_number}
            />
            {errors.account_number && (
              <p className="text-xs text-destructive">{errors.account_number.message}</p>
            )}
          </div>
        )}

        {/* ── Moneda — segmented toggle (hidden for credit cards, always ARS) ── */}
        {!isCreditCard && (
          <div className="space-y-1.5">
            <Label>Moneda</Label>
            <CurrencyToggle
              value={selectedCurrency}
              onChange={(v) =>
                setValue("currency", v, { shouldValidate: true })
              }
              className="w-full"
            />
          </div>
        )}

        {/* ── Saldo inicial with dynamic currency prefix ────── */}
        <div className="space-y-1.5">
          <Label htmlFor="initial_balance">Saldo inicial</Label>
          <MoneyInput
            id="initial_balance"
            step="0.01"
            prefix={currencyPrefix}
            {...register("initial_balance")}
            aria-invalid={!!errors.initial_balance}
            className="w-full"
          />
          {errors.initial_balance && (
            <p className="text-xs text-destructive">{errors.initial_balance.message}</p>
          )}
        </div>

        {/* ── Tarjeta de crédito: calendario próximo cierre / vencimiento ── */}
        {isCreditCard && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="close-date-picker">Próximo cierre</Label>
              <MangoDatePicker
                id="close-date-picker"
                value={closeDate}
                onChange={handleCloseDate}
                placeholder="Seleccionar fecha"
                aria-invalid={!!errors.closing_date}
              />
              {errors.closing_date && (
                <p className="text-xs text-destructive">{errors.closing_date.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due-date-picker">Próximo vencimiento</Label>
              <MangoDatePicker
                id="due-date-picker"
                value={dueDate}
                onChange={handleDueDate}
                placeholder="Seleccionar fecha"
                aria-invalid={!!errors.due_date}
              />
              {errors.due_date && (
                <p className="text-xs text-destructive">{errors.due_date.message}</p>
              )}
              {!errors.due_date && dueDateWarning && (
                <p className="text-xs text-amber-600 dark:text-amber-400">{dueDateWarning}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Ocultar del resumen — Switch row ─────────────── */}
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/30 px-3 py-3">
          <div className="space-y-0.5 min-w-0">
            <Label
              htmlFor="is_hidden_switch"
              className="cursor-pointer font-medium text-sm leading-snug"
            >
              Ocultar del resumen
            </Label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              La cuenta sigue existiendo pero no aparece en el balance total.
            </p>
          </div>
          <Switch
            id="is_hidden_switch"
            checked={isHidden}
            onCheckedChange={(v) => setValue("is_hidden", v)}
            aria-label="Ocultar esta cuenta del resumen"
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || isDemo}
          title={isDemo ? "No disponible en el modo demo" : undefined}
        >
          {isLoading ? "Guardando…" : submitLabel}
        </Button>
      </form>

      {/* Icon picker modal */}
      <IconPicker
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        value={selectedIcon}
        onChange={(v) => setValue("icon", v)}
        userId={userId}
      />
    </>
  )
}

/** Convert a DB Account row to AccountFormValues defaults */
export function accountToFormValues(account: Account): AccountFormValues {
  return {
    name: account.name,
    type: account.type,
    currency: account.currency,
    initial_balance: account.initial_balance,
    icon: account.icon ?? "🏦",
    color: account.color ?? "#65a30d",
    is_hidden: account.is_hidden,
    account_number: account.account_number ?? null,
    closing_date: account.closing_date ?? null,
    due_date: account.due_date ?? null,
  }
}
