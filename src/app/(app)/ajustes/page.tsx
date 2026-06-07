"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTheme } from "next-themes"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { User, Settings2, Palette, Database, LogOut, Sun, Moon, Monitor, Info, Download, ShieldCheck, Check, Crown, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { CurrencyToggle } from "@/components/ui/currency-toggle"
import { createClient } from "@/lib/supabase/client"
import { signOut } from "@/app/actions/auth"
import { subscribeToPremium, cancelSubscription } from "@/app/actions/subscription"
import { cn } from "@/lib/utils"
import { useIsDemo } from "@/lib/use-is-demo"
import { usePlan, PLAN_KEY } from "@/lib/use-plan"
import { PREMIUM_PRICE_ARS, ANNUAL_PRICE_ARS } from "@/lib/plans"
import type { Tables } from "@/lib/database.types"

type Profile = Tables<"profiles">
type UserPreferences = Tables<"user_preferences">

const RATE_TYPE_LABELS = {
  oficial: "Oficial",
  blue: "Blue",
  mep: "MEP",
  ccl: "CCL",
  manual: "Manual",
} as const

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchProfile(): Promise<Profile | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()
  if (error) throw error
  return data
}

async function fetchPreferences(): Promise<UserPreferences | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single()
  if (error) throw error
  return data
}

interface ExchangeRateRow {
  rate_type: string
  buy: number
  sell: number
  fetched_at: string
}

async function fetchExchangeRates(): Promise<Record<string, ExchangeRateRow>> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("rate_type, buy, sell, fetched_at")
  if (error) throw error
  const map: Record<string, ExchangeRateRow> = {}
  for (const row of data ?? []) {
    map[row.rate_type] = row as ExchangeRateRow
  }
  return map
}

// ── CSV export ────────────────────────────────────────────────────────────────

function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

async function exportMovementsCSV() {
  const supabase = createClient()

  // Fetch movements, categories, accounts in parallel
  const [movRes, catRes, accRes] = await Promise.all([
    supabase.from("movements").select("*").order("date", { ascending: false }).limit(5000),
    supabase.from("categories").select("id, name"),
    supabase.from("accounts").select("id, name"),
  ])

  if (movRes.error) throw movRes.error
  if (catRes.error) throw catRes.error
  if (accRes.error) throw accRes.error

  const catMap: Record<string, string> = {}
  for (const c of catRes.data ?? []) catMap[c.id] = c.name

  const accMap: Record<string, string> = {}
  for (const a of accRes.data ?? []) accMap[a.id] = a.name

  const header = ["fecha", "tipo", "monto", "moneda", "monto_convertido", "categoria", "cuenta", "nota"]
  const rows = (movRes.data ?? []).map((m) => [
    escapeCSVField(m.date),
    escapeCSVField(m.type),
    escapeCSVField(m.amount),
    escapeCSVField(m.original_currency),
    escapeCSVField(m.converted_amount),
    escapeCSVField(catMap[m.category_id ?? ""] ?? ""),
    escapeCSVField(accMap[m.account_id] ?? ""),
    escapeCSVField(m.note),
  ])

  const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n")
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const today = new Date().toISOString().slice(0, 10)
  const link = document.createElement("a")
  link.href = url
  link.download = `mangui-movimientos-${today}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return "U"
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

function formatRate(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ── Profile section ───────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
})
type ProfileFormValues = z.infer<typeof profileSchema>

function ProfileSection({ profile }: { profile: Profile | null }) {
  const queryClient = useQueryClient()
  const isDemo = useIsDemo()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(profileSchema) as unknown as Resolver<ProfileFormValues, any>,
    defaultValues: { name: profile?.name ?? "" },
  })

  // Reset when profile loads
  useEffect(() => {
    if (profile) reset({ name: profile.name ?? "" })
  }, [profile, reset])

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { error } = await supabase
        .from("profiles")
        .update({ name: values.name.trim(), updated_at: new Date().toISOString() })
        .eq("id", user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      toast.success("Nombre actualizado")
    },
    onError: (err: Error) => {
      toast.error("Error al actualizar el perfil", { description: err.message })
    },
  })

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
      {/* Avatar (initials) */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.name ?? ""} />}
          <AvatarFallback className="text-xl bg-primary text-primary-foreground font-semibold">
            {getInitials(profile?.name ?? null)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{profile?.name ?? "Usuario"}</p>
          <p className="text-xs text-muted-foreground">{profile?.email ?? ""}</p>
          {/* TODO: subir avatar — upload de imagen pendiente */}
          <p className="text-[10px] text-muted-foreground mt-1">
            Cambio de foto: próximamente
          </p>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Nombre</Label>
        <Input
          id="profile-name"
          {...register("name")}
          aria-invalid={!!errors.name}
          placeholder="Tu nombre"
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={profile?.email ?? ""} readOnly className="bg-muted/40 cursor-default" />
        <p className="text-xs text-muted-foreground">El email no se puede cambiar desde acá.</p>
      </div>

      <Button
        type="submit"
        className="press-effect"
        disabled={mutation.isPending || !isDirty || isDemo}
        title={isDemo ? "No disponible en el modo demo" : undefined}
      >
        {mutation.isPending ? "Guardando…" : "Guardar nombre"}
      </Button>
    </form>
  )
}

// ── Preferences section ───────────────────────────────────────────────────────

const prefsSchema = z.object({
  default_currency: z.enum(["ARS", "USD"]),
  rate_type: z.enum(["oficial", "blue", "mep", "ccl", "manual"]),
  manual_rate: z.coerce.number().nullable(),
})
type PrefsFormValues = z.infer<typeof prefsSchema>

function PreferencesSection({ prefs }: { prefs: UserPreferences | null }) {
  const queryClient = useQueryClient()
  const isDemo = useIsDemo()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
    reset,
  } = useForm<PrefsFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(prefsSchema) as unknown as Resolver<PrefsFormValues, any>,
    defaultValues: {
      default_currency: prefs?.default_currency ?? "ARS",
      rate_type: prefs?.rate_type ?? "blue",
      manual_rate: prefs?.manual_rate ?? null,
    },
  })

  useEffect(() => {
    if (prefs) {
      reset({
        default_currency: prefs.default_currency,
        rate_type: prefs.rate_type,
        manual_rate: prefs.manual_rate ?? null,
      })
    }
  }, [prefs, reset])

  const rateType = watch("rate_type")
  const currency = watch("default_currency")

  // Fetch live exchange rates from the cached exchange_rates table
  const { data: exchangeRates, isLoading: ratesLoading } = useQuery({
    queryKey: ["exchange_rates"],
    queryFn: fetchExchangeRates,
    staleTime: 5 * 60 * 1000, // 5 min
  })

  const mutation = useMutation({
    mutationFn: async (values: PrefsFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { error } = await supabase
        .from("user_preferences")
        .update({
          default_currency: values.default_currency,
          rate_type: values.rate_type,
          manual_rate: values.rate_type === "manual" ? values.manual_rate : null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] })
      toast.success("Preferencias guardadas")
    },
    onError: (err: Error) => {
      toast.error("Error al guardar preferencias", { description: err.message })
    },
  })

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
      {/* Demo hint */}
      {isDemo && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          No disponible en el modo demo
        </p>
      )}

      {/* Default currency — uses CurrencyToggle with coin icons */}
      <div className={cn("space-y-1.5", isDemo && "opacity-50 pointer-events-none")}>
        <Label>Moneda predeterminada</Label>
        <CurrencyToggle
          value={currency}
          onChange={(c) => setValue("default_currency", c, { shouldDirty: true })}
        />
      </div>

      {/* Rate type — with live compra/venta values from exchange_rates table */}
      <div className="space-y-1.5">
        <Label>Tipo de cotización USD</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(RATE_TYPE_LABELS) as [keyof typeof RATE_TYPE_LABELS, string][]).map(([key, label]) => {
            const liveRate = key !== "manual" ? exchangeRates?.[key] : undefined
            return (
              <button
                key={key}
                type="button"
                disabled={isDemo}
                onClick={() => setValue("rate_type", key, { shouldDirty: true })}
                title={isDemo ? "No disponible en el modo demo" : undefined}
                className={cn(
                  "flex flex-col items-start px-3 py-2 rounded-lg text-xs font-semibold border transition-all duration-150 press-effect",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isDemo
                    ? "cursor-not-allowed opacity-50 bg-muted/40 border-border/40 text-muted-foreground"
                    : "cursor-pointer",
                  !isDemo && rateType === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : !isDemo
                      ? "bg-background border-border/60 text-muted-foreground hover:border-primary/50"
                      : ""
                )}
              >
                <span>{label}</span>
                {key !== "manual" && (
                  <span
                    className={cn(
                      "font-normal tabular-nums mt-0.5",
                      rateType === key && !isDemo ? "text-primary-foreground/75" : "text-muted-foreground/70"
                    )}
                  >
                    {ratesLoading
                      ? "…"
                      : liveRate
                        ? `$ ${formatRate(liveRate.buy)} / $ ${formatRate(liveRate.sell)}`
                        : "—"}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Manual rate */}
      {rateType === "manual" && (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1.5">
          <Label htmlFor="manual-rate">Tipo de cambio manual (ARS por USD)</Label>
          <Input
            id="manual-rate"
            type="number"
            step="0.01"
            min="1"
            placeholder="Ej: 1250"
            className="tabular-nums"
            disabled={isDemo}
            {...register("manual_rate")}
            aria-invalid={!!errors.manual_rate}
          />
          <p className="text-xs text-muted-foreground">
            Se usará este valor cuando selecciones "Manual" como tipo de cambio en movimientos.
          </p>
        </div>
      )}

      <Button
        type="submit"
        className="press-effect"
        disabled={mutation.isPending || !isDirty || isDemo}
        title={isDemo ? "No disponible en el modo demo" : undefined}
      >
        {mutation.isPending ? "Guardando…" : "Guardar preferencias"}
      </Button>
    </form>
  )
}

// ── Theme section ─────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const

function ThemeSection({ prefs }: { prefs: UserPreferences | null }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const queryClient = useQueryClient()
  const isDemo = useIsDemo()

  useEffect(() => setMounted(true), [])

  const mutation = useMutation({
    mutationFn: async (newTheme: "light" | "dark" | "system") => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase
        .from("user_preferences")
        .update({ theme: newTheme, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] })
    },
    onError: (err: Error) => {
      toast.error("Error al guardar tema", { description: err.message })
    },
  })

  const handleThemeChange = (value: "light" | "dark" | "system") => {
    if (isDemo) return
    setTheme(value)
    mutation.mutate(value)
  }

  const activeTheme = mounted ? (theme ?? "system") : (prefs?.theme ?? "system")

  return (
    <div className="space-y-3">
      {isDemo && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          No disponible en el modo demo
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        El tema se aplica de inmediato y se guarda en tu cuenta para que se mantenga al ingresar desde otro dispositivo.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            disabled={isDemo}
            onClick={() => handleThemeChange(value)}
            title={isDemo ? "No disponible en el modo demo" : undefined}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all duration-150 press-effect",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isDemo
                ? "cursor-not-allowed opacity-50 bg-muted/40 border-border/40 text-muted-foreground"
                : "cursor-pointer",
              !isDemo && activeTheme === value
                ? "bg-primary/15 border-primary/40 text-primary"
                : !isDemo
                  ? "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted"
                  : ""
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Data section ──────────────────────────────────────────────────────────────

function DataSection() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"
  const [exporting, setExporting] = useState(false)
  const { isPremium: userIsPremium } = usePlan()

  const handleExport = async () => {
    if (!userIsPremium) return
    setExporting(true)
    try {
      await exportMovementsCSV()
      toast.success("CSV descargado correctamente")
    } catch (err) {
      toast.error("Error al exportar", { description: err instanceof Error ? err.message : "Error desconocido" })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* App version */}
      <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Versión</span>
        </div>
        <span className="text-sm font-semibold tabular-nums">{version}</span>
      </div>

      {/* Export */}
      <div className="rounded-xl border border-border/60 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Exportar mis datos</p>
          <p className="text-xs text-muted-foreground">
            {userIsPremium ? "Descargá tu historial de movimientos en CSV" : "Disponible en el plan Premium"}
          </p>
        </div>
        {userIsPremium ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="gap-1.5 cursor-pointer press-effect flex-shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Exportando…" : "Exportar CSV"}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="gap-1.5 flex-shrink-0 opacity-50 cursor-not-allowed"
            title="Función Premium"
          >
            <Download className="h-3.5 w-3.5" />
            Premium
          </Button>
        )}
      </div>

      {/* Delete account — disabled, destructive affordance */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-destructive">Eliminar cuenta</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Eliminá permanentemente tu cuenta y todos tus datos.
              Esta acción no se puede deshacer.
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-1 italic">
              Requiere confirmación del servidor — disponible próximamente.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled
            className="cursor-not-allowed opacity-50 flex-shrink-0 mt-0.5"
          >
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Security section ──────────────────────────────────────────────────────────

interface AuthMethods {
  hasGoogle: boolean
  hasPassword: boolean
}

async function fetchAuthMethods(): Promise<AuthMethods> {
  const supabase = createClient()

  // Refresh session first so the JWT reflects any recently-linked providers.
  await supabase.auth.refreshSession().catch(() => {})

  // getUserIdentities() hits the server and always returns the authoritative list,
  // unlike app_metadata.providers which can be stale right after linking.
  const { data: idData } = await supabase.auth.getUserIdentities()
  const providers: string[] = idData?.identities?.map((i) => i.provider) ?? []

  // Still need getUser() to know if the session is valid at all.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { hasGoogle: false, hasPassword: false }

  return {
    hasGoogle: providers.includes("google"),
    hasPassword: providers.includes("email"),
  }
}

const passwordSchema = z
  .object({
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  })
type PasswordFormValues = z.infer<typeof passwordSchema>

function SecuritySection() {
  const isDemo = useIsDemo()
  const [linkingGoogle, setLinkingGoogle] = useState(false)

  const { data: authMethods, isLoading } = useQuery({
    queryKey: ["auth-methods"],
    queryFn: fetchAuthMethods,
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<PasswordFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(passwordSchema) as unknown as Resolver<PasswordFormValues, any>,
    defaultValues: { password: "", confirm: "" },
  })

  const handleLinkGoogle = async () => {
    if (isDemo || linkingGoogle) return
    setLinkingGoogle(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/ajustes` },
      })
      if (error) {
        console.error("[SecuritySection] linkIdentity error:", error)
        toast.error("No se pudo vincular Google, intentá más tarde.")
      }
      // On success the browser navigates to Google — nothing else to do here
    } catch (err) {
      console.error("[SecuritySection] linkIdentity unexpected error:", err)
      toast.error("No se pudo vincular Google, intentá más tarde.")
      setLinkingGoogle(false)
    }
  }

  const passwordMutation = useMutation({
    mutationFn: async (values: PasswordFormValues) => {
      const supabase = createClient()
      // Note: if "Secure password change" is enabled in Supabase Dashboard,
      // updateUser({ password }) may require prior reauthentication. That setting
      // is off by default, so this works for most projects out of the box.
      const { error } = await supabase.auth.updateUser({ password: values.password })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Contraseña actualizada")
      reset()
    },
    onError: (err: Error) => {
      toast.error("Error al actualizar contraseña", { description: err.message })
    },
  })

  const hasGoogle = authMethods?.hasGoogle ?? false
  const hasPassword = authMethods?.hasPassword ?? false

  return (
    <div className="space-y-5">
      {isDemo && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          No disponible en el modo demo
        </p>
      )}

      {/* Google link status */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Google</p>
        {isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : hasGoogle ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
            Cuenta de Google vinculada
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full press-effect"
            disabled={linkingGoogle || isDemo}
            title={isDemo ? "No disponible en el modo demo" : undefined}
            onClick={handleLinkGoogle}
          >
            {linkingGoogle ? "Redirigiendo…" : "Vincular cuenta de Google"}
          </Button>
        )}
      </div>

      <Separator />

      {/* Password form */}
      <form onSubmit={handleSubmit((v) => passwordMutation.mutate(v))} className="space-y-4">
        <p className="text-sm font-medium">
          {hasPassword ? "Cambiar contraseña" : "Establecer contraseña"}
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="sec-password">Nueva contraseña</Label>
          <Input
            id="sec-password"
            type="password"
            autoComplete="new-password"
            disabled={isDemo}
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sec-confirm">Repetir contraseña</Label>
          <Input
            id="sec-confirm"
            type="password"
            autoComplete="new-password"
            disabled={isDemo}
            aria-invalid={!!errors.confirm}
            {...register("confirm")}
          />
          {errors.confirm && (
            <p className="text-xs text-destructive">{errors.confirm.message}</p>
          )}
        </div>

        <Button
          type="submit"
          className="press-effect"
          disabled={passwordMutation.isPending || !isDirty || isDemo}
          title={isDemo ? "No disponible en el modo demo" : undefined}
        >
          {passwordMutation.isPending
            ? "Guardando…"
            : hasPassword
              ? "Cambiar contraseña"
              : "Establecer contraseña"}
        </Button>
      </form>
    </div>
  )
}

// ── Plan section ─────────────────────────────────────────────────────────────

interface PlanProfile {
  plan: string | null
  payment_exempt: boolean | null
  mp_subscription_status: string | null
}

async function fetchPlanProfile(): Promise<PlanProfile> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { plan: null, payment_exempt: null, mp_subscription_status: null }
  const { data } = await supabase
    .from("profiles")
    .select("plan, payment_exempt, mp_subscription_status")
    .eq("id", user.id)
    .single()
  return data ?? { plan: null, payment_exempt: null, mp_subscription_status: null }
}

function PlanSection() {
  const isDemo = useIsDemo()
  const queryClient = useQueryClient()
  const { isPremium: userIsPremium, isLoading } = usePlan()
  const { data: planProfile } = useQuery<PlanProfile>({
    queryKey: PLAN_KEY,
    queryFn: fetchPlanProfile,
    staleTime: 3 * 60 * 1000,
  })
  const paymentExempt = planProfile?.payment_exempt === true
  const hasActiveSub = planProfile?.mp_subscription_status === "authorized"

  const [subscribing, setSubscribing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'annual'>('monthly')

  const monthlyFormatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(PREMIUM_PRICE_ARS)

  const annualFormatted = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(ANNUAL_PRICE_ARS)

  const handleSubscribe = async () => {
    if (isDemo || subscribing) return
    setSubscribing(true)
    try {
      const result = await subscribeToPremium(selectedInterval)
      if (result.ok) {
        window.location.href = result.initPoint
      } else {
        toast.error("No se pudo iniciar el pago", { description: result.error })
      }
    } finally {
      setSubscribing(false)
    }
  }

  const handleCancel = async () => {
    if (isDemo || cancelling) return
    const confirmed = window.confirm(
      "¿Cancelar tu suscripción Premium? Perderás el acceso a las funciones premium al final del período."
    )
    if (!confirmed) return
    setCancelling(true)
    try {
      const result = await cancelSubscription()
      if (result.ok) {
        toast.success("Suscripción cancelada. Los cambios se reflejarán en breve.")
        queryClient.invalidateQueries({ queryKey: PLAN_KEY })
      } else {
        toast.error("No se pudo cancelar", { description: result.error })
      }
    } finally {
      setCancelling(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-40" />
      </div>
    )
  }

  // Exempt (courtesy) premium
  if (paymentExempt) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">Premium (cortesía)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Tenés acceso completo a Premium de forma gratuita.
        </p>
      </div>
    )
  }

  // Paid premium
  if (hasActiveSub) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">Plan Premium</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            <Check className="h-3 w-3" aria-hidden="true" />
            activo
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Acceso ilimitado a cuentas, presupuestos, metas, recurrentes, reglas automáticas, adjuntos, export CSV e IA sin límite.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={cancelling || isDemo}
          title={isDemo ? "No disponible en el modo demo" : undefined}
          className="gap-1.5 text-muted-foreground border-border/60 hover:text-destructive hover:border-destructive/30 press-effect cursor-pointer"
        >
          {cancelling ? "Cancelando…" : "Cancelar suscripción"}
        </Button>
      </div>
    )
  }

  // Free plan
  const usageLimits = [
    { label: "Cuentas", value: "1/1" },
    { label: "Presupuestos", value: "1/1" },
    { label: "Metas", value: "1/1" },
    { label: "Recurrentes", value: "3/3" },
    { label: "IA", value: "10/día" },
    { label: "Reglas automáticas", value: "Premium" },
    { label: "Adjuntos", value: "Premium" },
    { label: "Export CSV", value: "Premium" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">Plan Free</span>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/30 divide-y divide-border/40">
        {usageLimits.map(({ label, value }) => {
          const isPremiumLabel = value === "Premium"
          return (
            <div key={label} className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  isPremiumLabel ? "text-accent/70 italic" : "text-foreground"
                )}
              >
                {value}
              </span>
            </div>
          )
        })}
      </div>

      {/* Interval toggle */}
      <div className="flex items-center rounded-xl border border-border/60 bg-muted/30 p-1 gap-1">
        {(['monthly', 'annual'] as const).map((iv) => (
          <button
            key={iv}
            type="button"
            onClick={() => setSelectedInterval(iv)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 press-effect focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selectedInterval === iv
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {iv === 'monthly' ? 'Mensual' : 'Anual'}
          </button>
        ))}
      </div>

      {/* Price display */}
      <div className="text-center space-y-0.5">
        {selectedInterval === 'monthly' ? (
          <p className="text-sm font-semibold tabular-nums">{monthlyFormatted}/mes</p>
        ) : (
          <>
            <p className="text-sm font-semibold tabular-nums">{annualFormatted}/año</p>
            <p className="text-xs text-primary font-medium">2 meses gratis (≈ 17% off)</p>
          </>
        )}
      </div>

      {isDemo && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          No disponible en el modo demo
        </p>
      )}

      <Button
        type="button"
        onClick={handleSubscribe}
        disabled={subscribing || isDemo}
        title={isDemo ? "No disponible en el modo demo" : undefined}
        className="w-full gap-2 font-semibold press-effect shadow-sm shadow-primary/20"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {subscribing
          ? "Redirigiendo…"
          : selectedInterval === 'monthly'
            ? `Mejorá a Premium · ${monthlyFormatted}/mes`
            : `Mejorá a Premium · ${annualFormatted}/año`}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        Cancelás cuando quieras. El pago se procesa con MercadoPago.
      </p>
    </div>
  )
}

// ── Settings section wrapper ──────────────────────────────────────────────────

function SettingsSection({
  id,
  icon: Icon,
  title,
  children,
}: {
  id?: string
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        {children}
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  })

  const { data: prefs, isLoading: loadingPrefs } = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
  })

  // Apply DB theme on load — once prefs are fetched
  const { setTheme, theme } = useTheme()
  const [themeApplied, setThemeApplied] = useState(false)
  useEffect(() => {
    if (prefs && !themeApplied) {
      setThemeApplied(true)
      if (prefs.theme && prefs.theme !== theme) {
        setTheme(prefs.theme)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs])

  // ?sub=ok — MercadoPago back_url success signal
  const searchParams = useSearchParams()
  const [subToastShown, setSubToastShown] = useState(false)
  useEffect(() => {
    if (!subToastShown && searchParams.get("sub") === "ok") {
      setSubToastShown(true)
      toast.success("¡Listo! Tu suscripción se está activando.", {
        description: "Puede tardar unos minutos en reflejarse. Recargá la página si no aparece.",
        duration: 8000,
      })
    }
  }, [searchParams, subToastShown])

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      {/* Page header */}
      <div className="space-y-0.5 pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground">
          Perfil, preferencias y cuenta
        </p>
      </div>

      {/* Responsive 2-column grid on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Perfil */}
        <SettingsSection id="profile" icon={User} title="Perfil">
          {loadingProfile ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <ProfileSection profile={profile ?? null} />
          )}
        </SettingsSection>

        {/* Preferencias */}
        <SettingsSection id="preferences" icon={Settings2} title="Preferencias">
          {loadingPrefs ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <PreferencesSection prefs={prefs ?? null} />
          )}
        </SettingsSection>

        {/* Tema */}
        <SettingsSection id="theme" icon={Palette} title="Tema">
          <ThemeSection prefs={prefs ?? null} />
        </SettingsSection>

        {/* Acceso y seguridad */}
        <SettingsSection id="security" icon={ShieldCheck} title="Acceso y seguridad">
          <SecuritySection />
        </SettingsSection>

        {/* Datos y cuenta */}
        <SettingsSection id="data" icon={Database} title="Datos y cuenta">
          <DataSection />
        </SettingsSection>

        {/* Plan */}
        <SettingsSection id="plan" icon={Crown} title="Plan">
          <PlanSection />
        </SettingsSection>
      </div>

      {/* Logout — full width at the bottom */}
      <div className="pb-4">
        <Separator className="mb-6" />
        <form action={signOut}>
          <Button
            type="submit"
            variant="outline"
            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50 cursor-pointer press-effect"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  )
}
