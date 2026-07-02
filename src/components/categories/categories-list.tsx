"use client"

import { useState, useEffect, useMemo } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Tag, Search, X, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMultiSelect } from "@/hooks/use-multi-select"
import { SelectionBar, SelectButton, RowCheckbox, selectedItemCn } from "@/components/ui/selection-bar"
import { bulkDelete } from "@/lib/bulk-delete"
import { MangoSheet } from "@/components/ui/mango-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { IconPicker } from "@/components/ui/icon-picker"
import { renderCategoryIcon } from "@/lib/categories"
import { createClient } from "@/lib/supabase/client"
import { CATEGORIES_KEY, MOVEMENTS_KEY } from "@/lib/movements"
import { cn } from "@/lib/utils"
import { useIsDemo } from "@/lib/use-is-demo"
import type { Tables } from "@/lib/database.types"
import { useCategories } from "@/lib/hooks/use-categories"
import { QueryError } from "@/components/ui/query-error"

type Category = Tables<"categories">
type CategoryType = "income" | "expense"

// ── Filter helpers ────────────────────────────────────────────────────────────

type TypeFilter = "todas" | CategoryType
type SortKey = "nombre" | "recientes"
type SortDir = "asc" | "desc"

interface CatFilters {
  search: string
  type: TypeFilter
  sortKey: SortKey
  sortDir: SortDir
}

const DEFAULT_FILTERS: CatFilters = {
  search: "",
  type: "todas",
  sortKey: "nombre",
  sortDir: "asc",
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

function isFiltersActive(f: CatFilters) {
  return (
    f.search.trim() !== "" ||
    f.type !== "todas" ||
    f.sortKey !== "nombre"
  )
}

// ── Category form schema ──────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50, "Máximo 50 caracteres"),
  type: z.enum(["income", "expense"]),
  icon: z.string().optional(),
})
type CategoryFormValues = z.infer<typeof categorySchema>

// ── Category form ─────────────────────────────────────────────────────────────

function CategoryForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel,
  userId,
  onDelete,
  isDemo,
}: {
  defaultValues?: Partial<CategoryFormValues>
  onSubmit: (v: CategoryFormValues) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
  userId?: string
  onDelete?: () => void
  isDemo?: boolean
}) {
  const [pickerOpen, setPickerOpen] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(categorySchema) as unknown as Resolver<CategoryFormValues, any>,
    defaultValues: {
      name: "",
      type: "expense",
      icon: "",
      ...defaultValues,
    },
  })

  const type = watch("type")
  const icon = watch("icon")

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Type segmented control */}
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["income", "expense"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setValue("type", t, { shouldValidate: true })}
                className={cn(
                  "h-10 rounded-xl text-sm font-semibold border transition-all duration-150 cursor-pointer press-effect",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  type === t && t === "income"
                    ? "bg-success/15 border-success/40 text-success"
                    : type === t && t === "expense"
                    ? "bg-destructive/10 border-destructive/40 text-destructive"
                    : "bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {t === "income" ? "+ Ingreso" : "− Gasto"}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="cat-name">Nombre</Label>
          <Input
            id="cat-name"
            placeholder="Ej: Supermercado, Sueldo…"
            {...register("name")}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Icon picker trigger */}
        <div className="space-y-1.5">
          <Label>Ícono</Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={cn(
                "flex items-center gap-3 w-full h-11 pl-3 rounded-xl border border-input bg-background",
                "text-sm transition-colors duration-150 cursor-pointer",
                "hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                icon ? "pr-10" : "pr-3"
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60 border border-border/40 overflow-hidden flex-shrink-0">
                {icon ? (
                  renderCategoryIcon(icon, { size: "h-5 w-5" })
                ) : (
                  <Tag className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <span className="text-muted-foreground flex-1 text-left">
                {icon ? "Cambiar ícono" : "Elegir ícono…"}
              </span>
            </button>
            {icon && (
              <button
                type="button"
                onClick={() => setValue("icon", "")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Quitar ícono"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className={cn("flex gap-2", onDelete ? "flex-row items-center" : "")}>
          {onDelete && (
            <Button
              type="button"
              variant="outline"
              className="shrink-0 press-effect text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={onDelete}
              disabled={isDemo}
              title={isDemo ? "No disponible en el modo demo" : undefined}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          )}
          <Button
            type="submit"
            className={cn("press-effect", onDelete ? "flex-1" : "w-full")}
            disabled={isLoading || isDemo}
            title={isDemo ? "No disponible en el modo demo" : undefined}
          >
            {isLoading ? "Guardando…" : (submitLabel ?? "Guardar")}
          </Button>
        </div>
      </form>

      {/* Icon picker — rendered outside the form so it doesn't submit */}
      <IconPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={icon ?? ""}
        onChange={(v) => setValue("icon", v, { shouldValidate: true })}
        userId={userId}
        logoCatalog="categories"
      />
    </>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function CategoryCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-4 flex items-center gap-3">
      <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ── Category card ─────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  onEdit,
  onDeleteRequest,
  selectionMode,
  isSelected,
  onToggle,
  isDemo,
}: {
  category: Category
  onEdit: (c: Category) => void
  onDeleteRequest: (c: Category) => void
  selectionMode?: boolean
  isSelected?: boolean
  onToggle?: (id: string) => void
  isDemo?: boolean
}) {
  function handleCardClick() {
    if (selectionMode && onToggle) onToggle(category.id)
  }

  return (
    <div
      onClick={selectionMode ? handleCardClick : undefined}
      role={selectionMode ? "checkbox" : undefined}
      aria-checked={selectionMode ? isSelected : undefined}
      className={cn(
        "rounded-2xl border border-border/60 bg-card px-4 py-4 flex items-center gap-3",
        "hover:border-primary/20 hover:shadow-sm transition-all duration-150",
        selectionMode && "cursor-pointer",
        isSelected && selectedItemCn(true)
      )}
    >
      {/* Checkbox (selection mode) or Icon */}
      {selectionMode ? (
        <RowCheckbox
          checked={!!isSelected}
          onChange={() => onToggle?.(category.id)}
          label={`Seleccionar ${category.name}`}
        />
      ) : (
        <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-muted/60 overflow-hidden">
          {renderCategoryIcon(category.icon, { size: "h-6 w-6", className: "text-muted-foreground", logoFill: true })}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{category.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              category.type === "income"
                ? "bg-success/15 text-success"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {category.type === "income" ? "Ingreso" : "Gasto"}
          </span>
        </div>
      </div>

      {/* Actions — hidden in selection mode */}
      {!selectionMode && (
        <div className="flex gap-0.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            title={isDemo ? "No disponible en el modo demo" : "Editar categoría"}
            className="press-effect cursor-pointer"
            onClick={() => onEdit(category)}
            disabled={isDemo}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={isDemo ? "No disponible en el modo demo" : "Eliminar categoría"}
            className="press-effect cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onDeleteRequest(category) }}
            disabled={isDemo}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Sort control ──────────────────────────────────────────────────────────────

const SORT_PILLS: { key: SortKey; label: string }[] = [
  { key: "nombre", label: "Nombre" },
  { key: "recientes", label: "Recientes" },
]

function SortControl({
  sortKey,
  sortDir,
  onChange,
}: {
  sortKey: SortKey
  sortDir: SortDir
  onChange: (key: SortKey, dir: SortDir) => void
}) {
  function handleClick(key: SortKey) {
    if (key === sortKey) {
      onChange(key, sortDir === "asc" ? "desc" : "asc")
    } else {
      onChange(key, key === "nombre" ? "asc" : "desc")
    }
  }

  return (
    <div role="group" aria-label="Ordenar por" className="flex items-center gap-1 shrink-0">
      {SORT_PILLS.map(({ key, label }) => {
        const isActive = sortKey === key
        const showDir = isActive
        const DirIcon = sortDir === "asc" ? ChevronUp : ChevronDown
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleClick(key)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1 h-9 px-3 rounded-lg text-sm font-medium",
              "border transition-all duration-150 cursor-pointer select-none motion-reduce:transition-none",
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

// ── Filter bar ────────────────────────────────────────────────────────────────

function CategoriesFilterBar({
  filters,
  onChange,
  resultCount,
  totalCount,
}: {
  filters: CatFilters
  onChange: (f: CatFilters) => void
  resultCount: number
  totalCount: number
}) {
  const active = isFiltersActive(filters)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap lg:flex-nowrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Buscar…"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-8 h-9 text-sm"
            aria-label="Buscar categorías"
          />
        </div>

        {/* Type segmented */}
        <div
          role="group"
          aria-label="Filtrar por tipo"
          className="flex items-center gap-1 shrink-0"
        >
          {(["todas", "income", "expense"] as const).map((t) => {
            const label = t === "todas" ? "Todas" : t === "income" ? "Ingresos" : "Gastos"
            const isActive = filters.type === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ ...filters, type: t })}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex items-center h-9 px-3 rounded-lg text-sm font-medium",
                  "border transition-all duration-150 cursor-pointer select-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? t === "income"
                      ? "bg-success/15 border-success/40 text-success"
                      : t === "expense"
                      ? "bg-destructive/10 border-destructive/40 text-destructive"
                      : "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                    : "bg-background border-input text-muted-foreground hover:border-ring/60 hover:text-foreground dark:bg-input/30"
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Sort */}
        <SortControl
          sortKey={filters.sortKey}
          sortDir={filters.sortDir}
          onChange={(key, dir) => onChange({ ...filters, sortKey: key, sortDir: dir })}
        />
      </div>

      {/* Result count + clear */}
      {active && (
        <div className="flex items-center gap-3 px-0.5">
          <span className="text-xs text-muted-foreground">
            {resultCount === totalCount
              ? `${resultCount} ${resultCount === 1 ? "categoría" : "categorías"}`
              : `${resultCount} de ${totalCount} ${totalCount === 1 ? "categoría" : "categorías"}`}
          </span>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className={cn(
              "inline-flex items-center gap-1 text-xs text-muted-foreground",
              "hover:text-foreground transition-colors duration-150 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            )}
          >
            <X className="h-3 w-3" aria-hidden />
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}

// ── Create sheet ──────────────────────────────────────────────────────────────

function CreateCategorySheet({ userId, isDemo }: { userId?: string; isDemo?: boolean }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("No autenticado")
      const { data, error } = await supabase
        .from("categories")
        .insert({
          user_id: user.id,
          name: values.name.trim(),
          type: values.type,
          icon: values.icon?.trim() || null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (newCat) => {
      queryClient.setQueryData<Category[]>(CATEGORIES_KEY, (old = []) => [...old, newCat])
      toast.success("Categoría creada")
      setOpen(false)
    },
    onError: (err: Error) => {
      const msg = err.message.includes("unique")
        ? "Ya existe una categoría con ese nombre y tipo."
        : err.message
      toast.error("Error al crear categoría", { description: msg })
    },
  })

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2 font-semibold press-effect" aria-label="Nueva categoría">
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Nueva categoría</span>
      </Button>
      <MangoSheet
        open={open}
        onOpenChange={setOpen}
        title="Nueva categoría"
        description="Completá los datos para agregar una categoría."
      >
        <CategoryForm
          onSubmit={async (v) => { await mutation.mutateAsync(v) }}
          isLoading={mutation.isPending}
          submitLabel="Crear categoría"
          userId={userId}
          isDemo={isDemo}
        />
      </MangoSheet>
    </>
  )
}

// ── Edit sheet ────────────────────────────────────────────────────────────────

function EditCategorySheet({
  category,
  userId,
  onClose,
  onDelete,
  isDemo,
}: {
  category: Category
  userId?: string
  onClose: () => void
  onDelete: () => void
  isDemo?: boolean
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("categories")
        .update({
          name: values.name.trim(),
          type: values.type,
          icon: values.icon?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", category.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: CATEGORIES_KEY })
      const previous = queryClient.getQueryData<Category[]>(CATEGORIES_KEY)
      queryClient.setQueryData<Category[]>(CATEGORIES_KEY, (old = []) =>
        old.map((c) =>
          c.id === category.id
            ? { ...c, name: values.name.trim(), type: values.type, icon: values.icon?.trim() || null }
            : c
        )
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(CATEGORIES_KEY, context.previous)
      const msg = err.message.includes("unique")
        ? "Ya existe una categoría con ese nombre y tipo."
        : err.message
      toast.error("Error al actualizar", { description: msg })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY })
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      toast.success("Categoría actualizada")
      onClose()
    },
  })

  return (
    <CategoryForm
      defaultValues={{
        name: category.name,
        type: category.type,
        icon: category.icon ?? "",
      }}
      onSubmit={async (v) => { await mutation.mutateAsync(v) }}
      isLoading={mutation.isPending}
      submitLabel="Guardar cambios"
      userId={userId}
      onDelete={onDelete}
      isDemo={isDemo}
    />
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CategoriesList() {
  const queryClient = useQueryClient()
  const isDemo = useIsDemo()

  const {
    data: categories,
    isLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useCategories({ orderBy: "created_at" })

  const [userId, setUserId] = useState<string | undefined>(undefined)
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  const [filters, setFilters] = useState<CatFilters>(DEFAULT_FILTERS)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  // ── Multi-select ────────────────────────────────────────────
  const ms = useMultiSelect()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)

  // ── Single delete ───────────────────────────────────────────
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<Category | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  function requestDeleteCategory(cat: Category) {
    setEditingCategory(null)
    setConfirmDeleteCategory(cat)
  }

  async function handleSingleDelete() {
    if (!confirmDeleteCategory) return
    setDeletePending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from("categories").delete().eq("id", confirmDeleteCategory.id)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY })
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      toast.success("Categoría eliminada. Los movimientos quedan sin categoría.")
    } catch (err: unknown) {
      toast.error("Error al eliminar la categoría", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setDeletePending(false)
      setConfirmDeleteCategory(null)
    }
  }

  const filtersActive = isFiltersActive(filters)

  const filteredCategories = useMemo(() => {
    if (!categories) return []
    const q = normalize(filters.search)

    return categories
      .filter((c) => {
        if (q && !normalize(c.name).includes(q)) return false
        if (filters.type !== "todas" && c.type !== filters.type) return false
        return true
      })
      .sort((a, b) => {
        if (filters.sortKey === "recientes") {
          const cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          return filters.sortDir === "asc" ? -cmp : cmp
        }
        // nombre
        const cmp = a.name.localeCompare(b.name, "es")
        return filters.sortDir === "asc" ? cmp : -cmp
      })
  }, [categories, filters])

  const visibleIds = useMemo(() => {
    if (!categories) return []
    return filtersActive ? filteredCategories.map((c) => c.id) : categories.map((c) => c.id)
  }, [categories, filtersActive, filteredCategories])

  const displayList = filtersActive ? filteredCategories : (categories ?? [])

  async function handleBulkDelete() {
    setBulkPending(true)
    const ids = Array.from(ms.selectedIds)
    const result = await bulkDelete("categories", ids)
    setBulkPending(false)
    setConfirmOpen(false)
    ms.exit()
    queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY })
    queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
    if (result.failed === 0) {
      toast.success(
        `Se eliminaron ${result.deleted} categoría${result.deleted !== 1 ? "s" : ""}. Los movimientos quedan sin categoría.`
      )
    } else {
      toast.warning(
        `Se eliminaron ${result.deleted}. ${result.failed} no se pud${result.failed !== 1 ? "ieron" : "o"} eliminar.`
      )
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className="text-2xl md:text-3xl tracking-tight font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Categorías
        </h1>
        <div className="flex items-center gap-2">
          {!isLoading && categories && categories.length > 0 && !ms.selectionMode && (
            <SelectButton onClick={ms.enter} />
          )}
          {!ms.selectionMode && <CreateCategorySheet userId={userId} isDemo={isDemo} />}
        </div>
      </div>

      {/* Filter bar — only when there are categories */}
      {!isLoading && categories && categories.length > 0 && (
        <CategoriesFilterBar
          filters={filters}
          onChange={setFilters}
          resultCount={filtersActive ? filteredCategories.length : categories.length}
          totalCount={categories.length}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(4)].map((_, i) => (
            <CategoryCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && categoriesError && (
        <QueryError onRetry={() => refetchCategories()} />
      )}

      {/* Empty state — zero categories */}
      {!isLoading && !categoriesError && categories?.length === 0 && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-10 text-center space-y-5 animate-scale-in">
          <div className="w-16 h-16 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
            <Tag className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              No tenés categorías todavía
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Creá categorías para clasificar tus ingresos y gastos.
            </p>
          </div>
          <CreateCategorySheet userId={userId} isDemo={isDemo} />
        </div>
      )}

      {/* Filtered empty state */}
      {!isLoading && categories && categories.length > 0 && filtersActive && filteredCategories.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Sin resultados</p>
            <p className="text-sm text-muted-foreground">
              No se encontraron categorías con esos filtros.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* Category list */}
      {!isLoading && displayList.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {displayList.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={setEditingCategory}
              onDeleteRequest={requestDeleteCategory}
              selectionMode={ms.selectionMode}
              isSelected={ms.isSelected(category.id)}
              onToggle={ms.toggle}
              isDemo={isDemo}
            />
          ))}
        </div>
      )}

      {/* Selection bar */}
      {ms.selectionMode && (
        <SelectionBar
          count={ms.count}
          total={visibleIds.length}
          onSelectAll={() => ms.toggleAll(visibleIds)}
          onDelete={() => setConfirmOpen(true)}
          onCancel={ms.exit}
          isPending={bulkPending}
        />
      )}

      {/* Bulk delete confirm */}
      <MangoSheet
        open={confirmOpen}
        onOpenChange={(v) => { if (!v) setConfirmOpen(false) }}
        title="Eliminar categorías"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={bulkPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkPending || isDemo}
              title={isDemo ? "No disponible en el modo demo" : undefined}
              className="press-effect"
            >
              {bulkPending ? "Eliminando…" : `Eliminar (${ms.count})`}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          ¿Eliminar {ms.count} categoría{ms.count !== 1 ? "s" : ""}? Los movimientos de estas categorías quedarán{" "}
          <em>Sin categoría</em> &mdash; no se eliminan. Esta acción no se puede deshacer.
        </p>
      </MangoSheet>

      {/* Single delete confirm */}
      <MangoSheet
        open={!!confirmDeleteCategory}
        onOpenChange={(v) => { if (!v) setConfirmDeleteCategory(null) }}
        title="Eliminar categoría"
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteCategory(null)}
              disabled={deletePending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleSingleDelete}
              disabled={deletePending || isDemo}
              title={isDemo ? "No disponible en el modo demo" : undefined}
              className="press-effect"
            >
              {deletePending ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          ¿Eliminar <strong>{confirmDeleteCategory?.name}</strong>? Los movimientos de esta categoría quedarán{" "}
          <em>Sin categoría</em> &mdash; no se eliminan. Esta acción no se puede deshacer.
        </p>
      </MangoSheet>

      {/* Edit sheet */}
      <MangoSheet
        open={!!editingCategory}
        onOpenChange={(v) => { if (!v) setEditingCategory(null) }}
        title="Editar categoría"
        description="Modificá los datos de la categoría."
      >
        {editingCategory && (
          <EditCategorySheet
            category={editingCategory}
            userId={userId}
            onClose={() => setEditingCategory(null)}
            onDelete={() => requestDeleteCategory(editingCategory)}
            isDemo={isDemo}
          />
        )}
      </MangoSheet>
    </div>
  )
}
