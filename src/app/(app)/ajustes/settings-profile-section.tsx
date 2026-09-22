"use client"

import { useEffect, useRef } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/client"
import { uploadAvatar, avatarPathFromPublicUrl } from "@/lib/avatar"
import { cn } from "@/lib/utils"
import { useIsDemo } from "@/lib/use-is-demo"
import type { Tables } from "@/lib/database.types"

type Profile = Tables<"profiles">

function getInitials(name: string | null): string {
  if (!name) return "U"
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

const profileSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
})
type ProfileFormValues = z.infer<typeof profileSchema>

export function ProfileSection({ profile }: { profile: Profile | null }) {
  const queryClient = useQueryClient()
  const isDemo = useIsDemo()
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const avatarUrl = await uploadAvatar(supabase, user.id, file)
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      toast.success("Foto de perfil actualizada")
    },
    onError: (err: Error) => {
      toast.error("Error al subir la foto", { description: err.message })
    },
  })

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      if (profile?.avatar_url) {
        const path = avatarPathFromPublicUrl(profile.avatar_url)
        if (path) await supabase.storage.from("icons").remove([path])
      }
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq("id", user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      toast.success("Foto de perfil eliminada")
    },
    onError: (err: Error) => {
      toast.error("Error al quitar la foto", { description: err.message })
    },
  })

  function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) avatarMutation.mutate(file)
  }

  const avatarBusy = avatarMutation.isPending || removeAvatarMutation.isPending

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={isDemo || avatarBusy}
          onChange={handleAvatarFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDemo || avatarBusy}
          title={isDemo ? "No disponible en el modo demo" : "Cambiar foto"}
          className={cn(
            "relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isDemo || avatarBusy ? "cursor-not-allowed" : "cursor-pointer group"
          )}
        >
          <Avatar className="h-16 w-16">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.name ?? ""} />}
            <AvatarFallback className="text-xl bg-primary text-primary-foreground font-semibold">
              {getInitials(profile?.name ?? null)}
            </AvatarFallback>
          </Avatar>
          {!isDemo && (
            <span className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <Camera className="h-5 w-5 text-white" />
            </span>
          )}
        </button>
        <div>
          <p className="text-sm font-medium">{profile?.name ?? "Usuario"}</p>
          <p className="text-xs text-muted-foreground">{profile?.email ?? ""}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isDemo || avatarBusy}
              title={isDemo ? "No disponible en el modo demo" : undefined}
              className={cn(
                "text-[11px] font-medium text-primary hover:underline",
                (isDemo || avatarBusy) && "opacity-50 cursor-not-allowed hover:no-underline"
              )}
            >
              {avatarMutation.isPending ? "Subiendo…" : "Cambiar foto"}
            </button>
            {profile?.avatar_url && (
              <button
                type="button"
                onClick={() => removeAvatarMutation.mutate()}
                disabled={isDemo || avatarBusy}
                title={isDemo ? "No disponible en el modo demo" : undefined}
                className={cn(
                  "text-[11px] font-medium text-muted-foreground hover:text-destructive hover:underline",
                  (isDemo || avatarBusy) && "opacity-50 cursor-not-allowed hover:no-underline"
                )}
              >
                {removeAvatarMutation.isPending ? "Quitando…" : "Quitar foto"}
              </button>
            )}
          </div>
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
