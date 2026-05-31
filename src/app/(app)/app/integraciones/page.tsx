"use client"

import { useEffect, useState, useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Bell,
  BellOff,
  CreditCard,
  Download,
  Monitor,
  Repeat,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from "@/lib/push"
import { useInstallPrompt } from "@/hooks/use-install-prompt"
import { cn } from "@/lib/utils"
import type { Tables } from "@/lib/database.types"
import type { Metadata } from "next"

type UserPreferences = Tables<"user_preferences">
type PushSubscription_ = Tables<"push_subscriptions">

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchPreferences(): Promise<UserPreferences | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single()
  if (error) throw error
  return data
}

async function fetchDevices(): Promise<PushSubscription_[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data ?? []
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDeviceName(userAgent: string | null): string {
  if (!userAgent) return "Dispositivo desconocido"
  const ua = userAgent.toLowerCase()
  if (ua.includes("safari") && ua.includes("iphone")) return "Safari · iPhone"
  if (ua.includes("safari") && ua.includes("ipad")) return "Safari · iPad"
  if (ua.includes("safari") && ua.includes("mac")) return "Safari · Mac"
  if (ua.includes("chrome") && ua.includes("android")) return "Chrome · Android"
  if (ua.includes("chrome") && ua.includes("mac")) return "Chrome · Mac"
  if (ua.includes("chrome") && ua.includes("windows")) return "Chrome · Windows"
  if (ua.includes("chrome")) return "Chrome"
  if (ua.includes("firefox")) return "Firefox"
  if (ua.includes("edg")) return "Edge"
  return "Navegador"
}

function DeviceIcon({ userAgent }: { userAgent: string | null }) {
  const ua = (userAgent ?? "").toLowerCase()
  if (ua.includes("iphone") || ua.includes("android")) {
    return <Smartphone className="h-4 w-4" />
  }
  return <Monitor className="h-4 w-4" />
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function hourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:00 ${ampm}`
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: React.ElementType
  title: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <h2 className="text-base font-semibold flex-1">{title}</h2>
        {badge}
      </div>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {children}
      </div>
    </section>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({
  icon: Icon,
  iconClassName,
  label,
  description,
  children,
  className,
}: {
  icon?: React.ElementType
  iconClassName?: string
  label: string
  description?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 border-b border-border/40 last:border-0",
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
            iconClassName ?? "bg-primary/10"
          )}
        >
          <Icon className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Online indicator badge ─────────────────────────────────────────────────────

function OnlineIndicator() {
  const [online, setOnline] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  if (!mounted) return null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
        online
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      {online ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      {online ? "En línea" : "Sin conexión"}
    </span>
  )
}

// ── Permission badge ───────────────────────────────────────────────────────────

function PermissionBadge({ status }: { status: PushStatus | null }) {
  if (!status) return null
  const map: Record<PushStatus, { label: string; className: string }> = {
    subscribed: { label: "Activadas", className: "bg-primary/10 text-primary" },
    granted: { label: "Permitidas", className: "bg-primary/10 text-primary" },
    default: { label: "Sin configurar", className: "bg-muted text-muted-foreground" },
    denied: { label: "Bloqueadas", className: "bg-destructive/10 text-destructive" },
    unsupported: { label: "No soportado", className: "bg-muted text-muted-foreground" },
  }
  const { label, className } = map[status]
  return (
    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", className)}>
      {label}
    </span>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function IntegracionesPage() {
  const queryClient = useQueryClient()
  const { canInstall, isInstalled, triggerInstall } = useInstallPrompt()
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null)
  const [pushLoading, setPushLoading] = useState(false)

  const { data: prefs, isLoading: loadingPrefs } = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences,
  })

  const { data: devices, isLoading: loadingDevices, refetch: refetchDevices } = useQuery({
    queryKey: ["push_subscriptions"],
    queryFn: fetchDevices,
  })

  // Get push status on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      getPushStatus().then(setPushStatus)
    }
  }, [])

  // ── Update preferences mutation ──────────────────────────────────────────
  const updatePrefsMutation = useMutation({
    mutationFn: async (update: Partial<Pick<UserPreferences, "push_enabled" | "card_reminder_enabled" | "notify_hour">>) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { error } = await supabase
        .from("user_preferences")
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] })
    },
    onError: (err: Error) => {
      toast.error("Error al guardar preferencias", { description: err.message })
    },
  })

  // ── Toggle push master ───────────────────────────────────────────────────
  const handlePushToggle = useCallback(async (enable: boolean) => {
    setPushLoading(true)
    try {
      if (enable) {
        const ok = await subscribeToPush()
        if (ok) {
          await updatePrefsMutation.mutateAsync({ push_enabled: true })
          setPushStatus("subscribed")
          refetchDevices()
          toast.success("Notificaciones activadas")
        }
      } else {
        const ok = await unsubscribeFromPush()
        if (ok) {
          await updatePrefsMutation.mutateAsync({ push_enabled: false })
          setPushStatus(await getPushStatus())
          refetchDevices()
          toast.success("Notificaciones desactivadas")
        }
      }
    } finally {
      setPushLoading(false)
    }
  }, [updatePrefsMutation, refetchDevices])

  // ── Delete device ────────────────────────────────────────────────────────
  const deleteDeviceMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("push_subscriptions").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["push_subscriptions"] })
      toast.success("Dispositivo eliminado")
    },
    onError: () => {
      toast.error("Error al eliminar el dispositivo")
    },
  })

  const isSubscribed = pushStatus === "subscribed"
  const isDenied = pushStatus === "denied"
  const isUnsupported = pushStatus === "unsupported"

  return (
    <div className="space-y-8 max-w-2xl animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 pt-1">
        <div className="space-y-0.5">
          <h1
            className="text-2xl md:text-3xl tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Integraciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Notificaciones push, instalación y conectividad
          </p>
        </div>
        <OnlineIndicator />
      </div>

      {/* ── Install PWA ──────────────────────────────────────────────────── */}
      <Section icon={Download} title="Instalar aplicación">
        <Row
          icon={Download}
          label="Instalá mangui en tu pantalla de inicio"
          description={
            isInstalled
              ? "La aplicación ya está instalada en este dispositivo."
              : canInstall
              ? "Añadí mangui como app para un acceso más rápido y experiencia nativa."
              : "Tu navegador gestionará la instalación automáticamente."
          }
        >
          {isInstalled ? (
            <span className="text-xs font-semibold text-primary">Instalada</span>
          ) : canInstall ? (
            <Button
              size="sm"
              onClick={triggerInstall}
              className="flex-shrink-0 cursor-pointer press-effect"
            >
              Instalar
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">No disponible</span>
          )}
        </Row>
      </Section>

      {/* ── Push notifications ───────────────────────────────────────────── */}
      <Section
        icon={Bell}
        title="Notificaciones push"
        badge={<PermissionBadge status={pushStatus} />}
      >
        {isDenied && (
          <div className="px-4 py-3 border-b border-border/40 bg-destructive/5">
            <p className="text-xs text-destructive">
              Las notificaciones están bloqueadas en tu navegador. Para activarlas, habilitá los permisos manualmente en la configuración del navegador y recargá la página.
            </p>
          </div>
        )}
        {isUnsupported && (
          <div className="px-4 py-3 border-b border-border/40 bg-muted/40">
            <p className="text-xs text-muted-foreground">
              Tu navegador no soporta notificaciones push.
            </p>
          </div>
        )}

        {/* Master toggle */}
        <Row
          icon={Bell}
          label="Activar notificaciones"
          description={
            isDenied
              ? "Permiso denegado — revisá la configuración del navegador"
              : isSubscribed
              ? "Recibirás alertas de recordatorios y vencimientos"
              : "Activá para recibir recordatorios de tarjetas y transacciones"
          }
        >
          {loadingPrefs ? (
            <Skeleton className="h-5 w-9 rounded-full" />
          ) : (
            <Switch
              checked={isSubscribed && (prefs?.push_enabled ?? false)}
              onCheckedChange={handlePushToggle}
              disabled={pushLoading || isDenied || isUnsupported}
              aria-label="Activar notificaciones push"
            />
          )}
        </Row>

        {/* Card reminders */}
        <Row
          icon={CreditCard}
          iconClassName={isSubscribed && prefs?.push_enabled ? "bg-primary/10" : "bg-muted"}
          label="Recordatorio de tarjetas"
          description="Avisos de cierre y vencimiento con 3 días de anticipación"
        >
          {loadingPrefs ? (
            <Skeleton className="h-5 w-9 rounded-full" />
          ) : (
            <Switch
              checked={(prefs?.card_reminder_enabled ?? false) && isSubscribed && (prefs?.push_enabled ?? false)}
              onCheckedChange={(v) => {
                if (!isSubscribed || !prefs?.push_enabled) {
                  toast.info("Primero activá las notificaciones push")
                  return
                }
                updatePrefsMutation.mutate({ card_reminder_enabled: v })
              }}
              disabled={!isSubscribed || !prefs?.push_enabled || updatePrefsMutation.isPending}
              aria-label="Recordatorio de tarjetas"
            />
          )}
        </Row>

        {/* Recurring transactions */}
        <Row
          icon={Repeat}
          iconClassName={isSubscribed && prefs?.push_enabled ? "bg-primary/10" : "bg-muted"}
          label="Transacciones recurrentes"
          description="Notificación cuando una transacción recurrente está pendiente"
        >
          {loadingPrefs ? (
            <Skeleton className="h-5 w-9 rounded-full" />
          ) : (
            <Switch
              checked={isSubscribed && (prefs?.push_enabled ?? false)}
              onCheckedChange={() => {
                if (!isSubscribed || !prefs?.push_enabled) {
                  toast.info("Primero activá las notificaciones push")
                  return
                }
                toast.info("Incluido cuando las notificaciones push están activas")
              }}
              disabled={!isSubscribed || !prefs?.push_enabled}
              aria-label="Transacciones recurrentes"
            />
          )}
        </Row>

        {/* Notify hour */}
        <Row
          icon={Bell}
          iconClassName="bg-muted"
          label="Hora de notificación"
          description="Hora preferida para recibir recordatorios diarios (UTC)"
        >
          {loadingPrefs ? (
            <Skeleton className="h-9 w-28" />
          ) : (
            <Select
              value={String(prefs?.notify_hour ?? 9)}
              onValueChange={(v) =>
                updatePrefsMutation.mutate({ notify_hour: parseInt(v ?? "9", 10) })
              }
              disabled={!prefs?.push_enabled || updatePrefsMutation.isPending}
            >
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)} className="text-xs">
                    {hourLabel(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Row>
      </Section>

      {/* ── Subscribed devices ───────────────────────────────────────────── */}
      <Section icon={Smartphone} title="Dispositivos suscritos">
        {loadingDevices ? (
          <div className="divide-y divide-border/40">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="h-8 w-8 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : !devices || devices.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No hay dispositivos suscritos
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Activá las notificaciones para ver los dispositivos registrados.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
                  <DeviceIcon userAgent={device.user_agent} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {parseDeviceName(device.user_agent)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Suscrito el {formatDate(device.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteDeviceMutation.mutate(device.id)}
                  disabled={deleteDeviceMutation.isPending}
                  aria-label="Eliminar dispositivo"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="pb-4" />
    </div>
  )
}
