"use client"

import { useState, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Plus,
  Zap,
  Pencil,
  Trash2,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import {
  RULES_KEY,
  RULE_CONDITIONS_KEY,
  ruleSummary,
  suggestRules,
  type AutoRule,
  type AutoRuleCondition,
  type Category,
  type Account,
  type SuggestedRule,
} from "@/lib/rules"
import { ACCOUNTS_KEY, CATEGORIES_KEY } from "@/lib/movements"
import { RuleForm, type RuleFormValues, type ConditionDraft } from "./rule-form"

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchRules(): Promise<AutoRule[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("auto_rules")
    .select("*")
    .order("priority", { ascending: false })
  if (error) throw error
  return data
}

async function fetchConditions(): Promise<AutoRuleCondition[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("auto_rule_conditions")
    .select("*")
    .order("position", { ascending: true })
  if (error) throw error
  return data
}

async function fetchAccounts(): Promise<Account[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at")
  if (error) throw error
  return data
}

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name")
  if (error) throw error
  return data
}

async function fetchMovementsForSuggestions() {
  const supabase = createClient()
  const { data } = await supabase
    .from("movements")
    .select("note, category_id, type")
    .not("note", "is", null)
    .not("category_id", "is", null)
    .order("date", { ascending: false })
    .limit(500)
  return data ?? []
}

// ── Rule card ─────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule: AutoRule
  conditions: AutoRuleCondition[]
  categories: Category[]
  accounts: Account[]
  onEdit: () => void
  onDelete: () => void
  onToggleActive: (active: boolean) => void
  isToggling: boolean
}

function RuleCard({
  rule,
  conditions,
  categories,
  accounts,
  onEdit,
  onDelete,
  onToggleActive,
  isToggling,
}: RuleCardProps) {
  const summary = ruleSummary(rule, conditions, { categories, accounts })

  // Get category/account for display icon
  const cat = categories.find((c) => c.id === rule.action_category_id)
  const acct = accounts.find((a) => a.id === rule.action_account_id)

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 border-b border-border/60 last:border-b-0 transition-colors duration-150",
        !rule.is_active && "opacity-60"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
        "bg-primary/10 text-primary"
      )}>
        <Zap className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold truncate">{rule.name}</span>
          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full tabular-nums shrink-0">
            P{rule.priority}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{summary}</p>
        {(cat || acct) && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {cat && (
              <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {cat.name}
              </span>
            )}
            {acct && (
              <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {acct.name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={rule.is_active}
          onCheckedChange={onToggleActive}
          disabled={isToggling}
          aria-label={rule.is_active ? "Desactivar regla" : "Activar regla"}
        />
        <button
          type="button"
          onClick={onEdit}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Editar regla"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Eliminar regla"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Suggested rule chip ───────────────────────────────────────────────────────

interface SuggestedChipProps {
  suggestion: SuggestedRule
  onCreateRule: (suggestion: SuggestedRule) => void
}

function SuggestedChip({ suggestion, onCreateRule }: SuggestedChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background pl-3 pr-1 py-1 shrink-0">
      <span className="text-xs font-medium whitespace-nowrap">
        {suggestion.name} → {suggestion.categoryName}
      </span>
      <button
        type="button"
        onClick={() => onCreateRule(suggestion)}
        className="h-6 px-2 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
      >
        Crear
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type FilterTab = "todas" | "activas" | "inactivas"

export function RulesList() {
  const queryClient = useQueryClient()

  const [filter, setFilter] = useState<FilterTab>("todas")
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AutoRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AutoRule | null>(null)
  const [prefillSuggestion, setPrefillSuggestion] = useState<SuggestedRule | null>(null)

  // Queries
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: RULES_KEY,
    queryFn: fetchRules,
  })

  const { data: conditions = [], isLoading: condsLoading } = useQuery({
    queryKey: RULE_CONDITIONS_KEY,
    queryFn: fetchConditions,
  })

  const { data: categories = [] } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: fetchCategories,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  })

  const { data: movementsForSuggestions = [] } = useQuery({
    queryKey: ["movements_for_suggestions"],
    queryFn: fetchMovementsForSuggestions,
    staleTime: 120_000,
  })

  // Conditions grouped by rule_id
  const condsByRule = useMemo(() => {
    const map = new Map<string, AutoRuleCondition[]>()
    for (const c of conditions) {
      if (!map.has(c.rule_id)) map.set(c.rule_id, [])
      map.get(c.rule_id)!.push(c)
    }
    return map
  }, [conditions])

  // Heuristic suggestions
  const suggestions = useMemo(
    () => suggestRules(movementsForSuggestions, categories, rules),
    [movementsForSuggestions, categories, rules]
  )

  // Filtered rules
  const filteredRules = useMemo(() => {
    if (filter === "activas") return rules.filter((r) => r.is_active)
    if (filter === "inactivas") return rules.filter((r) => !r.is_active)
    return rules
  }, [rules, filter])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from("auto_rules")
        .update({ is_active })
        .eq("id", id)
      if (error) throw error
    },
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: RULES_KEY })
      const prev = queryClient.getQueryData<AutoRule[]>(RULES_KEY)
      queryClient.setQueryData<AutoRule[]>(RULES_KEY, (old = []) =>
        old.map((r) => (r.id === id ? { ...r, is_active } : r))
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(RULES_KEY, ctx.prev)
      toast.error("No se pudo actualizar la regla")
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({
      values,
      ruleId,
    }: {
      values: RuleFormValues
      ruleId?: string
    }) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      if (ruleId) {
        // Update rule
        const { error } = await supabase
          .from("auto_rules")
          .update({
            name: values.name,
            match: values.match,
            action_category_id: values.action_category_id,
            action_account_id: values.action_account_id,
            priority: values.priority,
            is_active: values.is_active,
          })
          .eq("id", ruleId)
        if (error) throw error

        // Delete old conditions and re-insert
        const { error: delErr } = await supabase
          .from("auto_rule_conditions")
          .delete()
          .eq("rule_id", ruleId)
        if (delErr) throw delErr

        const newConds = values.conditions.map((c, i) => ({
          rule_id: ruleId,
          user_id: user.id,
          field: c.field,
          operator: c.operator,
          position: i,
          value_text: c.value_text || null,
          value_num: c.value_num ? parseFloat(c.value_num) : null,
          value_num2: c.value_num2 ? parseFloat(c.value_num2) : null,
        }))
        if (newConds.length > 0) {
          const { error: insErr } = await supabase
            .from("auto_rule_conditions")
            .insert(newConds)
          if (insErr) throw insErr
        }
      } else {
        // Create rule
        const { data: newRule, error: ruleErr } = await supabase
          .from("auto_rules")
          .insert({
            name: values.name,
            match: values.match,
            action_category_id: values.action_category_id,
            action_account_id: values.action_account_id,
            priority: values.priority,
            is_active: values.is_active,
            user_id: user.id,
          })
          .select()
          .single()
        if (ruleErr) throw ruleErr

        const newConds = values.conditions.map((c, i) => ({
          rule_id: newRule.id,
          user_id: user.id,
          field: c.field,
          operator: c.operator,
          position: i,
          value_text: c.value_text || null,
          value_num: c.value_num ? parseFloat(c.value_num) : null,
          value_num2: c.value_num2 ? parseFloat(c.value_num2) : null,
        }))
        if (newConds.length > 0) {
          const { error: condErr } = await supabase
            .from("auto_rule_conditions")
            .insert(newConds)
          if (condErr) throw condErr
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RULES_KEY })
      queryClient.invalidateQueries({ queryKey: RULE_CONDITIONS_KEY })
      setShowForm(false)
      setEditingRule(null)
      setPrefillSuggestion(null)
      toast.success(editingRule ? "Regla actualizada" : "Regla creada")
    },
    onError: () => {
      toast.error("No se pudo guardar la regla")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("auto_rules").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RULES_KEY })
      queryClient.invalidateQueries({ queryKey: RULE_CONDITIONS_KEY })
      setDeleteTarget(null)
      toast.success("Regla eliminada")
    },
    onError: () => {
      toast.error("No se pudo eliminar la regla")
    },
  })

  // ── Form helpers ───────────────────────────────────────────────────────────

  function openNewForm(prefill?: SuggestedRule) {
    setEditingRule(null)
    setPrefillSuggestion(prefill ?? null)
    setShowForm(true)
  }

  function openEditForm(rule: AutoRule) {
    setEditingRule(rule)
    setPrefillSuggestion(null)
    setShowForm(true)
  }

  function getFormInitialValues(): Partial<RuleFormValues> | undefined {
    if (editingRule) {
      const conds = condsByRule.get(editingRule.id) ?? []
      const sorted = [...conds].sort((a, b) => a.position - b.position)
      const condDrafts: ConditionDraft[] = sorted.map((c) => ({
        id: c.id,
        field: c.field,
        operator: c.operator,
        value_text: c.value_text ?? "",
        value_num: c.value_num != null ? String(c.value_num) : "",
        value_num2: c.value_num2 != null ? String(c.value_num2) : "",
      }))
      return {
        name: editingRule.name,
        match: editingRule.match,
        conditions: condDrafts,
        action_category_id: editingRule.action_category_id,
        action_account_id: editingRule.action_account_id,
        priority: editingRule.priority,
        is_active: editingRule.is_active,
      }
    }
    if (prefillSuggestion) {
      return {
        name: prefillSuggestion.name,
        match: "all",
        conditions: [
          {
            id: `cond_suggest_${Date.now()}`,
            field: prefillSuggestion.conditionField,
            operator: prefillSuggestion.conditionOperator,
            value_text: prefillSuggestion.conditionValue,
            value_num: "",
            value_num2: "",
          },
        ],
        action_category_id: prefillSuggestion.actionCategoryId,
        action_account_id: null,
        priority: 10,
        is_active: true,
      }
    }
    return undefined
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLoading = rulesLoading || condsLoading
  const activeCount = rules.filter((r) => r.is_active).length

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Reglas automáticas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rules.length} reglas · {activeCount} activas
          </p>
        </div>
        <button
          type="button"
          onClick={() => openNewForm()}
          className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center",
            "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
            "hover:bg-primary/90 transition-all duration-150 cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="Nueva regla"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Suggested rules */}
      {suggestions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Reglas sugeridas
            </h2>
            <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">
              sugerencias detectadas
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {suggestions.map((s) => (
              <SuggestedChip
                key={s.keyword}
                suggestion={s}
                onCreateRule={(sug) => openNewForm(sug)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {(["todas", "activas", "inactivas"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={cn(
              "flex-1 h-8 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer capitalize",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Rules list */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">Sin reglas</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {filter === "todas"
                  ? "Creá tu primera regla para que mangui categorice movimientos automáticamente."
                  : `No hay reglas ${filter} por ahora.`}
              </p>
            </div>
            {filter === "todas" && (
              <Button
                type="button"
                onClick={() => openNewForm()}
                className="mt-1 h-9 text-sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Nueva regla
              </Button>
            )}
          </div>
        ) : (
          filteredRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              conditions={condsByRule.get(rule.id) ?? []}
              categories={categories}
              accounts={accounts}
              onEdit={() => openEditForm(rule)}
              onDelete={() => setDeleteTarget(rule)}
              onToggleActive={(active) =>
                toggleMutation.mutate({ id: rule.id, is_active: active })
              }
              isToggling={toggleMutation.isPending}
            />
          ))
        )}
      </div>

      {/* Info note */}
      <div className="flex gap-2 items-start rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
        <p>
          Las reglas se aplican al crear un movimiento. La de mayor prioridad gana.
          No sobreescriben tu elección manual.
        </p>
      </div>

      {/* FAB for mobile */}
      <button
        type="button"
        onClick={() => openNewForm()}
        className={cn(
          "lg:hidden fixed bottom-20 right-4 h-14 w-14 rounded-full z-30",
          "flex items-center justify-center",
          "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
          "hover:bg-primary/90 active:scale-95 transition-all duration-150 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        aria-label="Nueva regla"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Form dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false)
            setEditingRule(null)
            setPrefillSuggestion(null)
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Editar regla" : "Nueva regla"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {editingRule
                ? "Editá los detalles de esta regla automática."
                : "Creá una nueva regla para categorizar movimientos automáticamente."}
            </DialogDescription>
          </DialogHeader>
          <RuleForm
            key={editingRule?.id ?? (prefillSuggestion?.keyword ?? "new")}
            initialValues={getFormInitialValues()}
            categories={categories}
            accounts={accounts}
            isLoading={saveMutation.isPending}
            submitLabel={editingRule ? "Guardar cambios" : "Guardar regla"}
            onSubmit={(values) =>
              saveMutation.mutateAsync({
                values,
                ruleId: editingRule?.id,
              })
            }
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar regla?</DialogTitle>
            <DialogDescription>
              Se eliminará la regla{" "}
              <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong> y todas sus condiciones.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
