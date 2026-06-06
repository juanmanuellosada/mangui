"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useChat } from "@ai-sdk/react"
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai"
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { MovementForm, type MovementFormValues } from "@/components/movements/movement-form"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, cn } from "@/lib/utils"
import type { Account } from "@/lib/accounts"
import type { Tables } from "@/lib/database.types"
import {
  MOVEMENTS_KEY,
  BALANCES_KEY,
  ACCOUNTS_KEY,
  CATEGORIES_KEY,
} from "@/lib/movements"
import { useIsDemo } from "@/lib/use-is-demo"

type Category = Tables<"categories">

const DAILY_LIMIT = 30

// ── Name → id resolver ────────────────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function findIdByName(name: string, items: Array<{ id: string; name: string }>): string | undefined {
  const target = normalizeStr(name)
  const exact = items.find((i) => normalizeStr(i.name) === target)
  if (exact) return exact.id
  const fuzzy = items.find(
    (i) =>
      normalizeStr(i.name).includes(target) ||
      target.includes(normalizeStr(i.name))
  )
  return fuzzy?.id
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("accounts").select("*").order("created_at")
  if (error) throw error
  return data
}

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("categories").select("*").order("name")
  if (error) throw error
  return data
}

// ── Read-tool indicator ───────────────────────────────────────────────────────

const READ_TOOL_LABELS: Record<string, string> = {
  obtener_saldos: "Consultando saldos",
  estadisticas_gastos: "Calculando estadísticas",
  buscar_movimientos: "Buscando movimientos",
  pagos_futuros: "Consultando pagos futuros",
  resumenes_tarjeta: "Consultando resúmenes de tarjetas",
  estado_presupuestos: "Revisando presupuestos",
  estado_metas: "Revisando metas",
}

const READ_TOOL_DONE_LABELS: Record<string, string> = {
  obtener_saldos: "Saldos consultados",
  estadisticas_gastos: "Estadísticas calculadas",
  buscar_movimientos: "Movimientos encontrados",
  pagos_futuros: "Pagos futuros consultados",
  resumenes_tarjeta: "Resúmenes consultados",
  estado_presupuestos: "Presupuestos revisados",
  estado_metas: "Metas revisadas",
}

// ── ToolCallIndicator for read tools ──────────────────────────────────────────

function ToolCallIndicator({
  toolName,
  state,
}: {
  toolName: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
}) {
  const isLoading = state === "input-streaming" || state === "input-available"
  const isError = state === "output-error"
  const isDone = state === "output-available"

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-200",
        isLoading && "bg-muted text-muted-foreground",
        isDone && "bg-primary/8 text-primary",
        isError && "bg-destructive/8 text-destructive"
      )}
    >
      {isLoading && <Search className="h-3 w-3 animate-pulse" />}
      {isDone && <CheckCircle2 className="h-3 w-3" />}
      {isError && <XCircle className="h-3 w-3" />}
      <span>
        {isError
          ? "Error al consultar"
          : isDone
          ? (READ_TOOL_DONE_LABELS[toolName] ?? "Listo")
          : (READ_TOOL_LABELS[toolName] ?? "Consultando…")}
      </span>
    </div>
  )
}

// ── CrearMovimientoCard ───────────────────────────────────────────────────────

interface CrearMovimientoInput {
  tipo: "income" | "expense"
  monto: number
  moneda: "ARS" | "USD"
  categoria?: string
  cuenta?: string
  fecha?: string
  nota?: string
}

function CrearMovimientoCard({
  toolCallId,
  input,
  state,
  accounts,
  categories,
  onResolve,
  isDemo,
}: {
  toolCallId: string
  input: CrearMovimientoInput
  state: "input-available" | "output-available" | "output-error"
  accounts: Account[]
  categories: Category[]
  onResolve: (toolCallId: string, confirmed: boolean, summary?: string) => void
  isDemo: boolean
}) {
  const queryClient = useQueryClient()
  const [resolved, setResolved] = useState(state !== "input-available")

  // Resolve default values from tool input
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })

  const categoryId = input.categoria
    ? findIdByName(input.categoria, categories) ?? null
    : null

  const accountId = input.cuenta
    ? findIdByName(input.cuenta, accounts) ?? accounts[0]?.id ?? ""
    : accounts[0]?.id ?? ""

  const defaultValues: Partial<MovementFormValues> = {
    type: input.tipo,
    amount: input.monto,
    original_currency: input.moneda,
    category_id: categoryId,
    account_id: accountId,
    date: input.fecha ?? today,
    note: input.nota ?? "",
    is_future: false,
    dollar_type: null,
    converted_amount: null,
    cuotas: 1,
  }

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
    onSuccess: (data, values) => {
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      toast.success("Movimiento creado")
      setResolved(true)
      const categoryName = categories.find((c) => c.id === values.category_id)?.name
      const accountName = accounts.find((a) => a.id === values.account_id)?.name ?? "cuenta"
      const summary = `${values.type === "income" ? "Ingreso" : "Gasto"} de ${formatCurrency(values.amount, values.original_currency)} en ${categoryName ?? accountName} el ${values.date}`
      onResolve(toolCallId, true, summary)
    },
    onError: (err: Error) => {
      toast.error("Error al crear el movimiento", { description: err.message })
    },
  })

  const handleCancel = useCallback(() => {
    setResolved(true)
    onResolve(toolCallId, false)
  }, [toolCallId, onResolve])

  // Demo mode: show a read-only notice instead of the confirmation form.
  if (isDemo) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-muted/60 text-muted-foreground border border-border/40">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span>En modo demo no se pueden crear movimientos.</span>
      </div>
    )
  }

  if (resolved) {
    // Show a compact result badge once resolved
    const isConfirmed = state === "output-available"
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          isConfirmed ? "bg-primary/8 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        {isConfirmed ? (
          <>
            <CheckCircle2 className="h-3 w-3" />
            Movimiento creado
          </>
        ) : (
          <>
            <XCircle className="h-3 w-3" />
            Cancelado
          </>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4 w-full max-w-md">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Confirmar movimiento</p>
          <p className="text-xs text-muted-foreground">Revisá los datos antes de guardar</p>
        </div>
      </div>

      {/* Amount preview */}
      <div className="rounded-xl bg-muted/40 px-4 py-3">
        <p
          className={cn(
            "text-2xl font-bold tabular-nums",
            input.tipo === "income" ? "text-[color:var(--color-success,hsl(var(--success)))]" : "text-destructive"
          )}
        >
          {input.tipo === "income" ? "+" : "-"}
          {formatCurrency(input.monto, input.moneda)}
        </p>
      </div>

      {/* MovementForm prefilled */}
      <MovementForm
        accounts={accounts}
        categories={categories}
        defaultValues={defaultValues}
        onSubmit={async (values) => {
          await confirmMutation.mutateAsync(values)
        }}
        isLoading={confirmMutation.isPending}
        submitLabel="Confirmar y guardar"
        isCreateMode
      />

      {/* Cancel */}
      <button
        type="button"
        onClick={handleCancel}
        disabled={confirmMutation.isPending}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 py-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        Cancelar
      </button>
    </div>
  )
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  accounts,
  categories,
  onAddToolOutput,
  isDemo,
}: {
  message: UIMessage
  accounts: Account[]
  categories: Category[]
  onAddToolOutput: (toolCallId: string, confirmed: boolean, summary?: string) => void
  isDemo: boolean
}) {
  const isUser = message.role === "user"

  if (isUser) {
    // Find text parts
    const textParts = message.parts.filter((p) => p.type === "text")
    const text = textParts.map((p) => ("text" in p ? p.text : "")).join("")
    if (!text) return null

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    )
  }

  // Assistant message — iterate parts
  return (
    <div className="flex gap-2.5 items-start">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {message.parts.map((part, idx) => {
          if (part.type === "text") {
            const text = part.text
            if (!text) return null
            return (
              <div
                key={idx}
                className="rounded-2xl rounded-tl-sm bg-card border border-border/60 px-4 py-2.5"
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
              </div>
            )
          }

          // Tool parts: type is "tool-{toolname}"
          if (part.type.startsWith("tool-")) {
            const toolName = part.type.slice(5) // strip "tool-"
            const toolPart = part as {
              type: string
              toolCallId: string
              state: "input-streaming" | "input-available" | "output-available" | "output-error"
              input?: unknown
            }

            if (toolName === "crear_movimiento") {
              return (
                <CrearMovimientoCard
                  key={`${toolName}-${toolPart.toolCallId}`}
                  toolCallId={toolPart.toolCallId}
                  input={toolPart.input as CrearMovimientoInput}
                  state={toolPart.state as "input-available" | "output-available" | "output-error"}
                  accounts={accounts}
                  categories={categories}
                  onResolve={onAddToolOutput}
                  isDemo={isDemo}
                />
              )
            }

            // Read tool — show a compact indicator
            return (
              <div key={`${toolName}-${toolPart.toolCallId}`}>
                <ToolCallIndicator toolName={toolName} state={toolPart.state} />
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}

// ── Streaming cursor ──────────────────────────────────────────────────────────

function StreamingIndicator() {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="rounded-2xl rounded-tl-sm bg-card border border-border/60 px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  "¿Cuánto gasté este mes?",
  "¿Qué pagos tengo el mes que viene?",
  "Cargá un gasto de 5000 en el súper",
]

function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Greeting bubble — styled like an assistant MessageBubble, display-only */}
      <div className="flex gap-2.5 items-start">
        <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-card border border-border/60 px-4 py-2.5 max-w-[85%]">
          <p className="text-sm leading-relaxed">
            ¡Hola! Soy <strong>Manguito</strong> 🥭, tu asistente de finanzas en mangui.
          </p>
          <p className="text-sm leading-relaxed mt-1.5 text-muted-foreground">
            Puedo ayudarte a consultar saldos, ver estadísticas de gastos, decirte qué pagos se vienen (recurrentes, cuotas o vencimientos de tarjeta), buscar movimientos, revisar presupuestos y metas, y cargar un movimiento con tu confirmación.
          </p>
          <p className="text-sm leading-relaxed mt-1.5">
            ¿En qué te ayudo hoy?
          </p>
        </div>
      </div>

      {/* Example prompt chips */}
      <div className="flex flex-col gap-2 pl-9">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSend(prompt)}
            className={cn(
              "text-left px-3.5 py-2.5 rounded-xl border border-border/60 bg-card",
              "text-sm text-muted-foreground hover:text-foreground hover:border-border",
              "transition-colors duration-150 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Usage badge ───────────────────────────────────────────────────────────────

function UsageBadge({ used, unlimited }: { used: number; unlimited: boolean }) {
  if (unlimited) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium tabular-nums">
        <Sparkles className="h-3 w-3" />
        Ilimitado
      </span>
    )
  }
  const remaining = DAILY_LIMIT - used
  const isNearLimit = remaining <= 5
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        isNearLimit ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {used}/{DAILY_LIMIT} hoy
    </span>
  )
}

// ── Main AiChat component ─────────────────────────────────────────────────────

interface AiChatProps {
  initialUsed: number
  initialUnlimited: boolean
}

export function AiChat({ initialUsed, initialUnlimited }: AiChatProps) {
  const [input, setInput] = useState("")
  const [rateLimited, setRateLimited] = useState(false)
  const [rateLimitMessage, setRateLimitMessage] = useState("")
  const [generalError, setGeneralError] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isDemo = useIsDemo()

  const { data: accounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: categories = [] } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: fetchCategories,
  })

  const { messages, sendMessage, addToolOutput, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: (error: Error) => {
      // Parse 429 vs generic errors
      try {
        const parsed = JSON.parse(error.message)
        if (parsed?.error === "rate_limited") {
          setRateLimited(true)
          setRateLimitMessage(parsed.message ?? "Límite diario alcanzado.")
          return
        }
      } catch {
        // not JSON
      }
      setGeneralError("Ocurrió un error al procesar tu mensaje. Intentá de nuevo.")
    },
  })

  const isStreaming = status === "submitted" || status === "streaming"
  const isReady = status === "ready" || status === "error"

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return
      setRateLimited(false)
      setGeneralError("")
      sendMessage({ role: "user", parts: [{ type: "text", text: trimmed }] })
      setInput("")
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    },
    [isStreaming, sendMessage]
  )

  const handleAddToolOutput = useCallback(
    (toolCallId: string, confirmed: boolean, summary?: string) => {
      if (confirmed) {
        addToolOutput({
          tool: "crear_movimiento" as never,
          toolCallId,
          output: { confirmed: true, summary: summary ?? "Movimiento creado" } as never,
        })
      } else {
        addToolOutput({
          tool: "crear_movimiento" as never,
          toolCallId,
          output: { confirmed: false } as never,
        })
      }
    },
    [addToolOutput]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    // Auto-grow textarea
    e.target.style.height = "auto"
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full" style={{ minHeight: "calc(100dvh - 8rem)" }}>
      {/* Header row with usage */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <h1
            className="text-base font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Asistente IA
          </h1>
        </div>
        <UsageBadge used={initialUsed} unlimited={initialUnlimited} />
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
        {!hasMessages ? (
          <EmptyState onSend={handleSend} />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                accounts={accounts}
                categories={categories}
                onAddToolOutput={handleAddToolOutput}
                isDemo={isDemo}
              />
            ))}
            {isStreaming && <StreamingIndicator />}
          </>
        )}

        {/* Rate limit banner */}
        {rateLimited && (
          <div className="flex items-start gap-2.5 rounded-xl bg-destructive/5 border border-destructive/20 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Límite diario alcanzado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rateLimitMessage || `Usaste los ${DAILY_LIMIT} mensajes de hoy. Se renueva a las 00:00 hora argentina.`}
              </p>
            </div>
          </div>
        )}

        {/* Generic error banner */}
        {generalError && !rateLimited && (
          <div className="flex items-start gap-2.5 rounded-xl bg-destructive/5 border border-destructive/20 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{generalError}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 pt-3 border-t border-border/60 pb-safe">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu pregunta…"
            rows={1}
            disabled={isStreaming || rateLimited}
            className={cn(
              "flex-1 resize-none rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm",
              "placeholder:text-muted-foreground leading-relaxed",
              "focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30",
              "transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[40px] max-h-[120px]"
            )}
            aria-label="Mensaje para el asistente"
          />
          <Button
            type="button"
            size="icon"
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isStreaming || rateLimited}
            className="h-10 w-10 rounded-xl flex-shrink-0 press-effect"
            aria-label="Enviar"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          La IA sugiere; vos confirmás antes de guardar.
        </p>
      </div>
    </div>
  )
}
