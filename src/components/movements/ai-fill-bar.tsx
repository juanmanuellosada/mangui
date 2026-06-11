"use client"

import { useState } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useIsDemo } from "@/lib/use-is-demo"
import { VoiceInputButton } from "@/components/ai/voice-input-button"

export interface AiExtractResult {
  type: "income" | "expense"
  amount: number
  original_currency: "ARS" | "USD"
  categoria: string | null
  cuenta: string | null
  fecha: string | null
  nota: string | null
  cuotas: number | null
}

export function AiFillBar({
  accounts,
  categories,
  onResult,
}: {
  accounts: { name: string }[]
  categories: { name: string; type: string }[]
  onResult: (r: AiExtractResult) => void
}) {
  const isDemo = useIsDemo()
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)

  if (isDemo) return null

  async function submitAudio(wav: Blob) {
    if (loading) return
    setLoading(true)
    try {
      const form = new FormData()
      form.append("audio", wav, "audio.wav")
      form.append("accounts", JSON.stringify(accounts.map((a) => a.name)))
      form.append("categories", JSON.stringify(categories.map((c) => ({ name: c.name, type: c.type }))))
      const res = await fetch("/api/ai/extract-movement", { method: "POST", body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.message || data?.error || "No pude interpretar el movimiento.")
        return
      }
      const data = (await res.json()) as AiExtractResult
      onResult(data)
      toast.success("Movimiento interpretado por voz. Revisalo antes de guardar.")
    } catch {
      toast.error("Error al conectar con la IA.")
    } finally {
      setLoading(false)
    }
  }

  async function submit(override?: string) {
    const t = (override ?? text).trim()
    if (!t || loading) return
    setLoading(true)
    try {
      const res = await fetch("/api/ai/extract-movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: t,
          accounts: accounts.map((a) => a.name),
          categories: categories.map((c) => ({ name: c.name, type: c.type })),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.message || data?.error || "No pude interpretar el movimiento.")
        return
      }
      const data = (await res.json()) as AiExtractResult
      onResult(data)
      setText("")
      toast.success("Campos completados con IA. Revisalos antes de guardar.")
    } catch {
      toast.error("Error al conectar con la IA.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-2.5 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Rellenar con IA
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit() } }}
          placeholder="Ej: gasté 5000 en el súper con la Visa"
          disabled={loading}
          className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <VoiceInputButton onAudio={submitAudio} disabled={loading} className="h-9 w-9 rounded-lg" />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !text.trim()}
          className={cn(
            "shrink-0 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold",
            "bg-primary text-primary-foreground press-effect cursor-pointer",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Pensando…" : "Completar"}
        </button>
      </div>
    </div>
  )
}
