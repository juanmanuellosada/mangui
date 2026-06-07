"use client"

import { useState, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  PlusCircle,
  Zap,
  Pencil,
  Trash2,
  Info,
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useMultiSelect } from "@/hooks/use-multi-select"
import { SelectionBar, SelectButton, RowCheckbox, selectedItemCn } from "@/components/ui/selection-bar"
import { MangoSheet as ConfirmSheet } from "@/components/ui/mango-sheet"
import { bulkDelete } from "@/lib/bulk-delete"
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
import { useIsDemo } from "@/lib/use-is-demo"
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

async function fetchRules(): Promise<AutoRule[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("auto_rules").select("*").order("priority", { ascending: false })
  if (error) throw error
  return data
}

async function fetchConditions(): Promise<AutoRuleCondition[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("auto_rule_conditions").select("*").order("position", { ascending: true })
  if (error) throw error
  return data
}

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
// ─── RuleCard ──────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule: AutoRule
  conditions: AutoRuleCondition[]
  categories: Category[]
  accounts: Account[]
  onEdit: () => void
  onDelete: () => void
  onToggleActive: (active: boolean) => void
  isToggling: boolean
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
  isDemo?: boolean
}

function RuleCard({
  rule, conditions, categories, accounts,
  onEdit, onDelete, onToggleActive, isToggling,
  selectionMode, isSelected, onToggleSelect, isDemo,
}: RuleCardProps) {
  const summary = ruleSummary(rule, conditions, { categories, accounts })
  const cat = categories.find((c) => c.id === rule.action_category_id)
  const acct = accounts.find((a) => a.id === rule.action_account_id)

  return (
    <div
      onClick={selectionMode ? () => onToggleSelect?.(rule.id) : undefined}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      className={cn(
        "flex items-start gap-3 p-4 border-b border-border/60 last:border-b-0 transition-colors duration-150",
        !rule.is_active && "opacity-60",
        selectionMode && "cursor-pointer",
        isSelected && selectedItemCn(true)
      )}
    >
      {selectionMode ? (
        <div className="mt-0.5 shrink-0">
          <RowCheckbox checked={!!isSelected} onChange={() => onToggleSelect?.(rule.id)} />
        </div>
      ) : (
        <div className={cn("mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center shrink-0", "bg-primary/10 text-primary")}>
          <Zap className="h-4 w-4" />
        </div>
      )}

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
            {cat && <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">{cat.name}</span>}
            {acct && <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{acct.name}</span>}
          </div>
        )}
      </div>

      {!selectionMode && (
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={rule.is_active} onCheckedChange={onToggleActive} disabled={isToggling || isDemo} aria-label={rule.is_active ? "Desactivar regla" : "Activar regla"} />
          <button type="button" onClick={onEdit} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Editar regla">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} disabled={isDemo} title={isDemo ? "No disponible en el modo demo" : undefined} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground disabled:hover:bg-transparent" aria-label="Eliminar regla">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── SuggestedChip ─────────────────────────────────────────────────────────

interface SuggestedChipProps {
  suggestion: SuggestedRule
  onCreateRule: (suggestion: SuggestedRule) => void
}

function SuggestedChip({ suggestion, onCreateRule }: SuggestedChipProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background pl-3 pr-1 py-1 shrink-0">
      <span className="text-xs font-medium whitespace-nowrap">{suggestion.name} &rarr; {suggestion.categoryName}</span>
      <button type="button" onClick={() => onCreateRule(suggestion)} className="h-6 px-2 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap">
        Crear
      </button>
    </div>
  )
}

// ─── Filter types + RuleSortControl ────────────────────────────────────────

type EstadoFilter = "todas" | "activas" | "inactivas"
type SortKey = "recientes" | "nombre" | "prioridad"
type SortDir = "asc" | "desc"

interface RuleFilters {
  search: string
  estado: EstadoFilter
  sortKey: SortKey
  sortDir: SortDir
}

const DEFAULT_FILTERS: RuleFilters = {
  search: "",
  estado: "todas",
  sortKey: "recientes",
  sortDir: "desc",
}

function normalize(s: string) {
  return s.toLowerCase().trim().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

const RULE_SORT_PILLS: { key: SortKey; label: string }[] = [
  { key: "recientes", label: "Recientes" },
  { key: "nombre", label: "Nombre" },
  { key: "prioridad", label: "Prioridad" },
]

function RuleSortControl({
  sortKey, sortDir, onChange,
}: {
  sortKey: SortKey
  sortDir: SortDir
  onChange: (key: SortKey, dir: SortDir) => void
}) {
  function handleClick(key: SortKey) {
    if (key === sortKey) {
      onChange(key, sortDir === "asc" ? "desc" : "asc")
    } else {
      const defaultDir: SortDir = key === "prioridad" || key === "recientes" ? "desc" : "asc"
      onChange(key, defaultDir)
    }
  }

  return (
    <div role="group" aria-label="Ordenar por" className="flex items-center gap-1 flex-wrap shrink-0">
      {RULE_SORT_PILLS.map(({ key, label }) => {
        const isActive = sortKey === key
        const showDir = isActive && key !== "recientes"
        const DirIcon = sortDir === "asc" ? ChevronUp : ChevronDown
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleClick(key)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium",
              "border transition-all duration-150 cursor-pointer select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                : "bg-background border-input text-muted-foreground hover:border-ring/60 hover:text-foreground dark:bg-input/30"
            )}
          >
            <span>{label}</span>
            {showDir && <DirIcon className="h-3 w-3 shrink-0" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

// ─── RuleFilterBar ─────────────────────────────────────────────────────────

function RuleFilterBar({
  filters,
  onChange,
}: {
  filters: RuleFilters
  onChange: (f: RuleFilters) => void
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false)

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.estado !== "todas" ||
    filters.sortKey !== "recientes"

  const activeChips: string[] = []
  if (filters.estado !== "todas") {
    activeChips.push(filters.estado === "activas" ? "Activas" : "Inactivas")
  }
  if (filters.sortKey !== "recientes") {
    activeChips.push(`Orden: ${RULE_SORT_PILLS.find((p) => p.key === filters.sortKey)?.label ?? ""}`)
  }

  function clearAll() {
    onChange(DEFAULT_FILTERS)
  }

  const pillClass = (isSelected: boolean) =>
    cn(
      "inline-flex items-center h-8 px-2.5 rounded-lg text-xs font-medium",
      "border transition-all duration-150 cursor-pointer select-none",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      isSelected
        ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
        : "bg-background border-input text-muted-foreground hover:border-ring/60 hover:text-foreground dark:bg-input/30"
    )

  const secondaryFilters = (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="space-y-1.5">
        <Label className="text-xs">Estado</Label>
        <div role="group" aria-label="Filtrar por estado" className="flex items-center gap-1">
          {(["todas", "activas", "inactivas"] as const).map((v) => {
            const label = v === "todas" ? "Todas" : v === "activas" ? "Activas" : "Inactivas"
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ ...filters, estado: v })}
                aria-pressed={filters.estado === v}
                className={pillClass(filters.estado === v)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Ordenar</Label>
        <RuleSortControl
          sortKey={filters.sortKey}
          sortDir={filters.sortDir}
          onChange={(key, dir) => onChange({ ...filters, sortKey: key, sortDir: dir })}
        />
      </div>
    </div>
  )

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar regla..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className={cn(
              "w-full h-9 pl-9 pr-3 rounded-lg text-sm",
              "bg-background border border-input",
              "placeholder:text-muted-foreground/60",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring",
              "transition-colors duration-150"
            )}
            aria-label="Buscar reglas"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpiar busqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileExpanded((v) => !v)}
          className={cn(
            "lg:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium",
            "border transition-colors duration-150 press-effect cursor-pointer",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            mobileExpanded || hasActiveFilters
              ? "bg-primary/10 border-primary/40 text-primary"
              : "border-input bg-background text-muted-foreground hover:text-foreground"
          )}
          aria-label="Filtros"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filtros</span>
          {activeChips.length > 0 && (
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeChips.length}
            </span>
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-150", mobileExpanded && "rotate-180")} />
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            aria-label="Limpiar filtros"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {!mobileExpanded && activeChips.length > 0 && (
        <div className="lg:hidden flex flex-wrap gap-1.5">
          {activeChips.map((chip, i) => (
            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {chip}
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:text-destructive text-xs transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        </div>
      )}

      <div className="hidden lg:block">
        {secondaryFilters}
      </div>

      {mobileExpanded && (
        <div className="lg:hidden">
          {secondaryFilters}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar todos los filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── RulesList (main) ──────────────────────────────────────────────────────

export function RulesList() {
  const queryClient = useQueryClient()
  const isDemo = useIsDemo()

  const [filters, setFilters] = useState<RuleFilters>(DEFAULT_FILTERS)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AutoRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AutoRule | null>(null)
  const [prefillSuggestion, setPrefillSuggestion] = useState<SuggestedRule | null>(null)
  const ms = useMultiSelect()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)

  const { data: rules = [], isLoading: rulesLoading } = useQuery({ queryKey: RULES_KEY, queryFn: fetchRules })
  const { data: conditions = [], isLoading: condsLoading } = useQuery({ queryKey: RULE_CONDITIONS_KEY, queryFn: fetchConditions })
  const { data: categories = [] } = useQuery({ queryKey: CATEGORIES_KEY, queryFn: fetchCategories })
  const { data: accounts = [] } = useQuery({ queryKey: ACCOUNTS_KEY, queryFn: fetchAccounts })
  const { data: movementsForSuggestions = [] } = useQuery({
    queryKey: ["movements_for_suggestions"],
    queryFn: fetchMovementsForSuggestions,
    staleTime: 120_000,
  })

  const condsByRule = useMemo(() => {
    const map = new Map<string, AutoRuleCondition[]>()
    for (const c of conditions) {
      if (!map.has(c.rule_id)) map.set(c.rule_id, [])
      map.get(c.rule_id)!.push(c)
    }
    return map
  }, [conditions])

  const suggestions = useMemo(
    () => suggestRules(movementsForSuggestions, categories, rules),
    [movementsForSuggestions, categories, rules]
  )

  const filteredRules = useMemo(() => {
    const q = normalize(filters.search)
    return rules
      .filter((r) => {
        if (q && !normalize(r.name).includes(q)) return false
        if (filters.estado === "activas" && !r.is_active) return false
        if (filters.estado === "inactivas" && r.is_active) return false
        return true
      })
      .sort((a, b) => {
        switch (filters.sortKey) {
          case "nombre": {
            const cmp = a.name.localeCompare(b.name, "es")
            return filters.sortDir === "asc" ? cmp : -cmp
          }
          case "prioridad": {
            const cmp = a.priority - b.priority
            return filters.sortDir === "asc" ? cmp : -cmp
          }
          default: {
            const cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            return filters.sortDir === "asc" ? -cmp : cmp
          }
        }
      })
  }, [rules, filters])

  const isFiltered = filters.search.trim() !== "" || filters.estado !== "todas" || filters.sortKey !== "recientes"
  const displayRules = isFiltered ? filteredRules : rules
  const filteredRuleIds = displayRules.map((r) => r.id)

  async function handleBulkDelete() {
    setBulkPending(true)
    const ids = Array.from(ms.selectedIds)
    const result = await bulkDelete("auto_rules", ids)
    setBulkPending(false)
    setConfirmOpen(false)
    ms.exit()
    queryClient.invalidateQueries({ queryKey: RULES_KEY })
    queryClient.invalidateQueries({ queryKey: RULE_CONDITIONS_KEY })
    if (result.failed === 0) {
      toast.success(`Se eliminaron ${result.deleted} regla${result.deleted !== 1 ? "s" : ""}`)
    } else {
      toast.warning(`Se eliminaron ${result.deleted}. ${result.failed} no se pud${result.failed !== 1 ? "ieron" : "o"} eliminar.`)
    }
  }

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const supabase = createClient()
      const { error } = await supabase.from("auto_rules").update({ is_active }).eq("id", id)
      if (error) throw error
    },
    onMutate: async ({ id, is_active }) => {
      await queryClient.cancelQueries({ queryKey: RULES_KEY })
      const prev = queryClient.getQueryData<AutoRule[]>(RULES_KEY)
      queryClient.setQueryData<AutoRule[]>(RULES_KEY, (old = []) => old.map((r) => (r.id === id ? { ...r, is_active } : r)))
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(RULES_KEY, ctx.prev)
      toast.error("No se pudo actualizar la regla")
    },
  })

  const saveMutation = useMutation({
    mutationFn: async ({ values, ruleId }: { values: RuleFormValues; ruleId?: string }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")

      if (ruleId) {
        const { error } = await supabase.from("auto_rules").update({
          name: values.name, match: values.match,
          action_category_id: values.action_category_id,
          action_account_id: values.action_account_id,
          priority: values.priority, is_active: values.is_active,
        }).eq("id", ruleId)
        if (error) throw error

        const { error: delErr } = await supabase.from("auto_rule_conditions").delete().eq("rule_id", ruleId)
        if (delErr) throw delErr

        const newConds = values.conditions.map((c, i) => ({
          rule_id: ruleId, user_id: user.id, field: c.field, operator: c.operator, position: i,
          value_text: c.value_text || null,
          value_num: c.value_num ? parseFloat(c.value_num) : null,
          value_num2: c.value_num2 ? parseFloat(c.value_num2) : null,
        }))
        if (newConds.length > 0) {
          const { error: insErr } = await supabase.from("auto_rule_conditions").insert(newConds)
          if (insErr) throw insErr
        }
      } else {
        const { data: newRule, error: ruleErr } = await supabase.from("auto_rules").insert({
          name: values.name, match: values.match,
          action_category_id: values.action_category_id,
          action_account_id: values.action_account_id,
          priority: values.priority, is_active: values.is_active, user_id: user.id,
        }).select().single()
        if (ruleErr) throw ruleErr

        const newConds = values.conditions.map((c, i) => ({
          rule_id: newRule.id, user_id: user.id, field: c.field, operator: c.operator, position: i,
          value_text: c.value_text || null,
          value_num: c.value_num ? parseFloat(c.value_num) : null,
          value_num2: c.value_num2 ? parseFloat(c.value_num2) : null,
        }))
        if (newConds.length > 0) {
          const { error: condErr } = await supabase.from("auto_rule_conditions").insert(newConds)
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
    onError: () => { toast.error("No se pudo guardar la regla") },
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
    onError: () => { toast.error("No se pudo eliminar la regla") },
  })

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
        id: c.id, field: c.field, operator: c.operator,
        value_text: c.value_text ?? "",
        value_num: c.value_num != null ? String(c.value_num) : "",
        value_num2: c.value_num2 != null ? String(c.value_num2) : "",
      }))
      return {
        name: editingRule.name, match: editingRule.match, conditions: condDrafts,
        action_category_id: editingRule.action_category_id,
        action_account_id: editingRule.action_account_id,
        priority: editingRule.priority, is_active: editingRule.is_active,
      }
    }
    if (prefillSuggestion) {
      return {
        name: prefillSuggestion.name,
        match: "all",
        conditions: [{
          id: `cond_suggest_${prefillSuggestion.conditionField}`,
          field: prefillSuggestion.conditionField,
          operator: prefillSuggestion.conditionOperator,
          value_text: prefillSuggestion.conditionValue,
          value_num: "", value_num2: "",
        }],
        action_category_id: prefillSuggestion.actionCategoryId,
        action_account_id: null,
        priority: 10, is_active: true,
      }
    }
    return undefined
  }

  const isLoading = rulesLoading || condsLoading
  const activeCount = rules.filter((r) => r.is_active).length

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Reglas autom&#225;ticas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rules.length} reglas &middot; {activeCount} activas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && rules.length > 0 && !ms.selectionMode && !isDemo && (
            <SelectButton onClick={ms.enter} />
          )}
          {!ms.selectionMode && (
            <Button
              onClick={() => openNewForm()}
              size="sm"
              disabled={isDemo}
              title={isDemo ? "No disponible en el modo demo" : undefined}
              className="gap-1.5 press-effect cursor-pointer font-semibold shadow-sm shadow-primary/20"
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Nueva regla</span>
            </Button>
          )}
        </div>
      </div>

      {/* Suggested rules */}
      {suggestions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reglas sugeridas</h2>
            <span className="text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded-full">sugerencias detectadas</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {suggestions.map((s) => (
              <SuggestedChip key={s.keyword} suggestion={s} onCreateRule={(sug) => openNewForm(sug)} />
            ))}
          </div>
        </section>
      )}

      {/* Filter bar */}
      {!isLoading && rules.length > 0 && (
        <RuleFilterBar filters={filters} onChange={setFilters} />
      )}

      {/* Rules list */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : displayRules.length === 0 && rules.length > 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">Sin resultados</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">No se encontraron reglas con esos filtros.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>Limpiar filtros</Button>
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">Sin reglas</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Cre&#225; tu primera regla para que mangui categorice movimientos autom&#225;ticamente.
              </p>
            </div>
            <Button type="button" onClick={() => openNewForm()} disabled={isDemo} title={isDemo ? "No disponible en el modo demo" : undefined} className="mt-1 h-9 text-sm">
              <PlusCircle className="h-4 w-4 mr-1.5" />
              Nueva regla
            </Button>
          </div>
        ) : (
          displayRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              conditions={condsByRule.get(rule.id) ?? []}
              categories={categories}
              accounts={accounts}
              onEdit={() => openEditForm(rule)}
              onDelete={() => setDeleteTarget(rule)}
              onToggleActive={(active) => toggleMutation.mutate({ id: rule.id, is_active: active })}
              isToggling={toggleMutation.isPending}
              selectionMode={ms.selectionMode}
              isSelected={ms.isSelected(rule.id)}
              onToggleSelect={ms.toggle}
              isDemo={isDemo}
            />
          ))
        )}
      </div>

      {/* Info note */}
      <div className="flex gap-2 items-start rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
        <p>Las reglas se aplican al crear un movimiento. La de mayor prioridad gana. No sobreescriben tu elecci&#243;n manual.</p>
      </div>

      {/* Form dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) { setShowForm(false); setEditingRule(null); setPrefillSuggestion(null) }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar regla" : "Nueva regla"}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingRule ? "Edit&#225; los detalles de esta regla autom&#225;tica." : "Cre&#225; una nueva regla para categorizar movimientos autom&#225;ticamente."}
            </DialogDescription>
          </DialogHeader>
          <RuleForm
            key={editingRule?.id ?? (prefillSuggestion?.keyword ?? "new")}
            initialValues={getFormInitialValues()}
            categories={categories}
            accounts={accounts}
            isLoading={saveMutation.isPending}
            submitLabel={editingRule ? "Guardar cambios" : "Guardar regla"}
            onSubmit={(values) => saveMutation.mutateAsync({ values, ruleId: editingRule?.id })}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent compact className="max-w-sm">
          <DialogHeader>
            <DialogTitle>&#191;Eliminar regla?</DialogTitle>
            <DialogDescription>
              Se eliminar&#225; la regla <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong> y todas sus condiciones.
              Esta acci&#243;n no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancelar</Button>
            <Button
              type="button"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Selection bar */}
      {ms.selectionMode && (
        <SelectionBar
          count={ms.count}
          total={filteredRuleIds.length}
          onSelectAll={() => ms.toggleAll(filteredRuleIds)}
          onDelete={() => setConfirmOpen(true)}
          onCancel={ms.exit}
          isPending={bulkPending}
        />
      )}

      {/* Bulk delete confirm */}
      <ConfirmSheet
        compact
        open={confirmOpen}
        onOpenChange={(v) => { if (!v) setConfirmOpen(false) }}
        title="Eliminar reglas"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={bulkPending}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkPending || isDemo} className="press-effect">
              {bulkPending ? "Eliminando..." : `Eliminar (${ms.count})`}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          &#191;Eliminar {ms.count} regla{ms.count !== 1 ? "s" : ""} y sus condiciones? Esta acci&#243;n no se puede deshacer.
        </p>
      </ConfirmSheet>
    </div>
  )
}
