"use client"

/**
 * CorroborateStatementFlow — botón "Corroborar con IA" + MangoSheet para
 * comparar el PDF de UN resumen puntual contra los movimientos ya cargados en
 * su ciclo (Grupo 3 del change corroborar-resumen-con-ia).
 *
 * Paso 1 (upload): subir el PDF de ESE resumen (≤15MB), extraerlo con la
 * misma ruta que el import (importStatementPdf).
 * Paso 2 (diff): reconcileStatement (Grupo 1) compara el PDF contra los
 * movimientos del ciclo y clasifica en 3 grupos, los tres accionables porque
 * el PDF es la fuente de verdad de lo que hay que pagar — FALTA (se agrega),
 * DIFERENCIA DE MONTO (se corrige al importe del PDF) y SOBRA (se elimina).
 * Antes de tocar nada se muestra el plan completo (buildReconcilePlan): qué se
 * agrega, qué se corrige, qué se elimina y con qué total queda cada moneda
 * contra el PDF. Al confirmar, el payload de buildReconcileApplyPayload
 * (modo aditivo + deletions + amount_updates, migración 0059) aplica todo en
 * una sola transacción. Cerrar sin confirmar no persiste nada.
 */

import { useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowRight, Check, FileText, FileUp, Loader2, Sparkles, Trash2, TriangleAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { UpgradeLink } from "@/components/ui/upgrade-link"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency, cn } from "@/lib/utils"
import { useIsDemo } from "@/lib/use-is-demo"
import { CategoryIconChip } from "@/lib/categories"
import { MOVEMENTS_KEY, ACCOUNTS_KEY, BALANCES_KEY } from "@/lib/movements"
import { RECURRING_KEY } from "@/lib/recurring"
import { INSTALLMENTS_KEY } from "@/lib/installments"
import type { CardCycle } from "@/lib/cards"
import {
  importStatementPdf,
  saveImportedStatement,
  buildPurchaseKey,
  StatementImportError,
  type ParsedStatement,
  type StatementReviewLine,
} from "@/lib/statement-import"
import {
  MAX_PDF_SIZE,
  matchCategoryId,
  toStatementReviewLine,
  LineRow,
  type ReviewLine,
} from "@/components/cards/import-statement-flow"
import {
  reconcileStatement,
  buildReconcileApplyPayload,
  buildReconcilePlan,
  type ReconcileMovement,
  type ReconcilePlan,
  type StatementMismatch,
} from "@/lib/statement-reconcile"
import type { Tables } from "@/lib/database.types"

type Account = Tables<"accounts">
type Category = Tables<"categories">
type Movement = Tables<"movements">

type Step = "upload" | "diff"

// ── Data fetchers ──────────────────────────────────────────────────────────────

/**
 * Compras en cuotas de la cuenta: la descripción resuelve el comercio de un
 * movimiento de cuota (movements.note queda NULL en cuotas) y `purchase_key`
 * identifica el plan ya cargado, para reproyectar sólo planes existentes (ver
 * reprojectLines en handleAnalyze).
 */
async function fetchInstallmentPurchases(
  accountId: string
): Promise<{ id: string; description: string; purchase_key: string | null }[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("installment_purchases")
    .select("id, description, purchase_key")
    .eq("account_id", accountId)
  if (error) throw error
  return data
}

/**
 * Arma el array de movimientos del ciclo que espera reconcileStatement,
 * resolviendo el comercio de cada uno: para gastos/suscripciones simples es
 * `note`; para cuotas (installment_purchase_id) es la descripción de la
 * compra en installment_purchases (join en memoria contra `purchases`).
 */
function buildCycleMovements(
  cycleMovements: CardCycle["movements"],
  purchases: { id: string; description: string }[]
): ReconcileMovement[] {
  const descById = new Map(purchases.map((p) => [p.id, p.description]))
  return (cycleMovements as Movement[])
    .filter((m) => m.type === "expense" || m.type === "income")
    .map((m) => ({
      id: m.id,
      description: (m.installment_purchase_id ? descById.get(m.installment_purchase_id) : m.note) ?? "",
      amount: m.amount,
      currency: (m.original_currency ?? "ARS") as "ARS" | "USD",
      type: m.type as "expense" | "income",
      installment_number: m.installment_number,
      installment_total: m.installment_total,
      settles_previous: m.settles_previous === true,
    }))
}

// ── Fila "diferencia de monto" (tildable: corrige al importe del PDF) ───────

function MismatchRow({
  mismatch,
  checked,
  onCheckedChange,
}: {
  mismatch: StatementMismatch
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  const { line, movement } = mismatch
  const isInstallment = line.installment_number != null && line.installment_total != null
  const delta = Math.round((line.amount - movement.amount) * 100) / 100

  return (
    <div className={cn("flex items-start gap-2 p-3", !checked && "opacity-50")}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="h-4 w-4 mt-1 rounded border-input accent-amber-600 cursor-pointer flex-shrink-0"
        aria-label={`Corregir el importe de ${line.description}`}
      />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">{line.description}</p>
          {isInstallment && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-semibold flex-shrink-0">
              cuota {line.installment_number}/{line.installment_total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="tabular-nums text-muted-foreground line-through">
            {formatCurrency(movement.amount, movement.currency)}
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden />
          <span className="tabular-nums font-bold text-foreground">
            {formatCurrency(line.amount, line.currency)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            ({delta > 0 ? "+" : "−"}
            {formatCurrency(Math.abs(delta), line.currency)} · lo que dice el PDF)
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Fila "sobra" (tildable: se elimina, el PDF no la tiene) ─────────────────

function ExtraRow({
  movement,
  checked,
  onCheckedChange,
}: {
  movement: ReconcileMovement
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  const isInstallment = movement.installment_number != null && movement.installment_total != null
  return (
    <div className={cn("flex items-start gap-2 p-3", !checked && "opacity-50")}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="h-4 w-4 mt-1 rounded border-input accent-destructive cursor-pointer flex-shrink-0"
        aria-label={`Eliminar ${movement.description || "movimiento sin descripción"}`}
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <p className={cn("text-sm font-medium truncate", checked && "line-through")}>
              {movement.description || "Sin descripción"}
            </p>
            {isInstallment && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-semibold flex-shrink-0">
                cuota {movement.installment_number}/{movement.installment_total}
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-sm font-bold tabular-nums flex-shrink-0",
              checked ? "text-muted-foreground line-through" : "text-foreground"
            )}
          >
            {movement.type === "income" ? "+ " : "− "}
            {formatCurrency(movement.amount, movement.currency)}
          </span>
        </div>
        {checked && <p className="text-[10.5px] text-destructive">Se elimina de tu resumen</p>}
      </div>
    </div>
  )
}

// ── Plan: qué se va a hacer y cómo quedan los importes ──────────────────────

function PlanSummary({ plan }: { plan: ReconcilePlan }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 overflow-hidden">
      <div className="p-3 space-y-2 border-b border-border/60">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lo que voy a hacer</p>
        {plan.empty ? (
          <p className="text-sm text-muted-foreground">
            No hay nada tildado: no voy a tocar tu resumen.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {plan.additions > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-success/10 text-success text-[11px] font-semibold">
                Agregar {plan.additions}
              </span>
            )}
            {plan.fixes > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[11px] font-semibold">
                Corregir {plan.fixes}
              </span>
            )}
            {plan.deletions > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold">
                Eliminar {plan.deletions}
              </span>
            )}
            {plan.reprojected > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold">
                Recalcular cuotas de {plan.reprojected}
              </span>
            )}
          </div>
        )}
        {plan.reprojected > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Las cuotas futuras de {plan.reprojected === 1 ? "la compra en cuotas" : `las ${plan.reprojected} compras en cuotas`} de este resumen se
            recalculan contra el PDF: importe de cada cuota y hasta qué mes llegan (tabla &quot;Cuotas a
            vencer&quot;). Repara las que quedaron con un monto viejo o sin la última cuota. No cambia el total
            de este resumen.
          </p>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cómo quedan los importes</p>
        {plan.totals.map((row) => (
          <div key={row.currency} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                Tu resumen{plan.totals.length > 1 ? ` (${row.currency})` : ""}
              </span>
              <span className="flex items-center gap-1.5 tabular-nums">
                <span className={cn("text-muted-foreground", row.current !== row.after && "line-through")}>
                  {formatCurrency(row.current, row.currency)}
                </span>
                {row.current !== row.after && (
                  <>
                    <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-hidden />
                    <span className="font-bold text-foreground">{formatCurrency(row.after, row.currency)}</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                PDF · a pagar{row.pdfFromLines ? " (suma del detalle)" : ""}
              </span>
              <span className="font-bold tabular-nums">{formatCurrency(row.pdf, row.currency)}</span>
            </div>
            {row.matches ? (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-success">
                <Check className="h-3 w-3 flex-shrink-0" aria-hidden />
                Queda clavado con el PDF
              </p>
            ) : (
              <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                <TriangleAlert className="h-3 w-3 flex-shrink-0" aria-hidden />
                {row.difference > 0 ? "Queda " : "Falta "}
                {formatCurrency(Math.abs(row.difference), row.currency)}
                {row.difference > 0 ? " de más" : " para llegar al PDF"}
              </p>
            )}
          </div>
        ))}
        {plan.totals.length === 0 && (
          <p className="text-xs text-muted-foreground">No pudimos leer totales en el PDF.</p>
        )}
      </div>
    </div>
  )
}

/** Texto del botón: exactamente lo que se va a hacer, sin eufemismos. */
function applyLabel(plan: ReconcilePlan): string {
  const partes: string[] = []
  if (plan.additions > 0) partes.push(`agregar ${plan.additions}`)
  if (plan.fixes > 0) partes.push(`corregir ${plan.fixes}`)
  if (plan.deletions > 0) partes.push(`eliminar ${plan.deletions}`)
  if (partes.length === 0 && plan.reprojected > 0) {
    return `Recalcular las cuotas de ${plan.reprojected} compra${plan.reprojected === 1 ? "" : "s"}`
  }
  return `Aplicar · ${partes.join(" · ")}`
}

// ── Main flow ──────────────────────────────────────────────────────────────────

export function CorroborateStatementFlow({
  account,
  cycle,
  categories,
}: {
  account: Account
  cycle: CardCycle
  categories: Category[]
}) {
  const isDemo = useIsDemo()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("upload")

  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [parsed, setParsed] = useState<ParsedStatement | null>(null)
  /** Los movimientos del ciclo tal como estaban al comparar (base del plan de importes). */
  const [cycleSnapshot, setCycleSnapshot] = useState<ReconcileMovement[]>([])
  const [missingLines, setMissingLines] = useState<ReviewLine[]>([])
  const [extra, setExtra] = useState<ReconcileMovement[]>([])
  const [mismatched, setMismatched] = useState<StatementMismatch[]>([])
  /**
   * Cuotas del PDF que YA están cargadas en este resumen y cuyo plan existe en
   * la base: se mandan igual en el payload para que la RPC recalcule las
   * cuotas FUTURAS de ese plan (upsert por purchase_key + nº de cuota, no
   * duplica). Repara las dos formas en que la proyección puede haber quedado
   * mal: el IMPORTE de las cuotas que vienen (una cuota mal leída se arrastra
   * a todas las futuras, corregir sólo la de este resumen no alcanza) y hasta
   * QUÉ MES llegan (la tabla "Cuotas a vencer"). El diff por sí solo nunca lo
   * vería: compara este ciclo, no los que vienen. No suman al total de este
   * resumen (ya están contadas).
   */
  const [reprojectLines, setReprojectLines] = useState<StatementReviewLine[]>([])
  /** Bajas tildadas, por id de movimiento. Arrancan en true: el PDF manda. */
  const [deleteSelected, setDeleteSelected] = useState<Record<string, boolean>>({})
  /** Correcciones de importe tildadas, por id del movimiento cargado. Arrancan en true. */
  const [fixSelected, setFixSelected] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  const { data: purchases = [], isLoading: purchasesLoading } = useQuery({
    queryKey: [...INSTALLMENTS_KEY, "descriptions", account.id],
    queryFn: () => fetchInstallmentPurchases(account.id),
    enabled: open,
  })

  const accountCurrency = (account.currency ?? "ARS") as "ARS" | "USD"

  const expenseCategories = useMemo(() => categories.filter((c) => c.type === "expense"), [categories])
  const categoryOptions = useMemo(
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

  const linesToAdd = useMemo(() => missingLines.filter((l) => l.selected), [missingLines])
  const fixesToApply = useMemo(
    () => mismatched.filter((m) => fixSelected[m.movement.id] !== false),
    [mismatched, fixSelected]
  )
  const movementsToDelete = useMemo(
    () => extra.filter((m) => deleteSelected[m.id] !== false),
    [extra, deleteSelected]
  )

  /** Compras (no cuotas sueltas) cuya proyección futura se va a recalcular. */
  const reprojectedPurchaseCount = useMemo(
    () => new Set(reprojectLines.map((l) => buildPurchaseKey(l.description, l.date, l.installment_total!))).size,
    [reprojectLines]
  )

  /**
   * El plan que se muestra ANTES de tocar nada: cuántos movimientos se
   * agregan/corrigen/eliminan y con qué total queda cada moneda contra el PDF.
   */
  const plan = useMemo(
    () =>
      parsed
        ? buildReconcilePlan({
            parsed,
            cycleMovements: cycleSnapshot,
            additions: linesToAdd.map(toStatementReviewLine),
            fixes: fixesToApply,
            deletions: movementsToDelete,
            reprojections: reprojectedPurchaseCount,
          })
        : null,
    [parsed, cycleSnapshot, linesToAdd, fixesToApply, movementsToDelete, reprojectedPurchaseCount]
  )

  function resetAll() {
    setStep("upload")
    setFile(null)
    setAnalyzing(false)
    setRateLimited(false)
    setErrorMsg(null)
    setParsed(null)
    setCycleSnapshot([])
    setMissingLines([])
    setExtra([])
    setMismatched([])
    setReprojectLines([])
    setDeleteSelected({})
    setFixSelected({})
    setSaving(false)
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) resetAll()
  }

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

  async function handleAnalyze() {
    if (!file) return
    setAnalyzing(true)
    setErrorMsg(null)
    setRateLimited(false)
    try {
      const p = await importStatementPdf(file, {
        accounts: [account.name],
        categories: categories.map((c) => ({ name: c.name, type: c.type })),
      })
      const cycleMovements = buildCycleMovements(cycle.movements, purchases)
      const result = reconcileStatement(p, cycleMovements)
      setParsed(p)
      setMissingLines(
        result.missing.map((l) => ({
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
      setExtra(result.extra)
      setMismatched(result.mismatched)
      setCycleSnapshot(cycleMovements)

      // Cuotas del PDF ya cargadas (no están en "falta"), cuyo plan existe en
      // la base con la misma purchase_key: se reproyectan. Si la clave no
      // existe no se manda nada, para no crear un plan duplicado por una
      // descripción que la IA leyó distinto.
      const missingSet = new Set(result.missing)
      const knownKeys = new Set(purchases.map((p) => p.purchase_key).filter((k): k is string => k != null))
      setReprojectLines(
        p.lines
          .filter(
            (l) =>
              l.installment_number != null &&
              l.installment_total != null &&
              !missingSet.has(l) &&
              knownKeys.has(buildPurchaseKey(l.description, l.date, l.installment_total))
          )
          .map((l) => ({
            description: l.description,
            date: l.date,
            amount: l.amount,
            currency: l.currency,
            amount_ars: l.amount_ars,
            installment_number: l.installment_number,
            installment_total: l.installment_total,
            is_subscription: false,
            is_refund: false,
            category_id: matchCategoryId(l.category_hint, expenseCategories),
            selected: true,
            createRecurring: false,
          }))
      )
      // Por default se aplica todo: el PDF es la fuente de verdad de lo que
      // hay que pagar. El usuario destilda lo que no quiera antes de aplicar.
      setDeleteSelected(Object.fromEntries(result.extra.map((m) => [m.id, true])))
      setFixSelected(Object.fromEntries(result.mismatched.map((m) => [m.movement.id, true])))
      setStep("diff")
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

  function updateMissingLine(id: string, patch: Partial<ReviewLine>) {
    setMissingLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  async function handleApply() {
    setSaving(true)
    try {
      const linesToApply = [...linesToAdd.map(toStatementReviewLine), ...reprojectLines]
      // El PDF es la fuente de verdad de lo que hay que pagar: el total del
      // resumen pasa a ser el del PDF (si la IA lo leyó); si no vino, queda el
      // proyectado después de aplicar el plan.
      const arsRow = plan?.totals.find((t) => t.currency === "ARS")
      const usdRow = plan?.totals.find((t) => t.currency === "USD")
      const payload = buildReconcileApplyPayload({
        account_id: account.id,
        account_currency: accountCurrency,
        close_date: cycle.closeDate,
        due_date: cycle.dueDate ?? cycle.closeDate,
        total_amount: arsRow?.pdf ?? cycle.statement?.total_amount ?? cycle.totalsByCurrency.ARS,
        total_amount_usd: usdRow?.pdf ?? cycle.statement?.total_amount_usd ?? cycle.totalsByCurrency.USD,
        stamp_tax: parsed?.stamp_tax ?? cycle.statement?.stamp_tax ?? 0,
        linesToApply,
        deletions: movementsToDelete,
        amountFixes: fixesToApply,
        upcoming_installments_table:
          parsed?.upcoming_installments && parsed.upcoming_installments.length > 0
            ? parsed.upcoming_installments.map((e) => e.amount)
            : null,
      })

      const supabase = createClient()
      const result = await saveImportedStatement(supabase, payload)

      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      queryClient.invalidateQueries({ queryKey: BALANCES_KEY })
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: ["card_statements"] })
      queryClient.invalidateQueries({ queryKey: RECURRING_KEY })

      const partes: string[] = []
      if (result.movements_created > 0) partes.push(`${result.movements_created} agregado${result.movements_created === 1 ? "" : "s"}`)
      if ((result.movements_updated ?? 0) > 0) partes.push(`${result.movements_updated} corregido${result.movements_updated === 1 ? "" : "s"}`)
      if ((result.movements_deleted ?? 0) > 0) partes.push(`${result.movements_deleted} eliminado${result.movements_deleted === 1 ? "" : "s"}`)
      toast.success(
        partes.length > 0 ? `Resumen corroborado: ${partes.join(" · ")}` : "Resumen corroborado"
      )
      handleOpenChange(false)
    } catch (err) {
      toast.error("No se pudo aplicar el corroborar", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  const noDifferences = missingLines.length === 0 && extra.length === 0 && mismatched.length === 0

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 press-effect cursor-pointer"
        onClick={() => setOpen(true)}
        disabled={isDemo}
        title={isDemo ? "No disponible en el modo demo" : undefined}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Corroborar con IA
      </Button>

      <MangoSheet
        open={open}
        onOpenChange={handleOpenChange}
        title={step === "upload" ? "Corroborar con IA" : "Revisar diferencias"}
        footer={
          step === "diff" ? (
            noDifferences && (!plan || plan.empty) ? (
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="w-full press-effect font-semibold"
              >
                Listo
              </Button>
            ) : (
              <Button
                onClick={handleApply}
                disabled={saving || !plan || plan.empty}
                className="w-full press-effect font-semibold"
              >
                {saving ? "Aplicando…" : plan && !plan.empty ? applyLabel(plan) : "Elegí qué aplicar"}
              </Button>
            )
          ) : undefined
        }
      >
        {step === "upload" ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Subí el PDF de este resumen ({" "}
              {new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(
                new Date(cycle.closeDate + "T00:00:00")
              )}
              ) y comparamos línea por línea contra lo que ya tenés cargado.
            </p>

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
                <UpgradeLink feature="import_pdf" placement="corroborate_statement" />
              </div>
            )}

            {analyzing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                Comparando tu resumen… puede tardar unos segundos.
              </div>
            ) : (
              <Button
                onClick={handleAnalyze}
                disabled={!file || purchasesLoading}
                className="w-full press-effect font-semibold"
              >
                Comparar con lo cargado
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center justify-around text-center divide-x divide-border/60">
              <div className="flex-1">
                <p className="text-lg font-bold tabular-nums text-success">{missingLines.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Faltan</p>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold tabular-nums text-amber-600">{mismatched.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mal cargados</p>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold tabular-nums text-destructive">{extra.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sobran</p>
              </div>
            </div>

            {noDifferences ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Todo coincide: no encontramos diferencias entre el PDF y lo que ya tenés cargado.
              </p>
            ) : (
              plan && <PlanSummary plan={plan} />
            )}

            {missingLines.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-success uppercase tracking-wider">
                  Falta · {linesToAdd.length} de {missingLines.length} para agregar
                </p>
                <div className="rounded-xl border border-success/30 divide-y divide-border/40 overflow-hidden">
                  {missingLines.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      accountCurrency={accountCurrency}
                      categoryOptions={categoryOptions}
                      onChange={(patch) => updateMissingLine(line.id, patch)}
                    />
                  ))}
                </div>
              </div>
            )}

            {mismatched.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  Mal cargados · {fixesToApply.length} de {mismatched.length} para corregir al importe del PDF
                </p>
                <div className="rounded-xl border border-amber-500/30 divide-y divide-border/40 overflow-hidden">
                  {mismatched.map((m) => (
                    <MismatchRow
                      key={m.movement.id}
                      mismatch={m}
                      checked={fixSelected[m.movement.id] !== false}
                      onCheckedChange={(v) =>
                        setFixSelected((prev) => ({ ...prev, [m.movement.id]: v }))
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {extra.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Trash2 className="h-3 w-3 text-destructive flex-shrink-0" aria-hidden />
                  <p className="text-xs font-bold text-destructive uppercase tracking-wider">
                    Sobra · {movementsToDelete.length} de {extra.length} para eliminar
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Están cargados pero no figuran en el PDF. Destildá los que quieras conservar.
                </p>
                <div className="rounded-xl border border-destructive/30 divide-y divide-border/40 overflow-hidden">
                  {extra.map((m) => (
                    <ExtraRow
                      key={m.id}
                      movement={m}
                      checked={deleteSelected[m.id] !== false}
                      onCheckedChange={(v) => setDeleteSelected((prev) => ({ ...prev, [m.id]: v }))}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </MangoSheet>
    </>
  )
}
