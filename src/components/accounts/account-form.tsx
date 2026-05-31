"use client"

import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MangoSelect } from "@/components/ui/mango-select"
import { CurrencySelect } from "@/components/ui/currency-select"
import { IconPicker } from "@/components/ui/icon-picker"
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ICON_COMPONENTS,
  renderAccountIcon,
  type Account,
} from "@/lib/accounts"

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
  closing_day?: number | null
  due_day?: number | null
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
    closing_day: z.coerce
      .number()
      .int()
      .min(1)
      .max(31)
      .nullable()
      .optional(),
    due_day: z.coerce
      .number()
      .int()
      .min(1)
      .max(31)
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "tarjeta_credito") {
      if (!data.closing_day) {
        ctx.addIssue({
          path: ["closing_day"],
          code: z.ZodIssueCode.custom,
          message: "Ingresá el día de cierre",
        })
      }
      if (!data.due_day) {
        ctx.addIssue({
          path: ["due_day"],
          code: z.ZodIssueCode.custom,
          message: "Ingresá el día de vencimiento",
        })
      }
    }
  })

const ACCOUNT_TYPE_OPTIONS = Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => {
  const IconComp = ACCOUNT_TYPE_ICON_COMPONENTS[value as keyof typeof ACCOUNT_TYPE_ICON_COMPONENTS]
  return {
    value,
    label,
    leading: <IconComp className="h-4 w-4 text-muted-foreground" aria-hidden />,
  }
})

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
      closing_day: null,
      due_day: null,
      ...defaultValues,
    },
  })

  const selectedType = watch("type")
  const selectedIcon = watch("icon")
  const isHidden = watch("is_hidden")
  const isCreditCard = selectedType === "tarjeta_credito"

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* ── Ícono picker (top) ───────────────────────────── */}
        <div className="flex flex-col items-center gap-2 pb-1">
          <Label className="self-start">Ícono</Label>
          <button
            type="button"
            onClick={() => setIconPickerOpen(true)}
            className="h-16 w-16 rounded-2xl bg-muted/60 border border-border/60 flex items-center justify-center hover:bg-muted transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Seleccionar ícono"
            title="Cambiar ícono"
          >
            {renderAccountIcon(selectedIcon, { size: "h-8 w-8" })}
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

        {/* ── Moneda ───────────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="account-currency">Moneda</Label>
          <CurrencySelect
            id="account-currency"
            value={watch("currency")}
            onChange={(v) =>
              setValue("currency", v as "ARS" | "USD", { shouldValidate: true })
            }
            className="w-full"
          />
        </div>

        {/* ── Saldo inicial ─────────────────────────────────── */}
        <div className="space-y-1.5">
          <Label htmlFor="initial_balance">Saldo inicial</Label>
          <Input
            id="initial_balance"
            type="number"
            step="0.01"
            {...register("initial_balance")}
            aria-invalid={!!errors.initial_balance}
          />
          {errors.initial_balance && (
            <p className="text-xs text-destructive">{errors.initial_balance.message}</p>
          )}
        </div>

        {/* ── Tarjeta de crédito: cierre / vencimiento ──────── */}
        {isCreditCard && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="closing_day">Día de cierre</Label>
              <Input
                id="closing_day"
                type="number"
                min={1}
                max={31}
                placeholder="1-31"
                {...register("closing_day")}
                aria-invalid={!!errors.closing_day}
              />
              {errors.closing_day && (
                <p className="text-xs text-destructive">{errors.closing_day.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due_day">Día de vencimiento</Label>
              <Input
                id="due_day"
                type="number"
                min={1}
                max={31}
                placeholder="1-31"
                {...register("due_day")}
                aria-invalid={!!errors.due_day}
              />
              {errors.due_day && (
                <p className="text-xs text-destructive">{errors.due_day.message}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Ocultar del resumen ───────────────────────────── */}
        <div className="flex items-center gap-2">
          <input
            id="is_hidden"
            type="checkbox"
            className="h-4 w-4 rounded border-input accent-primary"
            checked={isHidden}
            onChange={(e) => setValue("is_hidden", e.target.checked)}
          />
          <Label htmlFor="is_hidden" className="cursor-pointer font-normal">
            Ocultar esta cuenta del resumen
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
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
    closing_day: account.closing_day ?? null,
    due_day: account.due_day ?? null,
  }
}
