"use client"

import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import { useIsDemo } from "@/lib/use-is-demo"

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

export function SecuritySection() {
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
