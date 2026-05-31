"use client"

import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ACCOUNT_TYPE_LABELS,
  CURRENCY_LABELS,
  ICON_OPTIONS,
  COLOR_OPTIONS,
  type Account,
} from "@/lib/accounts"
import { cn } from "@/lib/utils"

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
    color: z.string().min(1),
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

interface AccountFormProps {
  defaultValues?: Partial<AccountFormValues>
  onSubmit: (values: AccountFormValues) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
}

export function AccountForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Guardar",
}: AccountFormProps) {
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
      color: "#6366f1",
      is_hidden: false,
      closing_day: null,
      due_day: null,
      ...defaultValues,
    },
  })

  const selectedType = watch("type")
  const selectedIcon = watch("icon")
  const selectedColor = watch("color")
  const isHidden = watch("is_hidden")
  const isCreditCard = selectedType === "tarjeta_credito"

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
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

      {/* Type */}
      <div className="space-y-1.5">
        <Label>Tipo de cuenta</Label>
        <Select
          value={selectedType}
          onValueChange={(v) =>
            setValue("type", v as AccountFormValues["type"], { shouldValidate: true })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-xs text-destructive">{errors.type.message}</p>
        )}
      </div>

      {/* Currency */}
      <div className="space-y-1.5">
        <Label>Moneda</Label>
        <Select
          value={watch("currency")}
          onValueChange={(v) =>
            setValue("currency", v as AccountFormValues["currency"], { shouldValidate: true })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CURRENCY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Initial balance */}
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

      {/* Credit card specific fields */}
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

      {/* Icon picker */}
      <div className="space-y-1.5">
        <Label>Ícono</Label>
        <div className="flex flex-wrap gap-1.5">
          {ICON_OPTIONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => setValue("icon", icon)}
              className={cn(
                "h-8 w-8 rounded-lg text-base flex items-center justify-center border transition-colors",
                selectedIcon === icon
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-muted-foreground"
              )}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div className="space-y-1.5">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setValue("color", color)}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-all",
                selectedColor === color
                  ? "border-foreground scale-110"
                  : "border-transparent"
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Hidden toggle */}
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
    color: account.color ?? "#6366f1",
    is_hidden: account.is_hidden,
    closing_day: account.closing_day ?? null,
    due_day: account.due_day ?? null,
  }
}
