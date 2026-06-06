"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Bot,
  Mic,
  MicOff,
  Loader2,
  Sparkles,
  X,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MovementForm, type MovementFormValues } from "@/components/movements/movement-form"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, cn } from "@/lib/utils"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import {
  MOVEMENTS_KEY,
  BALANCES_KEY,
  ACCOUNTS_KEY,
} from "@/lib/movements"

type Category = Tables<"categories">

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedDraft extends MovementFormValues {
  type: "income" | "expense"
}

interface DetectedInfo {
  categoryName: string | null
  accountName: string | null
  currency: "ARS" | "USD"
}

// ── Web Speech API types ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionConstructor = new () => any

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// ── Chip ──────────────────────────────────────────────────────────────────────

function DetectedChip({
  label,
  value,
  detected,
}: {
  label: string
  value: string | null
  detected: boolean
}) {
  if (!value) return null
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        detected
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      <span className="text-muted-foreground">{label}:</span>
      {value}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface AiQuickAddSheetProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  accounts: Account[]
  categories: Category[]
}

type SheetView = "input" | "confirm"

export function AiQuickAddSheet({
  open,
  onOpenChange,
  accounts,
  categories,
}: AiQuickAddSheetProps) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<SheetView>("input")
  const [text, setText] = useState("")
  const [draft, setDraft] = useState<ParsedDraft | null>(null)
  const [detected, setDetected] = useState<DetectedInfo | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [hasSpeech, setHasSpeech] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // Check speech API support on mount
  useEffect(() => {
    setHasSpeech(!!getSpeechRecognition())
  }, [])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setText("")
      setDraft(null)
      setDetected(null)
      setView("input")
      stopListening()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function stopListening() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }

  function toggleSpeech() {
    if (isListening) {
      stopListening()
      return
    }
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = "es-AR"
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ""
      if (transcript) {
        setText((prev) => (prev ? `${prev} ${transcript}` : transcript))
      }
      stopListening()
    }

    recognition.onerror = () => {
      stopListening()
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
    setIsListening(true)
  }

  // Parse mutation
  const parseMutation = useMutation({
    mutationFn: async (input: string) => {
      const res = await fetch("/api/ai/parse-movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw Object.assign(new Error(data.message ?? data.error ?? "Error al interpretar"), {
          code: data.error,
        })
      }
      return data as { draft: ParsedDraft; detected: DetectedInfo }
    },
    onSuccess: (data) => {
      setDraft(data.draft)
      setDetected(data.detected)
      setView("confirm")
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === "no_key") {
        toast.error("Sin API key configurada", {
          description: (
            <span>
              {err.message}{" "}
              <Link href="/ia" className="underline font-medium" onClick={() => onOpenChange(false)}>
                Configurar →
              </Link>
            </span>
          ),
          duration: 6000,
        })
      } else {
        toast.error("No se pudo interpretar", { description: err.message })
      }
    },
  })

  // Confirm mutation (creates the movement)
  const confirmMutation = useMutation({
    mutationFn: async (values: MovementFormValues) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      const account = accounts.find((a) => a.id === values.account_id)
      const isCross = account && values.original_currency !== account.currency

      const { data, error } = await supabase
        .from("movements")
        .insert({
          user_id: user.id,
          type: values.type,
          amount: values.amount,
          original_currency: values.original_currency,
          account_id: values.account_id,
          category_id: values.category_id,
          date: values.date,
          note: values.note || null,
          is_future: values.is_future,
          dollar_type: isCross ? values.dollar_type : null,
          converted_amount: isCross ? values.converted_amount : null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Movimiento creado")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error("Error al crear el movimiento", { description: err.message })
    },
  })

  const handleInterpret = () => {
    if (!text.trim()) return
    parseMutation.mutate(text.trim())
  }

  const handleEdit = () => {
    setView("input")
  }

  // Display amount for the result card
  const displayAmount =
    draft
      ? formatCurrency(draft.amount, draft.original_currency)
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92dvh] overflow-y-auto" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <DialogTitle>Cargar con IA</DialogTitle>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        {view === "input" && (
          <div className="space-y-4">
            {/* Text area */}
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribí lo que gastaste… ej: 'gasté 5000 en el súper con la Visa ayer'"
                rows={4}
                className={cn(
                  "w-full resize-none rounded-xl border border-border/60 bg-background px-4 py-3 text-sm",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30",
                  "transition-colors duration-150"
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    handleInterpret()
                  }
                }}
                aria-label="Descripción del movimiento"
              />
              {hasSpeech && (
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className={cn(
                    "absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isListening
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/20 animate-pulse"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  )}
                  aria-label={isListening ? "Detener grabación" : "Dictar por micrófono"}
                  title={isListening ? "Detener grabación" : "Dictar por micrófono"}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>

            {isListening && (
              <p className="text-xs text-destructive flex items-center gap-1.5 -mt-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                Grabando… hablá ahora
              </p>
            )}

            {parseMutation.isError && (
              <div className="flex items-start gap-2 rounded-xl bg-destructive/5 border border-destructive/20 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  {parseMutation.error?.message ?? "Error al interpretar el texto"}
                </p>
              </div>
            )}

            <Button
              onClick={handleInterpret}
              disabled={!text.trim() || parseMutation.isPending}
              className="w-full font-semibold press-effect"
            >
              {parseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Interpretando…
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4" />
                  Interpretar
                </>
              )}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              La IA sugiere; vos confirmás antes de guardar.
            </p>
          </div>
        )}

        {view === "confirm" && draft && (
          <div className="space-y-5">
            {/* Result summary */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Resultado interpretado
              </p>

              {/* Amount card */}
              <div className="rounded-xl border border-border/60 bg-card px-4 py-3.5 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                      draft.type === "income" ? "bg-success/10" : "bg-destructive/10"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-bold",
                        draft.type === "income" ? "text-success" : "text-destructive"
                      )}
                    >
                      {draft.type === "income" ? "ING" : "GAS"}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p
                      className={cn(
                        "text-2xl font-bold tabular-nums",
                        draft.type === "income" ? "text-success" : "text-destructive"
                      )}
                    >
                      {displayAmount}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{draft.date}</p>
                  </div>
                </div>

                {/* Detected chips */}
                <div className="flex flex-wrap gap-1.5">
                  <DetectedChip
                    label="Categoría"
                    value={detected?.categoryName ?? null}
                    detected={!!draft.category_id}
                  />
                  <DetectedChip
                    label="Cuenta"
                    value={
                      detected?.accountName ??
                      (draft.account_id
                        ? accounts.find((a) => a.id === draft.account_id)?.name ?? null
                        : null)
                    }
                    detected={!!draft.account_id}
                  />
                  {draft.note && (
                    <DetectedChip label="Nota" value={draft.note} detected />
                  )}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Bot className="h-3 w-3" />
                La IA nunca guarda en tu cuenta — confirmación requerida.
              </p>
            </div>

            {/* Edit button — goes back to input view */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Confirmar y editar
              </p>
              <button
                type="button"
                onClick={handleEdit}
                className="text-xs text-primary hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Editar texto
              </button>
            </div>

            {/* MovementForm pre-filled with draft — user must confirm */}
            <MovementForm
              accounts={accounts}
              categories={categories}
              defaultValues={draft}
              onSubmit={async (values) => {
                await confirmMutation.mutateAsync(values)
              }}
              isLoading={confirmMutation.isPending}
              submitLabel="Confirmar movimiento"
              isCreateMode
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
