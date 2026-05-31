"use client"

import { useState, useEffect, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MangoSelect } from "@/components/ui/mango-select"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  operatorsForField,
  FIELD_LABELS,
  OPERATOR_LABELS,
  ruleMatches,
  RULES_KEY,
  RULE_CONDITIONS_KEY,
  type AutoRule,
  type AutoRuleCondition,
  type RuleField,
  type RuleOperator,
  type RuleMatch,
  type Category,
  type Account,
} from "@/lib/rules"
import { ACCOUNTS_KEY, CATEGORIES_KEY } from "@/lib/movements"
import { formatCurrency } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConditionDraft {
  id: string // temp local id
  field: RuleField
  operator: RuleOperator
  value_text: string
  value_num: string
  value_num2: string
}

export interface RuleFormValues {
  name: string
  match: RuleMatch
  conditions: ConditionDraft[]
  action_category_id: string | null
  action_account_id: string | null
  priority: number
  is_active: boolean
}

interface RuleFormProps {
  initialValues?: Partial<RuleFormValues>
  onSubmit: (values: RuleFormValues) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
  categories: Category[]
  accounts: Account[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let condId = 0
function newCondId() {
  return `cond_${++condId}`
}

function defaultCondition(): ConditionDraft {
  return {
    id: newCondId(),
    field: "note",
    operator: "contains",
    value_text: "",
    value_num: "",
    value_num2: "",
  }
}

function conditionToRule(cond: ConditionDraft): AutoRuleCondition {
  return {
    id: cond.id,
    rule_id: "",
    user_id: "",
    created_at: "",
    updated_at: "",
    field: cond.field,
    operator: cond.operator,
    position: 0,
    value_text: cond.value_text || null,
    value_num: cond.value_num ? parseFloat(cond.value_num) : null,
    value_num2: cond.value_num2 ? parseFloat(cond.value_num2) : null,
  }
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchRecentMovements() {
  const supabase = createClient()
  const { data } = await supabase
    .from("movements")
    .select("id, note, amount, account_id, type")
    .order("date", { ascending: false })
    .limit(300)
  return data ?? []
}

// ── Condition row component ───────────────────────────────────────────────────

interface ConditionRowProps {
  cond: ConditionDraft
  accounts: Account[]
  onChange: (updated: ConditionDraft) => void
  onRemove: () => void
  canRemove: boolean
}

function ConditionRow({ cond, accounts, onChange, onRemove, canRemove }: ConditionRowProps) {
  const allowedOps = operatorsForField(cond.field)

  function handleFieldChange(field: RuleField) {
    const ops = operatorsForField(field)
    onChange({
      ...cond,
      field,
      operator: ops[0],
      value_text: "",
      value_num: "",
      value_num2: "",
    })
  }

  function handleOperatorChange(operator: RuleOperator) {
    onChange({ ...cond, operator })
  }

  return (
    <div className="flex gap-2 items-start rounded-xl border border-border/60 bg-muted/20 p-3">
      {/* Field */}
      <div className="flex-1 min-w-0 space-y-1">
        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Campo</Label>
        <MangoSelect
          value={cond.field}
          onChange={(v) => v && handleFieldChange(v as RuleField)}
          options={(["note", "amount", "account", "type"] as RuleField[]).map((f) => ({
            value: f,
            label: FIELD_LABELS[f],
          }))}
          triggerClassName="h-8 text-xs"
        />
      </div>

      {/* Operator */}
      <div className="flex-1 min-w-0 space-y-1">
        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Operador</Label>
        <MangoSelect
          value={cond.operator}
          onChange={(v) => v && handleOperatorChange(v as RuleOperator)}
          options={allowedOps.map((op) => ({ value: op, label: OPERATOR_LABELS[op] }))}
          triggerClassName="h-8 text-xs"
        />
      </div>

      {/* Value */}
      <div className="flex-1 min-w-0 space-y-1">
        <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Valor</Label>
        {cond.field === "note" && (
          <Input
            className="h-8 text-xs"
            placeholder="Ej: Netflix"
            value={cond.value_text}
            onChange={(e) => onChange({ ...cond, value_text: e.target.value })}
          />
        )}
        {cond.field === "amount" && cond.operator !== "between" && (
          <Input
            className="h-8 text-xs tabular-nums"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="0"
            value={cond.value_num}
            onChange={(e) => onChange({ ...cond, value_num: e.target.value })}
          />
        )}
        {cond.field === "amount" && cond.operator === "between" && (
          <div className="flex gap-1 items-center">
            <Input
              className="h-8 text-xs tabular-nums"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="Min"
              value={cond.value_num}
              onChange={(e) => onChange({ ...cond, value_num: e.target.value })}
            />
            <span className="text-xs text-muted-foreground shrink-0">–</span>
            <Input
              className="h-8 text-xs tabular-nums"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="Max"
              value={cond.value_num2}
              onChange={(e) => onChange({ ...cond, value_num2: e.target.value })}
            />
          </div>
        )}
        {cond.field === "account" && (
          <MangoSelect
            value={cond.value_text || "none"}
            onChange={(v) => onChange({ ...cond, value_text: !v || v === "none" ? "" : v })}
            options={[
              { value: "none", label: "– Seleccionar –" },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
            triggerClassName="h-8 text-xs"
            placeholder="Cuenta"
          />
        )}
        {cond.field === "type" && (
          <MangoSelect
            value={cond.value_text || "none"}
            onChange={(v) => onChange({ ...cond, value_text: !v || v === "none" ? "" : v })}
            options={[
              { value: "none", label: "– Seleccionar –" },
              { value: "expense", label: "Gasto" },
              { value: "income", label: "Ingreso" },
            ]}
            triggerClassName="h-8 text-xs"
            placeholder="Tipo"
          />
        )}
      </div>

      {/* Remove button */}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-6 h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Eliminar condición"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Live preview ──────────────────────────────────────────────────────────────

interface LivePreviewProps {
  conditions: ConditionDraft[]
  match: RuleMatch
}

function LivePreview({ conditions, match }: LivePreviewProps) {
  const { data: movements = [] } = useQuery({
    queryKey: ["movements_preview"],
    queryFn: fetchRecentMovements,
    staleTime: 60_000,
  })

  const fakeRule: AutoRule = {
    id: "preview",
    name: "preview",
    match,
    priority: 0,
    is_active: true,
    action_category_id: null,
    action_account_id: null,
    user_id: "",
    created_at: "",
    updated_at: "",
  }

  const fakeConds = conditions.map((c, i) => ({ ...conditionToRule(c), position: i }))

  const matchingMovements = movements.filter((m) =>
    ruleMatches(fakeRule, fakeConds, {
      note: m.note ?? undefined,
      amount: m.amount,
      account_id: m.account_id,
      type: m.type as "income" | "expense",
    })
  )

  const count = matchingMovements.length
  const preview = matchingMovements.slice(0, 3)

  if (conditions.length === 0 || conditions.every((c) => !c.value_text && !c.value_num)) {
    return null
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        <span className="text-foreground font-semibold tabular-nums">{count}</span>{" "}
        {count === 1 ? "movimiento coincidiría" : "movimientos coincidirían"} con el historial reciente
      </p>
      {preview.length > 0 && (
        <ul className="space-y-1">
          {preview.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate max-w-[60%]">{m.note || "Sin nota"}</span>
              <span className="tabular-nums font-medium">
                {formatCurrency(m.amount, "ARS")}
              </span>
            </li>
          ))}
          {count > 3 && (
            <li className="text-[11px] text-muted-foreground">
              + {count - 3} más
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function RuleForm({
  initialValues,
  onSubmit,
  isLoading,
  submitLabel = "Guardar regla",
  categories,
  accounts,
}: RuleFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "")
  const [match, setMatch] = useState<RuleMatch>(initialValues?.match ?? "all")
  const [conditions, setConditions] = useState<ConditionDraft[]>(
    initialValues?.conditions?.length
      ? initialValues.conditions
      : [defaultCondition()]
  )
  const [actionCategoryId, setActionCategoryId] = useState<string | null>(
    initialValues?.action_category_id ?? null
  )
  const [actionAccountId, setActionAccountId] = useState<string | null>(
    initialValues?.action_account_id ?? null
  )
  const [priority, setPriority] = useState<number>(initialValues?.priority ?? 10)
  const [isActive, setIsActive] = useState<boolean>(initialValues?.is_active ?? true)
  const [formError, setFormError] = useState<string | null>(null)

  function addCondition() {
    setConditions((prev) => [...prev, defaultCondition()])
  }

  function updateCondition(id: string, updated: ConditionDraft) {
    setConditions((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }

  function removeCondition(id: string) {
    setConditions((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError("El nombre de la regla es obligatorio.")
      return
    }
    if (conditions.length === 0) {
      setFormError("Agregá al menos una condición.")
      return
    }
    if (!actionCategoryId && !actionAccountId) {
      setFormError("Seleccioná al menos una acción (categoría o cuenta).")
      return
    }

    await onSubmit({
      name: name.trim(),
      match,
      conditions,
      action_category_id: actionCategoryId,
      action_account_id: actionAccountId,
      priority,
      is_active: isActive,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="rule-name" className="text-xs text-muted-foreground font-medium">
          Nombre de la regla
        </Label>
        <Input
          id="rule-name"
          placeholder="Ej: Netflix → Suscripciones"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
      </div>

      {/* Match toggle */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground font-medium">Condiciones</Label>
        <div className="flex rounded-xl bg-muted p-1 gap-1 w-fit">
          {(["all", "any"] as RuleMatch[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMatch(m)}
              className={cn(
                "px-4 h-8 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                match === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "all" ? "Coinciden TODAS" : "Coincide ALGUNA"}
            </button>
          ))}
        </div>
      </div>

      {/* Conditions list */}
      <div className="space-y-2">
        {conditions.map((cond) => (
          <ConditionRow
            key={cond.id}
            cond={cond}
            accounts={accounts}
            onChange={(updated) => updateCondition(cond.id, updated)}
            onRemove={() => removeCondition(cond.id)}
            canRemove={conditions.length > 1}
          />
        ))}
        <button
          type="button"
          onClick={addCondition}
          className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar condición
        </button>
      </div>

      {/* Live preview */}
      <LivePreview conditions={conditions} match={match} />

      {/* Actions */}
      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground font-medium">Acciones</Label>

        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Categoría (opcional)</Label>
          <MangoSelect
            value={actionCategoryId ?? "none"}
            onChange={(v) => setActionCategoryId(!v || v === "none" ? null : v)}
            options={[
              { value: "none", label: "– Sin cambio –" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            placeholder="– Sin cambio –"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Cuenta (opcional)</Label>
          <MangoSelect
            value={actionAccountId ?? "none"}
            onChange={(v) => setActionAccountId(!v || v === "none" ? null : v)}
            options={[
              { value: "none", label: "– Sin cambio –" },
              ...accounts.map((a) => ({ value: a.id, label: a.name })),
            ]}
            placeholder="– Sin cambio –"
          />
        </div>
      </div>

      {/* Priority + active toggle */}
      <div className="flex gap-4 items-end">
        <div className="space-y-1.5 flex-1">
          <Label htmlFor="priority" className="text-xs text-muted-foreground font-medium">
            Prioridad (mayor = primero)
          </Label>
          <Input
            id="priority"
            type="number"
            min={0}
            max={999}
            step={1}
            inputMode="numeric"
            className="tabular-nums"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* Error */}
      {formError && (
        <p className="text-xs text-destructive rounded-lg bg-destructive/10 px-3 py-2">
          {formError}
        </p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        className="w-full press-effect font-semibold h-11"
        disabled={isLoading}
      >
        {isLoading ? "Guardando…" : submitLabel}
      </Button>
    </form>
  )
}
