"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Bot,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Lock,
  ShieldCheck,
  Trash2,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MangoSelect } from "@/components/ui/mango-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  getAiSettings,
  saveAiSettings,
  removeAiKey,
  type AiProvider,
} from "@/app/actions/ai-settings"

// ── Provider config ───────────────────────────────────────────────────────────

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: "google", label: "Google Gemini" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic Claude" },
]

const MODELS: Record<AiProvider, { value: string; label: string }[]> = {
  google: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (recomendado)" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  ],
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o mini (recomendado)" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  ],
  anthropic: [
    { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku (recomendado)" },
    { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-opus-latest", label: "Claude 3 Opus" },
  ],
}

const KEY_LINKS: Record<AiProvider, { label: string; href: string }> = {
  google: { label: "Obtener key en Google AI Studio", href: "https://aistudio.google.com/apikey" },
  openai: { label: "Obtener key en OpenAI", href: "https://platform.openai.com/api-keys" },
  anthropic: { label: "Obtener key en Anthropic", href: "https://console.anthropic.com/settings/keys" },
}

const PROVIDER_NOTES: Record<AiProvider, string | null> = {
  google: "Gemini tiene capa gratuita sin necesidad de tarjeta de crédito.",
  openai: null,
  anthropic: null,
}

// ── Form schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  provider: z.enum(["google", "openai", "anthropic"]),
  model: z.string().min(1),
  apiKey: z.string(),
})
type FormValues = z.infer<typeof schema>

// ── Settings query key ────────────────────────────────────────────────────────

const AI_SETTINGS_KEY = ["ai_settings"] as const

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IASettingsPage() {
  const queryClient = useQueryClient()
  const [replacing, setReplacing] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isRemoving, startRemoveTransition] = useTransition()

  const { data, isLoading } = useQuery({
    queryKey: AI_SETTINGS_KEY,
    queryFn: async () => {
      const res = await getAiSettings()
      if (!res.ok) throw new Error(res.error)
      return res
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as unknown as Resolver<FormValues, any>,
    defaultValues: {
      provider: "google",
      model: "gemini-2.0-flash",
      apiKey: "",
    },
  })

  // Sync form with loaded data
  useEffect(() => {
    if (data && data.ok) {
      const provider = data.provider
      const defaultModel = MODELS[provider][0].value
      reset({
        provider,
        model: data.model ?? defaultModel,
        apiKey: "",
      })
    }
  }, [data, reset])

  const provider = watch("provider")
  const model = watch("model")

  // When provider changes, reset model to first option
  useEffect(() => {
    const available = MODELS[provider]
    const current = model
    if (!available.find((m) => m.value === current)) {
      setValue("model", available[0].value, { shouldDirty: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  const hasKey = data?.ok ? data.hasKey : false
  const showKeyInput = !hasKey || replacing

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const res = await saveAiSettings({
        provider: values.provider,
        model: values.model,
        apiKey: values.apiKey || undefined,
      })
      if (res.ok) {
        toast.success("Configuración de IA guardada")
        setReplacing(false)
        setShowKey(false)
        queryClient.invalidateQueries({ queryKey: AI_SETTINGS_KEY })
        reset({ provider: values.provider, model: values.model, apiKey: "" })
      } else {
        toast.error("Error al guardar", { description: res.error })
      }
    })
  }

  const handleRemoveKey = () => {
    startRemoveTransition(async () => {
      const res = await removeAiKey()
      if (res.ok) {
        toast.success("API key eliminada")
        setReplacing(false)
        queryClient.invalidateQueries({ queryKey: AI_SETTINGS_KEY })
      } else {
        toast.error("Error al eliminar la key", { description: res.error })
      }
    })
  }

  const keyLink = KEY_LINKS[provider]
  const providerNote = PROVIDER_NOTES[provider]

  return (
    <div className="space-y-8 max-w-2xl animate-fade-in">
      {/* Header */}
      <div className="space-y-0.5 pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Inteligencia artificial
        </h1>
        <p className="text-sm text-muted-foreground">
          Configurá tu propia API key para usar la carga inteligente de movimientos.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Provider segmented selector */}
          <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Proveedor
              </Label>
              <div className="flex rounded-xl bg-muted p-1 gap-1">
                {PROVIDERS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setValue("provider", value, { shouldDirty: true })
                    }}
                    className={cn(
                      "flex-1 h-9 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer px-2",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      provider === value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model select */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Modelo</Label>
              <MangoSelect
                value={model}
                onChange={(v) => v && setValue("model", v, { shouldDirty: true })}
                options={MODELS[provider].map((m) => ({ value: m.value, label: m.label }))}
                aria-label="Modelo de IA"
              />
              <p className="text-[11px] text-muted-foreground">
                {MODELS[provider][0].value} es el modelo recomendado para esta función.
              </p>
            </div>

            <Separator />

            {/* API Key section */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground font-medium">API key</Label>

              {hasKey && !replacing ? (
                /* Key is configured — show masked state */
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-primary flex-1">Configurada</span>
                    <span className="text-xs text-muted-foreground font-mono tracking-widest">
                      ••••••••••••
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 cursor-pointer press-effect"
                      onClick={() => setReplacing(true)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reemplazar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 cursor-pointer press-effect"
                      onClick={handleRemoveKey}
                      disabled={isRemoving}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isRemoving ? "Eliminando…" : "Quitar"}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Key input */
                <div className="space-y-2">
                  {replacing && (
                    <p className="text-xs text-muted-foreground">
                      Ingresá tu nueva API key para reemplazar la existente.
                    </p>
                  )}
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showKey ? "text" : "password"}
                      placeholder={`Pegá tu ${provider === "google" ? "AIza…" : provider === "openai" ? "sk-…" : "sk-ant-…"}`}
                      autoComplete="off"
                      spellCheck={false}
                      className="pr-10 font-mono text-sm"
                      {...register("apiKey")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      aria-label={showKey ? "Ocultar key" : "Mostrar key"}
                    >
                      {showKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.apiKey && (
                    <p className="text-xs text-destructive">{errors.apiKey.message}</p>
                  )}
                  {replacing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground cursor-pointer"
                      onClick={() => {
                        setReplacing(false)
                        setValue("apiKey", "")
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Promo note */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                Usá tu propia API key.
                {providerNote && (
                  <span className="text-muted-foreground font-normal">
                    {" "}{providerNote}
                  </span>
                )}
              </p>
              <a
                href={keyLink.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer"
              >
                {keyLink.label}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-primary" />
              <span>
                La key se guarda encriptada con AES-256 en nuestros servidores. Nunca se comparte ni se transmite al cliente.
              </span>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="press-effect font-semibold"
            disabled={isPending || (!isDirty && !replacing)}
          >
            {isPending ? "Guardando…" : "Guardar configuración"}
          </Button>
        </form>
      )}

      {/* Security info card */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold">Privacidad y seguridad</h2>
        </div>
        <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <li className="flex items-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
            <span>Tu API key se cifra con AES-256-GCM antes de guardarse en la base de datos.</span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
            <span>El cliente (navegador) nunca recibe la key — solo el servidor la descifra para llamar al proveedor.</span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
            <span>La IA nunca guarda movimientos sin que vos los confirmés.</span>
          </li>
        </ul>
      </div>

      {/* Link back to settings */}
      <div className="pb-4">
        <Link
          href="/app/ajustes"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer"
        >
          ← Volver a Configuración
        </Link>
      </div>
    </div>
  )
}
