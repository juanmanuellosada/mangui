"use client"

import { useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { User, Settings2, Palette, Database, LogOut, ShieldCheck, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import { signOut } from "@/app/actions/auth"
import type { Tables } from "@/lib/database.types"
import { DataSection } from "./settings-data-section"
import { ThemeSection } from "./settings-theme-section"
import { SecuritySection } from "./settings-security-section"
import { ProfileSection } from "./settings-profile-section"
import { PreferencesSection } from "./settings-preferences-section"
import { PlanSection } from "./settings-plan-section"

type UserPreferences = Tables<"user_preferences">

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchProfile(): Promise<Tables<"profiles"> | null> {
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
  const themeAppliedRef = useRef(false)
  useEffect(() => {
    if (!prefs || themeAppliedRef.current) return

    themeAppliedRef.current = true
    if (prefs.theme && prefs.theme !== theme) {
      setTheme(prefs.theme)
    }
  }, [prefs, setTheme, theme])

  // ?sub=ok — MercadoPago back_url success signal
  const searchParams = useSearchParams()
  const subToastShownRef = useRef(false)
  useEffect(() => {
    if (!subToastShownRef.current && searchParams.get("sub") === "ok") {
      subToastShownRef.current = true
      toast.success("¡Listo! Tu suscripción se está activando.", {
        description: "Puede tardar unos minutos en reflejarse. Recargá la página si no aparece.",
        duration: 8000,
      })
    }
  }, [searchParams])

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
