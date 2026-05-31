"use client"

import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/database.types"
import { CATEGORIES_KEY, MOVEMENTS_KEY } from "@/lib/movements"

type Category = Tables<"categories">
type CategoryType = "income" | "expense"

// ── Schema ────────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50, "Máximo 50 caracteres"),
  type: z.enum(["income", "expense"]),
  icon: z.string().max(10).optional(),
})
type CategoryFormValues = z.infer<typeof categorySchema>

// ── Fetcher ────────────────────────────────────────────────────────────────────

async function fetchCategories(): Promise<Category[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name")
  if (error) throw error
  return data
}

// ── Category form ─────────────────────────────────────────────────────────────

function CategoryForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel,
}: {
  defaultValues?: Partial<CategoryFormValues>
  onSubmit: (v: CategoryFormValues) => Promise<void>
  isLoading?: boolean
  submitLabel?: string
}) {
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Type */}
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

      {/* Icon (emoji) */}
      <div className="space-y-1.5">
        <Label htmlFor="cat-icon">Ícono (emoji opcional)</Label>
        <Input
          id="cat-icon"
          placeholder="Ej: 🛒"
          {...register("icon")}
          maxLength={4}
          className="w-24"
        />
        <p className="text-xs text-muted-foreground">
          Podés usar un emoji como ícono visual (solo en datos de usuario, no en navegación).
        </p>
      </div>

      <Button type="submit" className="w-full press-effect" disabled={isLoading}>
        {isLoading ? "Guardando…" : (submitLabel ?? "Guardar")}
      </Button>
    </form>
  )
}

// ── Category row ───────────────────────────────────────────────────────────────

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 group rounded-xl hover:bg-muted/40 transition-colors">
      {/* Icon or fallback */}
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-base">
        {category.icon ? (
          <span>{category.icon}</span>
        ) : (
          <Tag className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{category.name}</p>
        {category.is_default && (
          <p className="text-[10px] text-muted-foreground">Predeterminada</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Editar"
          className="press-effect cursor-pointer"
          onClick={() => onEdit(category)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Eliminar"
          className="press-effect cursor-pointer"
          onClick={() => onDelete(category)}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────────

function CategorySection({
  title,
  categories,
  type,
  onEdit,
  onDelete,
  onAdd,
}: {
  title: string
  categories: Category[]
  type: CategoryType
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
  onAdd: (type: CategoryType) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          type === "income" ? "text-success" : "text-destructive"
        )}>
          {title}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs cursor-pointer press-effect"
          onClick={() => onAdd(type)}
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>
      {categories.length === 0 ? (
        <div className="px-3 py-4 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border/60">
          Sin categorías de {type === "income" ? "ingreso" : "gasto"}.{" "}
          <button
            type="button"
            onClick={() => onAdd(type)}
            className="text-primary underline cursor-pointer"
          >
            Agregar primera
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40">
          {categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CategoriesManager() {
  const queryClient = useQueryClient()
  const [addDialog, setAddDialog] = useState<CategoryType | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: fetchCategories,
  })

  const incomeCategories = categories.filter((c) => c.type === "income")
  const expenseCategories = categories.filter((c) => c.type === "expense")

  // ── Create ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY })
      toast.success("Categoría creada")
      setAddDialog(null)
    },
    onError: (err: Error) => {
      const msg = err.message.includes("unique")
        ? "Ya existe una categoría con ese nombre y tipo."
        : err.message
      toast.error("Error al crear categoría", { description: msg })
    },
  })

  // ── Update ─────────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: CategoryFormValues }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("categories")
        .update({
          name: values.name.trim(),
          type: values.type,
          icon: values.icon?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: CATEGORIES_KEY })
      const previous = queryClient.getQueryData<Category[]>(CATEGORIES_KEY)
      queryClient.setQueryData<Category[]>(CATEGORIES_KEY, (old = []) =>
        old.map((c) =>
          c.id === id
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
      setEditingCategory(null)
    },
  })

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CATEGORIES_KEY })
      const previous = queryClient.getQueryData<Category[]>(CATEGORIES_KEY)
      queryClient.setQueryData<Category[]>(CATEGORIES_KEY, (old = []) =>
        old.filter((c) => c.id !== id)
      )
      return { previous }
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(CATEGORIES_KEY, context.previous)
      toast.error("Error al eliminar", { description: err.message })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY })
      queryClient.invalidateQueries({ queryKey: MOVEMENTS_KEY })
      toast.success("Categoría eliminada. Los movimientos quedan sin categoría.")
      setDeletingCategory(null)
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CategorySection
        title="Ingresos"
        categories={incomeCategories}
        type="income"
        onEdit={setEditingCategory}
        onDelete={setDeletingCategory}
        onAdd={(type) => setAddDialog(type)}
      />
      <CategorySection
        title="Gastos"
        categories={expenseCategories}
        type="expense"
        onEdit={setEditingCategory}
        onDelete={setDeletingCategory}
        onAdd={(type) => setAddDialog(type)}
      />

      {/* Add dialog */}
      <Dialog open={!!addDialog} onOpenChange={(v) => { if (!v) setAddDialog(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
            <DialogDescription>
              Agregá una categoría para clasificar tus movimientos.
            </DialogDescription>
          </DialogHeader>
          <CategoryForm
            defaultValues={{ type: addDialog ?? "expense" }}
            onSubmit={async (v) => { await createMutation.mutateAsync(v) }}
            isLoading={createMutation.isPending}
            submitLabel="Crear categoría"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editingCategory && (
        <Dialog open={!!editingCategory} onOpenChange={(v) => { if (!v) setEditingCategory(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Editar categoría</DialogTitle>
              <DialogDescription>Modificá los datos de la categoría.</DialogDescription>
            </DialogHeader>
            <CategoryForm
              defaultValues={{
                name: editingCategory.name,
                type: editingCategory.type,
                icon: editingCategory.icon ?? "",
              }}
              onSubmit={async (v) => {
                await updateMutation.mutateAsync({ id: editingCategory.id, values: v })
              }}
              isLoading={updateMutation.isPending}
              submitLabel="Guardar cambios"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete dialog */}
      {deletingCategory && (
        <Dialog open={!!deletingCategory} onOpenChange={(v) => { if (!v) setDeletingCategory(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Eliminar categoría</DialogTitle>
              <DialogDescription>
                ¿Seguro querés eliminar <strong>{deletingCategory.name}</strong>?
                Los movimientos que tenían esta categoría quedarán como{" "}
                <em>Sin categoría</em> — no se eliminan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeletingCategory(null)}
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(deletingCategory.id)}
                disabled={deleteMutation.isPending}
                className="press-effect"
              >
                {deleteMutation.isPending ? "Eliminando…" : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
