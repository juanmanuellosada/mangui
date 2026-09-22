"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Moon, Monitor, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useIsDemo } from "@/lib/use-is-demo"
import type { Tables } from "@/lib/database.types"

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const

type UserPreferences = Tables<"user_preferences">

export function ThemeSection({ prefs }: { prefs: UserPreferences | null }) {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const queryClient = useQueryClient()
  const isDemo = useIsDemo()

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
