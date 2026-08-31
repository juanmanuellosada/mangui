"use client"

/**
 * ImportStatementFlow — botón + MangoSheet para importar un resumen de
 * tarjeta desde un PDF (interpretado por IA en el backend, fase 1 ya hecha).
 *
 * Paso 1 (upload): elegir tarjeta + PDF, llamar a importStatementPdf.
 * Paso 2 (review): preview AGRUPADA POR RESUMEN (el ciclo leído + cada ciclo
 * futuro que recibe cuotas proyectadas), con aprobación resumen por resumen.
 * Las cuotas futuras se derivan en vivo de la línea fuente (misma
 * StatementReviewLine): editarla en el grupo del resumen leído propaga el
 * cambio automáticamente a sus cuotas proyectadas, porque groupStatementPreviewByCycle
 * siempre re-deriva la preview a partir de esa única fuente.
 */

import { useCallback, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, Clock, FileText, FileUp, Loader2, Repeat, Sparkles, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { MangoSelect, type MangoSelectOption } from "@/components/ui/mango-select"
import { MangoDatePicker } from "@/components/ui/mango-date-picker"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { Switch } from "@/components/ui/switch"
import { UpgradeLink } from "@/components/ui/upgrade-link"
import { createClient } from "@/lib/supabase/client"
import { resolveEntity } from "@/lib/entity-resolver"
import { uploadAttachment } from "@/lib/attachments"
import { toDateString, nextCloseDate, computeDueDate, dayOfMonth } from "@/lib/cards"
import { amountInCurrency } from "@/lib/money"
import { todayAR } from "@/lib/date-utils"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import { useIsDemo } from "@/lib/use-is-demo"
import { MOVEMENTS_KEY, ACCOUNTS_KEY, BALANCES_KEY } from "@/lib/movements"
import { RECURRING_KEY } from "@/lib/recurring"
import { formatCurrency, cn } from "@/lib/utils"
import {
  importStatementPdf,
  buildStatementPayload,
  groupStatementPreviewByCycle,
  saveImportedStatement,
  StatementImportError,
  type ParsedStatement,
  type StatementReviewLine,
  type StatementPreviewGroup,
  type StatementPreviewLine,
} from "@/lib/statement-import"
import type { Tables } from "@/lib/database.types"

type Account = Tables<"accounts">
type Category = Tables<"categories">

export const MAX_PDF_SIZE = 15 * 1024 * 1024 // 15 MB
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024 // límite propio de uploadAttachment

/** Exportada: reusada por corroborate-statement-flow.tsx (Grupo 3) para las líneas "falta" del diff. */
export interface ReviewLine extends StatementReviewLine {
  id: string
}

type Step = "upload" | "review"

/** Exportada: reusada por corroborate-statement-flow.tsx para matchear category_hint de la IA. */
export function matchCategoryId(hint: string | null, expenseCategories: Category[]): string | null {
  const result = resolveEntity(hint, expenseCategories)
  return result.resolved ? result.id : null
}

/**
 * Despoja el `id` local (sólo para React keys) antes de pasarle la línea a la
 * lógica pura. Exportada: reusada por corroborate-statement-flow.tsx.
 */
export function toStatementReviewLine(l: ReviewLine): StatementReviewLine {
  return {
    description: l.description,
    date: l.date,
    amount: l.amount,
    currency: l.currency,
    amount_ars: l.amount_ars,
    installment_number: l.installment_number,
    installment_total: l.installment_total,
    is_subscription: l.is_subscription,
    is_refund: l.is_refund,
    settles_previous: l.settles_previous,
    category_id: l.category_id,
    selected: l.selected,
    createRecurring: l.createRecurring,
  }
}

/** Título/subtítulo de cabecera de grupo: el ciclo leído vs. un ciclo futuro proyectado. */
function groupPeriodLabel(offset: number, closeDate: string, dueDate: string): { title: string; subtitle: string } {
  if (offset === 0) {
    return {
      title: "Este resumen",
      subtitle: `Cierra ${format(parseISO(closeDate), "d MMM", { locale: es })} · Vence ${format(parseISO(dueDate), "d MMM", { locale: es })}`,
    }
  }
  const monthLabel = format(parseISO(closeDate), "MMMM yyyy", { locale: es })
  return {
    title: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
    subtitle: "Cuotas proyectadas de este import",
  }
}

// ── Line row (editable — sólo grupo del resumen leído) ──────────────────────────
// Exportada: reusada por corroborate-statement-flow.tsx (Grupo 3, sección FALTA).

export function LineRow({
  line,
  accountCurrency,
  categoryOptions,
  onChange,
}: {
  line: ReviewLine
  accountCurrency: "ARS" | "USD"
  categoryOptions: MangoSelectOption[]
  onChange: (patch: Partial<ReviewLine>) => void
}) {
  const isCrossCurrency = line.currency !== accountCurrency
  const isInstallment = line.installment_number != null && line.installment_total != null

  return (
    <div className={cn("flex items-start gap-2 p-3", !line.selected && "opacity-50")}>
      <input
        type="checkbox"
        checked={line.selected}
        onChange={(e) => onChange({ selected: e.target.checked })}
        className="h-4 w-4 mt-2 rounded border-input accent-primary cursor-pointer flex-shrink-0"
        aria-label={`Incluir ${line.description}`}
      />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Input
            value={line.description}
            onChange={(e) => onChange({ description: e.target.value })}
            className="h-8 text-sm font-medium flex-1"
            aria-label="Descripción"
          />
          <span
            className={cn(
              "text-sm font-bold tabular-nums flex-shrink-0",
              line.is_refund ? "text-success" : "text-destructive"
            )}
          >
            {line.is_refund ? "+ " : "− "}
            {formatCurrency(line.amount, line.currency)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="tabular-nums">{format(parseISO(line.date), "d MMM", { locale: es })}</span>
          {line.is_refund && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-success/10 font-semibold text-success">
              {line.settles_previous ? "Reintegro del resumen anterior" : "Reintegro"}
            </span>
          )}
          {isInstallment && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted font-semibold">
              cuota {line.installment_number}/{line.installment_total}
            </span>
          )}
          {isCrossCurrency && line.amount_ars != null && (
            <span>≈ {formatCurrency(line.amount_ars, accountCurrency)}</span>
          )}
        </div>
        {line.settles_previous && (
          <p className="text-[10.5px] text-muted-foreground">
            El banco lo acreditó contra el saldo del resumen anterior, así que no resta del total a pagar de
            éste. Lo cargamos igual para que el saldo de la tarjeta quede bien.
          </p>
        )}
        <MangoSelect
          value={line.category_id ?? ""}
          onChange={(v) => onChange({ category_id: v || null })}
          options={categoryOptions}
          placeholder="Sin categoría"
          showSearch
          aria-label="Categoría"
        />
        {isInstallment && line.installment_total! > line.installment_number! && (
          <p className="text-[10.5px] text-muted-foreground">
            Los cambios se aplican a esta y a las {line.installment_total! - line.installment_number!} cuotas
            futuras proyectadas.
          </p>
        )}
        {!isInstallment && !line.is_refund && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-medium">Crear como recurrente</span>
              {line.is_subscription && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary flex-shrink-0">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  Manguito la detectó
                </span>
              )}
            </div>
            <Switch
              checked={line.createRecurring === true}
              onCheckedChange={(v) => onChange({ createRecurring: v })}
              aria-label="Crear como recurrente"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Línea proyectada (grupos futuros — sólo lectura) ─────────────────────────────

function ProjectedLineRow({ line, categories }: { line: StatementPreviewLine; categories: Category[] }) {
  const category = categories.find((c) => c.id === line.category_id) ?? null
  const isProjectedRecurring = line.projectedRecurring === true

  return (
    <div className={cn("flex items-start gap-2 p-3", isProjectedRecurring && "bg-primary/5")}>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm font-medium truncate", isProjectedRecurring && "text-muted-foreground")}>
            {line.description}
          </span>
          <span
            className={cn(
              "text-sm font-bold tabular-nums flex-shrink-0",
              isProjectedRecurring ? "text-muted-foreground" : "text-destructive"
            )}
          >
            − {formatCurrency(line.amount, line.currency)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="tabular-nums">{format(parseISO(line.date), "d MMM", { locale: es })}</span>
          {isProjectedRecurring ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 font-semibold text-primary">
              <Repeat className="h-2.5 w-2.5" aria-hidden />
              Recurrente · se genera sola
            </span>
          ) : (
            line.installment_number != null &&
            line.installment_total != null && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted font-semibold">
                cuota {line.installment_number}/{line.installment_total} · proyectada
              </span>
            )
          )}
          {category && (
            <span className="inline-flex items-center gap-1">
              <CategoryIconChip icon={category.icon} />
              {category.name}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Subtotal del grupo por moneda (sin convertir, mismo criterio que el pago de resúmenes) ──

function GroupTotal({ totalsByCurrency }: { totalsByCurrency: { ARS: number; USD: number } }) {
  const { ARS: arsTotal, USD: usdTotal } = totalsByCurrency
  if (arsTotal > 0 && usdTotal > 0) {
    return (
      <span className="text-sm font-bold tabular-nums flex items-baseline gap-1">
        <span>{formatCurrency(arsTotal, "ARS")}</span>
        <span className="text-muted-foreground font-normal">·</span>
        <span>{formatCurrency(usdTotal, "USD")}</span>
      </span>
    )
  }
  const currency = usdTotal > 0 ? "USD" : "ARS"
  const amount = usdTotal > 0 ? usdTotal : arsTotal
  return <span className="text-sm font-bold tabular-nums">{formatCurrency(amount, currency)}</span>
}

// ── Tarjeta de grupo (por resumen/ciclo) con aprobación ──────────────────────────

function StatementGroupCard({
  group,
  expanded,
  approved,
  onToggleExpand,
  onToggleApprove,
  children,
}: {
  group: StatementPreviewGroup
  expanded: boolean
  approved: boolean
  onToggleExpand: () => void
  onToggleApprove: () => void
  children: React.ReactNode
}) {
  const { title, subtitle } = groupPeriodLabel(group.cycleOffset, group.closeDate, group.dueDate)
  // Las filas projectedRecurring son sólo informativas: no se crean en este
  // import, así que no cuentan como "gastos" de este resumen.
  const realLineCount = group.lines.filter((l) => !l.projectedRecurring).length
  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-colors duration-150",
        approved ? "border-primary/40" : "border-border/60"
      )}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center justify-between gap-3 p-3 text-left",
          "hover:bg-muted/30 transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <GroupTotal totalsByCurrency={group.totalsByCurrency} />
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
              approved ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {approved ? <Check className="h-3 w-3" aria-hidden /> : <Clock className="h-3 w-3" aria-hidden />}
            {approved ? "Aprobado" : "Pendiente"}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/60 p-3 space-y-3">
          {children}
          <Button
            type="button"
            variant={approved ? "outline" : "default"}
            size="sm"
            className="w-full press-effect font-semibold"
            onClick={onToggleApprove}
          >
            {approved ? "Marcar como pendiente" : `Aprobar este resumen · ${realLineCount} gasto${realLineCount === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main flow ──────────────────────────────────────────────────────────────────

export function ImportStatementFlow({
  cardAccounts,
  categories,
}: {
  cardAccounts: Account[]
  categories: Category[]
}) {
  const isDemo = useIsDemo()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("upload")

  // Upload step state
  const [selectedAccountId, setSelectedAccountId] = useState(
    () => (cardAccounts.length === 1 ? cardAccounts[0].id : "")
  )
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Review step state
  // Fechas de cierre/vencimiento del resumen. Se precargan al analizar el PDF
  // con el valor derivado del ciclo de la tarjeta (closing_date/due_date, ver
  // initReviewFromParsed), pero son editables: si la IA interpretó mal a qué
  // ciclo pertenece el resumen, el usuario puede corregirlas a mano. El
  // close_date que termina en el payload es el que edite el usuario (card_statements
  // matchea por close_date).
  const [closeDate, setCloseDate] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [totalArs, setTotalArs] = useState("")
  const [totalUsd, setTotalUsd] = useState("")
  const [stampTax, setStampTax] = useState("0")
  const [lines, setLines] = useState<ReviewLine[]>([])
  const [saving, setSaving] = useState(false)
  // Tabla "Cuotas a vencer" del PDF (índice 0 = este resumen, índice N =
  // ciclo futuro N): fuente de verdad para el total de cuotas proyectadas de
  // cada ciclo futuro cuando el PDF la trae. null si no vino.
  const [upcomingInstallmentsTable, setUpcomingInstallmentsTable] = useState<number[] | null>(null)

  // Aprobación por resumen: qué grupos (por cycleOffset) ya revisó/aprobó el
  // usuario, y cuál está expandido. El Confirm final sólo se habilita cuando
  // todos los grupos están aprobados (Tarea 4.2).
  const [approvedOffsets, setApprovedOffsets] = useState<Set<number>>(new Set())
  const [expandedOffset, setExpandedOffset] = useState<number | null>(0)

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense"),
    [categories]
  )

  const categoryOptions: MangoSelectOption[] = useMemo(
    () => [
      { value: "", label: "Sin categoría" },
      ...expenseCategories.map((c) => ({
        value: c.id,
        label: c.name,
        leading: <CategoryIconChip icon={c.icon} />,
      })),
    ],
    [expenseCategories]
  )

  const selectedAccount = cardAccounts.find((a) => a.id === selectedAccountId) ?? null
  const accountCurrency: "ARS" | "USD" = (selectedAccount?.currency as "ARS" | "USD") ?? "ARS"

  const selectedCount = lines.filter((l) => l.selected).length
  // Para el label "N de N gastos incluidos": un reintegro no es un gasto, no cuenta acá.
  const expenseLines = lines.filter((l) => !l.is_refund)
  const selectedExpenseCount = expenseLines.filter((l) => l.selected).length

  // Contra qué se compara el total del PDF: una devolución que cancela el
  // saldo del resumen anterior (settles_previous) se importa igual, pero no
  // integra el TOTAL A PAGAR de este resumen, así que no entra en la cuenta
  // (mismo criterio que buildReconcilePlan en @/lib/statement-reconcile).
  const computedArsTotal = useMemo(() => {
    if (accountCurrency !== "ARS") return null
    return lines
      .filter((l) => l.selected && l.settles_previous !== true)
      .reduce((sum, l) => {
        const amount = amountInCurrency(
          { amount: l.amount, converted_amount: l.amount_ars, original_currency: l.currency },
          accountCurrency
        )
        // Un reintegro resta del total (mismo neteo que la preview y cards.ts).
        return sum + (l.is_refund ? -amount : amount)
      }, 0)
  }, [lines, accountCurrency])

  const parsedTotalArs = parseFloat(totalArs) || 0
  const totalMismatch =
    computedArsTotal != null &&
    parsedTotalArs > 0 &&
    Math.abs(computedArsTotal - parsedTotalArs) > Math.max(100, parsedTotalArs * 0.02)

  // Si la tarjeta tiene el ciclo cargado (closing_date/due_date), el default de
  // cierre/vencimiento se derivó de ahí (ver initReviewFromParsed); si no,
  // se usó como fallback lo que trajo el PDF. Sólo determina qué hint mostrar
  // — las fechas siempre quedan editables por si el usuario necesita corregirlas.
  const closeFromCycle = selectedAccount?.closing_date != null
  const dueFromCycle = selectedAccount?.due_date != null
  const cycleFallbackActive = !closeFromCycle || !dueFromCycle

  // Preview agrupada por resumen/ciclo (Tarea 4.1): se re-deriva en cada
  // render a partir de `lines` (la fuente), así que editar una línea de cuota
  // propaga sola a sus cuotas futuras proyectadas (Tarea 4.3).
  const groups: StatementPreviewGroup[] = useMemo(() => {
    if (!closeDate || !dueDate) return []
    const reviewLines: StatementReviewLine[] = lines.map(toStatementReviewLine)
    return groupStatementPreviewByCycle({
      account_id: selectedAccountId,
      account_currency: accountCurrency,
      close_date: closeDate,
      due_date: dueDate,
      total_amount: parsedTotalArs,
      total_amount_usd: parseFloat(totalUsd) || 0,
      stamp_tax: parseFloat(stampTax) || 0,
      lines: reviewLines,
      upcoming_installments_table: upcomingInstallmentsTable,
    })
  }, [
    closeDate,
    dueDate,
    lines,
    selectedAccountId,
    accountCurrency,
    parsedTotalArs,
    totalUsd,
    stampTax,
    upcomingInstallmentsTable,
  ])

  const allGroupsApproved = groups.length > 0 && groups.every((g) => approvedOffsets.has(g.cycleOffset))
  // Las filas projectedRecurring son sólo informativas (no se crean en este
  // import), así que no suman al conteo de "se crearán N ítems".
  const totalItemsToCreate = groups.reduce(
    (sum, g) => sum + g.lines.filter((l) => !l.projectedRecurring).length,
    0
  )

  const resetAll = useCallback(() => {
    setStep("upload")
    setSelectedAccountId(cardAccounts.length === 1 ? cardAccounts[0].id : "")
    setFile(null)
    setAnalyzing(false)
    setRateLimited(false)
    setErrorMsg(null)
    setCloseDate(null)
    setDueDate(null)
    setTotalArs("")
    setTotalUsd("")
    setStampTax("0")
    setLines([])
    setSaving(false)
    setUpcomingInstallmentsTable(null)
    setApprovedOffsets(new Set())
    setExpandedOffset(0)
  }, [cardAccounts])

  const handleOpenChange = useCallback(
    (v: boolean) => {
      setOpen(v)
      if (!v) resetAll()
    },
    [resetAll]
  )

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    if (f.type !== "application/pdf") {
      toast.error("Solo se admiten archivos PDF.")
      return
    }
    if (f.size > MAX_PDF_SIZE) {
      toast.error("El PDF no puede superar 15 MB.")
      return
    }
    setFile(f)
  }

  function initReviewFromParsed(parsed: ParsedStatement) {
    // 5.6 — si el usuario todavía no eligió una tarjeta (no la precargó en el
    // paso de carga ni hay una sola disponible), usamos el índice/hint que
    // devolvió la IA como sugerencia: preselecciona, pero sigue siendo
    // editable en "Tarjeta" del paso de revisión — nunca se impone.
    let accountForCycle = selectedAccount
    if (!selectedAccountId) {
      const idx = parsed.account_idx
      const byIndex = idx != null && idx >= 0 && idx < cardAccounts.length ? cardAccounts[idx] : null
      const byHint = byIndex
        ? null
        : resolveEntity(parsed.account_hint, cardAccounts, { isHidden: (a) => a.is_hidden })
      const suggested = byIndex ?? (byHint?.resolved ? cardAccounts.find((a) => a.id === byHint.id) ?? null : null)
      if (suggested) {
        accountForCycle = suggested
        setSelectedAccountId(suggested.id)
      }
    }

    // Default de cierre/vencimiento: derivado del ciclo de la tarjeta
    // (closing_date/due_date) para que coincida con lo que tiene cargado. Si la
    // tarjeta no tiene el ciclo cargado, cae a las fechas que trajo el PDF
    // (fallback ya existente). En ambos casos el usuario puede editarlo después.
    const closingDay = accountForCycle?.closing_date ? dayOfMonth(accountForCycle.closing_date) : null
    const dueDay = accountForCycle?.due_date ? dayOfMonth(accountForCycle.due_date) : null
    let defaultClose = parsed.close_date
    let defaultDue = parsed.due_date
    if (closingDay != null) {
      const ref = parsed.close_date ? parseISO(parsed.close_date) : parseISO(todayAR())
      defaultClose = toDateString(nextCloseDate(closingDay, ref))
      defaultDue =
        dueDay != null
          ? toDateString(computeDueDate(parseISO(defaultClose), dueDay, closingDay))
          : parsed.due_date
    }
    setCloseDate(defaultClose)
    setDueDate(defaultDue)
    setTotalArs(parsed.total_ars != null ? String(parsed.total_ars) : "")
    setTotalUsd(parsed.total_usd != null ? String(parsed.total_usd) : "")
    setStampTax(parsed.stamp_tax != null ? String(parsed.stamp_tax) : "0")
    setUpcomingInstallmentsTable(
      parsed.upcoming_installments && parsed.upcoming_installments.length > 0
        ? parsed.upcoming_installments.map((e) => e.amount)
        : null
    )
    setLines(
      parsed.lines.map((l) => ({
        id: crypto.randomUUID(),
        description: l.description,
        date: l.date,
        amount: l.amount,
        currency: l.currency,
        amount_ars: l.amount_ars,
        installment_number: l.installment_number,
        installment_total: l.installment_total,
        is_subscription: l.is_subscription,
        is_refund: l.is_refund,
        settles_previous: l.settles_previous,
        category_id: matchCategoryId(l.category_hint, expenseCategories),
        selected: true,
        createRecurring: false,
      }))
    )
    setApprovedOffsets(new Set())
    setExpandedOffset(0)
    setStep("review")
  }

  async function handleAnalyze() {
    if (!file) return
    setAnalyzing(true)
    setErrorMsg(null)
    setRateLimited(false)
    try {
      const parsed = await importStatementPdf(file, {
        accounts: cardAccounts.map((a) => a.name),
        categories: categories.map((c) => ({ name: c.name, type: c.type })),
      })
      initReviewFromParsed(parsed)
    } catch (err) {
      if (err instanceof StatementImportError && err.code === "rate_limited") {
        setRateLimited(true)
        setErrorMsg(err.message)
      } else {
        toast.error("No pudimos analizar el resumen", {
          description: err instanceof Error ? err.message : undefined,
        })
      }
    } finally {
      setAnalyzing(false)
    }
  }

  const updateLine = useCallback((id: string, patch: Partial<ReviewLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }, [])

  function handleToggleExpand(offset: number) {
    setExpandedOffset((prev) => (prev === offset ? null : offset))
  }

  function handleToggleApprove(offset: number) {
    const wasApproved = approvedOffsets.has(offset)
    setApprovedOffsets((prev) => {
      const next = new Set(prev)
      if (wasApproved) next.delete(offset)
      else next.add(offset)
      return next
    })
    if (!wasApproved) {
      // "Aprobar y siguiente": avanza al próximo grupo pendiente sin forzar
      // a revisar todos de una sola vez (Tarea 4.2).
      const idx = groups.findIndex((g) => g.cycleOffset === offset)
      const next = groups.slice(idx + 1).find((g) => !approvedOffsets.has(g.cycleOffset))
      setExpandedOffset(next ? next.cycleOffset : null)
    }
  }

  async function handleSave() {
    if (!selectedAccount || !closeDate || !dueDate) return
    setSaving(true)
    try {
      const reviewLines: StatementReviewLine[] = lines.map(toStatementReviewLine)
      let payload
      try {
        payload = buildStatementPayload({
          account_id: selectedAccount.id,
          account_currency: accountCurrency,
          close_date: closeDate,
          due_date: dueDate,
          total_amount: parseFloat(totalArs) || 0,
          total_amount_usd: parseFloat(totalUsd) || 0,
          stamp_tax: parseFloat(stampTax) || 0,
          lines: reviewLines,
          upcoming_installments_table: upcomingInstallmentsTable,
        })
      } catch (err) {
        toast.error("No se pudo armar el resumen", {
          description: err instanceof Error ? err.message : undefined,
        })
        return
      }

      const supabase = createClient()
      const result = await saveImportedStatement(supabase, payload)

      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: ["card_statements"] })
      // Las líneas marcadas "crear como recurrente" generan filas en
      // recurring_transactions — invalidamos para que Tarjetas las muestre
      // sin recargar la página.
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY })

      toast.success(`Importamos tu resumen: ${result.movements_created} movimientos`)

      // Best-effort: adjuntar el PDF original al statement recién creado.
      if (file && file.size <= MAX_ATTACHMENT_SIZE) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const up = await uploadAttachment({
            file,
            userId: user.id,
            kind: "resumen",
            statementId: result.statement_id,
          })
          if (up.error) {
            toast.warning(`No se pudo adjuntar el PDF: ${up.error}`)
          }
        }
      }

      handleOpenChange(false)
    } catch (err) {
      toast.error("No se pudo guardar el resumen", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
        disabled={isDemo}
        title={isDemo ? "No disponible en el modo demo" : undefined}
      >
        <FileUp className="h-4 w-4" aria-hidden />
        Importar resumen PDF
      </Button>

      <MangoSheet
        open={open}
        onOpenChange={handleOpenChange}
        title={step === "upload" ? "Importar resumen PDF" : "Revisar resumen"}
        footer={
          step === "review" ? (
            <div className="space-y-1.5">
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  selectedCount === 0 ||
                  !selectedAccountId ||
                  !closeDate ||
                  !dueDate ||
                  !allGroupsApproved
                }
                className="w-full press-effect font-semibold"
              >
                {saving
                  ? "Guardando…"
                  : `Confirmar y guardar ${totalItemsToCreate} movimiento${totalItemsToCreate === 1 ? "" : "s"}`}
              </Button>
              {!allGroupsApproved && groups.length > 0 && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Aprobá los {groups.length - approvedOffsets.size} resúmenes pendientes para confirmar
                </p>
              )}
            </div>
          ) : undefined
        }
      >
        {step === "upload" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Tarjeta (opcional)</Label>
              <MangoSelect
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                options={cardAccounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                  leading: <AccountIconChip icon={a.icon} />,
                }))}
                placeholder="La detectamos del PDF si no la elegís"
                disabled={analyzing}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Resumen en PDF</Label>
              {file ? (
                <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5">
                  <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-destructive" />
                  </div>
                  <span className="text-xs font-medium truncate flex-1">{file.name}</span>
                  <button
                    type="button"
                    disabled={analyzing}
                    onClick={() => setFile(null)}
                    className={cn(
                      "ml-auto h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
                      "bg-background border border-border/60 text-muted-foreground",
                      "hover:text-destructive hover:border-destructive/50 transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "disabled:opacity-50 cursor-pointer"
                    )}
                    aria-label="Quitar PDF"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl border border-dashed border-border/60",
                    "bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground",
                    "hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
                    "transition-colors duration-150 cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <FileUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                  <span>Elegí el PDF de tu resumen</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60">PDF · 15 MB</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {rateLimited && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                <p className="text-sm font-medium">Llegaste al límite diario de IA</p>
                {errorMsg && <p className="text-xs text-muted-foreground">{errorMsg}</p>}
                <UpgradeLink feature="import_pdf" placement="import_statement" />
              </div>
            )}

            {analyzing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                Analizando tu resumen… puede tardar unos segundos.
              </div>
            ) : (
              <Button
                onClick={handleAnalyze}
                disabled={!file}
                className="w-full press-effect font-semibold"
              >
                Analizar resumen
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Tarjeta</Label>
              <MangoSelect
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                options={cardAccounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                  leading: <AccountIconChip icon={a.icon} />,
                }))}
                placeholder="Elegí a qué tarjeta corresponde este resumen"
                aria-invalid={!selectedAccountId}
              />
              {!selectedAccountId && (
                <p className="text-[11px] text-destructive">
                  No pudimos identificar la tarjeta de este resumen — elegila para continuar.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Cierre</Label>
                <MangoDatePicker
                  value={closeDate ? parseISO(closeDate) : null}
                  onChange={(d) => setCloseDate(toDateString(d))}
                  placeholder="Elegí la fecha de cierre"
                  aria-invalid={!closeDate}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Vencimiento</Label>
                <MangoDatePicker
                  value={dueDate ? parseISO(dueDate) : null}
                  onChange={(d) => setDueDate(toDateString(d))}
                  placeholder="Elegí la fecha de vencimiento"
                  aria-invalid={!dueDate}
                />
              </div>
            </div>
            {cycleFallbackActive ? (
              (closeDate || dueDate) && (
                <p className="text-[11px] text-amber-600">
                  Tu tarjeta no tiene el ciclo cargado (día de cierre/vencimiento) — usamos las fechas
                  del PDF. Cargalo en la tarjeta para que se calculen solas la próxima vez.
                </p>
              )
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Precargamos el cierre y el vencimiento según el ciclo de tu tarjeta — editalos si
                este resumen corresponde a otro período.
              </p>
            )}
            {(!closeDate || !dueDate) && (
              <p className="text-[11px] text-destructive">
                Nos falta la fecha de{" "}
                {!closeDate && !dueDate
                  ? "cierre y de vencimiento"
                  : !closeDate
                    ? "cierre"
                    : "vencimiento"}{" "}
                de este resumen. Elegí las fechas manualmente para continuar.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Total ARS</Label>
                <MoneyInput
                  currency="ARS"
                  step="0.01"
                  value={totalArs}
                  onChange={(e) => setTotalArs(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Total USD</Label>
                <MoneyInput
                  currency="USD"
                  step="0.01"
                  value={totalUsd}
                  onChange={(e) => setTotalUsd(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium">Sellado / impuestos</Label>
              <MoneyInput
                currency="ARS"
                step="0.01"
                value={stampTax}
                onChange={(e) => setStampTax(e.target.value)}
                className="tabular-nums"
              />
            </div>

            {totalMismatch && (
              <p className="text-[11px] text-amber-600">
                El total declarado ({formatCurrency(parsedTotalArs, "ARS")}) difiere de la suma de
                las líneas incluidas ({formatCurrency(computedArsTotal ?? 0, "ARS")}).
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {selectedExpenseCount} de {expenseLines.length} gastos incluidos
              </p>

              <div className="space-y-2">
                {groups.map((group) => (
                  <StatementGroupCard
                    key={group.cycleOffset}
                    group={group}
                    expanded={expandedOffset === group.cycleOffset}
                    approved={approvedOffsets.has(group.cycleOffset)}
                    onToggleExpand={() => handleToggleExpand(group.cycleOffset)}
                    onToggleApprove={() => handleToggleApprove(group.cycleOffset)}
                  >
                    {group.cycleOffset === 0 ? (
                      <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                        {lines.map((line) => (
                          <LineRow
                            key={line.id}
                            line={line}
                            accountCurrency={accountCurrency}
                            categoryOptions={categoryOptions}
                            onChange={(patch) => updateLine(line.id, patch)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                        {group.lines.map((line, idx) => (
                          <ProjectedLineRow key={idx} line={line} categories={expenseCategories} />
                        ))}
                      </div>
                    )}
                  </StatementGroupCard>
                ))}
              </div>
            </div>
          </div>
        )}
      </MangoSheet>
    </>
  )
}
