"use client"

import { useEffect, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTheme } from "next-themes"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { User, Settings2, Palette, Tag, Database, LogOut, Sun, Moon, Monitor, Info } from "lucide-react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { CategoriesManager } from "@/components/settings/categories-manager"
import { createClient } from "@/lib/supabase/client"
import { signOut } from "@/app/actions/auth"
import { cn } from "@/lib/utils"
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

// ── Profile section ───────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
})
type ProfileFormValues = z.infer<typeof profileSchema>

function ProfileSection({ profile }: { profile: Profile | null }) {
  const queryClient = useQueryClient()

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
        disabled={mutation.isPending || !isDirty}
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
      {/* Default currency */}
      <div className="space-y-1.5">
        <Label>Moneda predeterminada</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["ARS", "USD"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue("default_currency", c, { shouldDirty: true })}
              className={cn(
                "h-10 rounded-xl text-sm font-semibold border transition-all duration-150 cursor-pointer press-effect",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                currency === c
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted"
              )}
            >
              {c === "ARS" ? "Pesos (ARS)" : "Dólares (USD)"}
            </button>
          ))}
        </div>
      </div>

      {/* Rate type */}
      <div className="space-y-1.5">
        <Label>Tipo de cotización USD</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(RATE_TYPE_LABELS) as [keyof typeof RATE_TYPE_LABELS, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setValue("rate_type", key, { shouldDirty: true })}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 cursor-pointer press-effect",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                rateType === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border/60 text-muted-foreground hover:border-primary/50"
              )}
            >
              {label}
            </button>
          ))}
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
        disabled={mutation.isPending || !isDirty}
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
    setTheme(value)
    mutation.mutate(value)
  }

  const activeTheme = mounted ? (theme ?? "system") : (prefs?.theme ?? "system")

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        El tema se aplica de inmediato y se guarda en tu cuenta para que se mantenga al ingresar desde otro dispositivo.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleThemeChange(value)}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all duration-150 cursor-pointer press-effect",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeTheme === value
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted"
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
  // Read version from environment (set at build time) or fallback
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"

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

      {/* Export — TODO */}
      <div className="rounded-xl border border-border/60 px-4 py-3 flex items-center justify-between opacity-60">
        <div>
          <p className="text-sm font-medium">Exportar mis datos</p>
          <p className="text-xs text-muted-foreground">Descargá tu historial en CSV / JSON</p>
        </div>
        <Button variant="outline" size="sm" disabled className="cursor-not-allowed">
          Próximamente
        </Button>
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

  return (
    <div className="space-y-8 max-w-2xl animate-fade-in">
      {/* Page header */}
      <div className="space-y-0.5 pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground">
          Perfil, preferencias y categorías
        </p>
      </div>

      {/* Profile */}
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

      {/* Preferences */}
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

      {/* Theme */}
      <SettingsSection id="theme" icon={Palette} title="Tema">
        <ThemeSection prefs={prefs ?? null} />
      </SettingsSection>

      {/* Categories */}
      <SettingsSection id="categories" icon={Tag} title="Categorías">
        <CategoriesManager />
      </SettingsSection>

      {/* Data / account */}
      <SettingsSection id="data" icon={Database} title="Datos y cuenta">
        <DataSection />
      </SettingsSection>

      {/* Logout */}
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
