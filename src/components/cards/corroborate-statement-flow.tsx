"use client"

/**
 * CorroborateStatementFlow — botón "Corroborar con IA" + MangoSheet para
 * comparar el PDF de UN resumen puntual contra los movimientos ya cargados en
 * su ciclo (Grupo 3 del change corroborar-resumen-con-ia).
 *
 * Paso 1 (upload): subir el PDF de ESE resumen (≤15MB), extraerlo con la
 * misma ruta que el import (importStatementPdf).
 * Paso 2 (diff): reconcileStatement (Grupo 1) compara el PDF contra los
 * movimientos del ciclo y clasifica en 3 grupos — FALTA (tildable, se agrega),
 * DIFERENCIA DE MONTO (sólo informativo) y SOBRA (sólo lectura). Al confirmar,
 * se arma el payload con buildReconcileApplyPayload (Grupo 2, modo aditivo:
 * no borra nada de lo ya cargado) y se persiste con saveImportedStatement.
 * Cerrar sin confirmar no persiste nada.
 */

import { useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { FileText, FileUp, Loader2, Sparkles, X } from "lucide-react"
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
import { importStatementPdf, saveImportedStatement, StatementImportError, type ParsedStatement } from "@/lib/statement-import"
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
  type ReconcileMovement,
  type StatementMismatch,
} from "@/lib/statement-reconcile"
import type { Tables } from "@/lib/database.types"

type Account = Tables<"accounts">
type Category = Tables<"categories">
type Movement = Tables<"movements">

type Step = "upload" | "diff"

// ── Data fetchers ──────────────────────────────────────────────────────────────

/** Descripciones de compras en cuotas de la cuenta, para resolver el comercio de un movimiento de cuota (movements.note queda NULL en cuotas). */
async function fetchInstallmentPurchaseDescriptions(
  accountId: string
): Promise<{ id: string; description: string }[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("installment_purchases")
    .select("id, description")
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
    }))
}

// ── Fila "diferencia de monto" (sólo informativa) ────────────────────────────

function MismatchRow({ mismatch }: { mismatch: StatementMismatch }) {
  const { line, movement } = mismatch
  const isInstallment = line.installment_number != null && line.installment_total != null
  return (
    <div className="p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <p className="text-sm font-medium truncate">{line.description}</p>
        {isInstallment && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-semibold flex-shrink-0">
            cuota {line.installment_number}/{line.installment_total}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-muted-foreground">
          PDF{" "}
          <span className="font-bold tabular-nums text-foreground">
            {formatCurrency(line.amount, line.currency)}
          </span>
        </span>
        <span className="text-muted-foreground">
          Cargado{" "}
          <span className="font-bold tabular-nums text-foreground">
            {formatCurrency(movement.amount, movement.currency)}
          </span>
        </span>
      </div>
    </div>
  )
}

// ── Fila "sobra" (sólo lectura) ──────────────────────────────────────────────

function ExtraRow({ movement }: { movement: ReconcileMovement }) {
  const isInstallment = movement.installment_number != null && movement.installment_total != null
  return (
    <div className="p-3 flex items-center justify-between gap-2 opacity-70">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">{movement.description || "Sin descripción"}</p>
          {isInstallment && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted text-[10px] font-semibold flex-shrink-0">
              cuota {movement.installment_number}/{movement.installment_total}
            </span>
          )}
        </div>
      </div>
      <span className="text-sm font-bold tabular-nums text-muted-foreground flex-shrink-0">
        {movement.type === "income" ? "+ " : "− "}
        {formatCurrency(movement.amount, movement.currency)}
      </span>
    </div>
  )
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
  const [missingLines, setMissingLines] = useState<ReviewLine[]>([])
  const [extra, setExtra] = useState<ReconcileMovement[]>([])
  const [mismatched, setMismatched] = useState<StatementMismatch[]>([])
  const [saving, setSaving] = useState(false)

  const { data: purchases = [], isLoading: purchasesLoading } = useQuery({
    queryKey: [...INSTALLMENTS_KEY, "descriptions", account.id],
    queryFn: () => fetchInstallmentPurchaseDescriptions(account.id),
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

  const selectedMissingCount = missingLines.filter((l) => l.selected).length

  function resetAll() {
    setStep("upload")
    setFile(null)
    setAnalyzing(false)
    setRateLimited(false)
    setErrorMsg(null)
    setParsed(null)
    setMissingLines([])
    setExtra([])
    setMismatched([])
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
          category_id: matchCategoryId(l.category_hint, expenseCategories),
          selected: true,
          createRecurring: false,
        }))
      )
      setExtra(result.extra)
      setMismatched(result.mismatched)
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
      const linesToApply = missingLines.filter((l) => l.selected).map(toStatementReviewLine)
      const payload = buildReconcileApplyPayload({
        account_id: account.id,
        account_currency: accountCurrency,
        close_date: cycle.closeDate,
        due_date: cycle.dueDate ?? cycle.closeDate,
        // Preservamos los totales ya cargados del resumen — corroborar sólo
        // agrega lo que falta, no pisa el total con lo que diga el PDF (D2/no-goal).
        total_amount: cycle.statement?.total_amount ?? cycle.totalsByCurrency.ARS,
        total_amount_usd: cycle.statement?.total_amount_usd ?? cycle.totalsByCurrency.USD,
        stamp_tax: cycle.statement?.stamp_tax ?? 0,
        linesToApply,
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

      toast.success(`Corroboramos tu resumen: ${result.movements_created} movimiento${result.movements_created === 1 ? "" : "s"} agregado${result.movements_created === 1 ? "" : "s"}`)
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
            <Button
              onClick={handleApply}
              disabled={saving || selectedMissingCount === 0}
              className="w-full press-effect font-semibold"
            >
              {saving
                ? "Guardando…"
                : selectedMissingCount === 0
                  ? "Elegí qué agregar"
                  : `Agregar ${selectedMissingCount} movimiento${selectedMissingCount === 1 ? "" : "s"}`}
            </Button>
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
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Diferencias</p>
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold tabular-nums text-muted-foreground">{extra.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sobran</p>
              </div>
            </div>

            {noDifferences && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Todo coincide: no encontramos diferencias entre el PDF y lo que ya tenés cargado.
              </p>
            )}

            {missingLines.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-success uppercase tracking-wider">
                  Falta · {selectedMissingCount} de {missingLines.length} para agregar
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
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Diferencia de monto</p>
                <div className="rounded-xl border border-amber-500/30 divide-y divide-border/40 overflow-hidden">
                  {mismatched.map((m, idx) => (
                    <MismatchRow key={idx} mismatch={m} />
                  ))}
                </div>
              </div>
            )}

            {extra.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Sobra · cargado, no está en el PDF
                </p>
                <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                  {extra.map((m) => (
                    <ExtraRow key={m.id} movement={m} />
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
