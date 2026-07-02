"use client"

/**
 * ImportStatementFlow — botón + MangoSheet para importar un resumen de
 * tarjeta desde un PDF (interpretado por IA en el backend, fase 1 ya hecha).
 *
 * Paso 1 (upload): elegir tarjeta + PDF, llamar a importStatementPdf.
 * Paso 2 (review): revisar/editar el resumen parseado y guardar con
 * buildStatementPayload + saveImportedStatement.
 */

import { useCallback, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { FileText, FileUp, Loader2, X } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { MangoSelect, type MangoSelectOption } from "@/components/ui/mango-select"
import { MangoDatePicker } from "@/components/ui/mango-date-picker"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { UpgradeLink } from "@/components/ui/upgrade-link"
import { createClient } from "@/lib/supabase/client"
import { uploadAttachment } from "@/lib/attachments"
import { toDateString } from "@/lib/cards"
import { AccountIconChip } from "@/lib/accounts"
import { CategoryIconChip } from "@/lib/categories"
import { useIsDemo } from "@/lib/use-is-demo"
import { MOVEMENTS_KEY, ACCOUNTS_KEY, BALANCES_KEY } from "@/lib/movements"
import { formatCurrency, cn } from "@/lib/utils"
import {
  importStatementPdf,
  buildStatementPayload,
  saveImportedStatement,
  StatementImportError,
  type ParsedStatement,
  type StatementReviewLine,
} from "@/lib/statement-import"
import type { Tables } from "@/lib/database.types"

type Account = Tables<"accounts">
type Category = Tables<"categories">

const MAX_PDF_SIZE = 15 * 1024 * 1024 // 15 MB
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024 // límite propio de uploadAttachment

interface ReviewLine extends StatementReviewLine {
  id: string
}

type Step = "upload" | "review"

function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

function matchCategoryId(hint: string | null, expenseCategories: Category[]): string | null {
  if (!hint) return null
  const normHint = normalizeText(hint)
  return expenseCategories.find((c) => normalizeText(c.name) === normHint)?.id ?? null
}

// ── Line row ───────────────────────────────────────────────────────────────────

function LineRow({
  line,
  accountCurrency,
  rate,
  categoryOptions,
  onChange,
}: {
  line: ReviewLine
  accountCurrency: "ARS" | "USD"
  rate: string
  categoryOptions: MangoSelectOption[]
  onChange: (patch: Partial<ReviewLine>) => void
}) {
  const isCrossCurrency = line.currency !== accountCurrency
  const parsedRate = parseFloat(rate)
  const convertedAmount = isCrossCurrency
    ? line.amount_ars ?? (parsedRate > 0 ? line.amount * parsedRate : null)
    : null

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
          <span className="text-sm font-bold tabular-nums text-destructive flex-shrink-0">
            − {formatCurrency(line.amount, line.currency)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
          <span className="tabular-nums">{format(parseISO(line.date), "d MMM", { locale: es })}</span>
          {line.installment_number != null && line.installment_total != null && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-muted font-semibold">
              cuota {line.installment_number}/{line.installment_total}
            </span>
          )}
          {isCrossCurrency && (
            <span>
              {convertedAmount != null
                ? `≈ ${formatCurrency(convertedAmount, accountCurrency)}`
                : "Falta cotización para convertir"}
            </span>
          )}
        </div>
        <MangoSelect
          value={line.category_id ?? ""}
          onChange={(v) => onChange({ category_id: v || null })}
          options={categoryOptions}
          placeholder="Sin categoría"
          showSearch
          aria-label="Categoría"
        />
      </div>
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
  const [closeDate, setCloseDate] = useState<Date | null>(null)
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [totalArs, setTotalArs] = useState("")
  const [totalUsd, setTotalUsd] = useState("")
  const [stampTax, setStampTax] = useState("0")
  const [rateInput, setRateInput] = useState("")
  const [lines, setLines] = useState<ReviewLine[]>([])
  const [saving, setSaving] = useState(false)

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
  const needsRate = lines.some(
    (l) => l.selected && l.currency !== accountCurrency && l.amount_ars == null
  )
  const rateIsValid = !needsRate || parseFloat(rateInput) > 0

  const computedArsTotal = useMemo(() => {
    if (accountCurrency !== "ARS") return null
    const r = parseFloat(rateInput)
    return lines
      .filter((l) => l.selected)
      .reduce((sum, l) => {
        if (l.currency === "ARS") return sum + l.amount
        if (l.amount_ars != null) return sum + l.amount_ars
        if (r > 0) return sum + l.amount * r
        return sum
      }, 0)
  }, [lines, rateInput, accountCurrency])

  const parsedTotalArs = parseFloat(totalArs) || 0
  const totalMismatch =
    computedArsTotal != null &&
    parsedTotalArs > 0 &&
    Math.abs(computedArsTotal - parsedTotalArs) > Math.max(100, parsedTotalArs * 0.02)

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
    setRateInput("")
    setLines([])
    setSaving(false)
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
    setCloseDate(parsed.close_date ? parseISO(parsed.close_date) : null)
    setDueDate(parsed.due_date ? parseISO(parsed.due_date) : null)
    setTotalArs(parsed.total_ars != null ? String(parsed.total_ars) : "")
    setTotalUsd(parsed.total_usd != null ? String(parsed.total_usd) : "")
    setStampTax(parsed.stamp_tax != null ? String(parsed.stamp_tax) : "0")
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
        category_id: matchCategoryId(l.category_hint, expenseCategories),
        selected: true,
      }))
    )
    setStep("review")
  }

  async function handleAnalyze() {
    if (!file || !selectedAccountId) return
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

  async function handleSave() {
    if (!selectedAccount || !closeDate || !dueDate) return
    setSaving(true)
    try {
      const reviewLines: StatementReviewLine[] = lines.map((l) => ({
        description: l.description,
        date: l.date,
        amount: l.amount,
        currency: l.currency,
        amount_ars: l.amount_ars,
        installment_number: l.installment_number,
        installment_total: l.installment_total,
        category_id: l.category_id,
        selected: l.selected,
      }))
      let payload
      try {
        payload = buildStatementPayload({
          account_id: selectedAccount.id,
          account_currency: accountCurrency,
          close_date: toDateString(closeDate),
          due_date: toDateString(dueDate),
          total_amount: parseFloat(totalArs) || 0,
          total_amount_usd: parseFloat(totalUsd) || 0,
          stamp_tax: parseFloat(stampTax) || 0,
          lines: reviewLines,
          rate: needsRate ? parseFloat(rateInput) || null : null,
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
            <Button
              onClick={handleSave}
              disabled={saving || selectedCount === 0 || !rateIsValid || !closeDate || !dueDate}
              className="w-full press-effect font-semibold"
            >
              {saving
                ? "Guardando…"
                : `Confirmar y guardar ${selectedCount} movimiento${selectedCount === 1 ? "" : "s"}`}
            </Button>
          ) : undefined
        }
      >
        {step === "upload" ? (
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
                placeholder="Elegí una tarjeta"
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
                disabled={!file || !selectedAccountId}
                className="w-full press-effect font-semibold"
              >
                Analizar resumen
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Cierre</Label>
                <MangoDatePicker value={closeDate} onChange={setCloseDate} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Vencimiento</Label>
                <MangoDatePicker value={dueDate} onChange={setDueDate} />
              </div>
            </div>

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

            {needsRate && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">
                  Cotización dólar (ARS por USD)
                </Label>
                <MoneyInput
                  currency="ARS"
                  step="0.01"
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  placeholder="Ej: 1350"
                  className="tabular-nums"
                />
                <p className="text-[11px] text-muted-foreground">
                  Algunas líneas en dólares no traen el equivalente en pesos del resumen — usamos
                  esta cotización para convertirlas.
                </p>
              </div>
            )}

            {totalMismatch && (
              <p className="text-[11px] text-amber-600">
                El total declarado ({formatCurrency(parsedTotalArs, "ARS")}) difiere de la suma de
                las líneas incluidas ({formatCurrency(computedArsTotal ?? 0, "ARS")}).
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {selectedCount} de {lines.length} gastos incluidos
              </p>
              <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                {lines.map((line) => (
                  <LineRow
                    key={line.id}
                    line={line}
                    accountCurrency={accountCurrency}
                    rate={rateInput}
                    categoryOptions={categoryOptions}
                    onChange={(patch) => updateLine(line.id, patch)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </MangoSheet>
    </>
  )
}
