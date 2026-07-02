"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Trash2, Brain } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { QueryError } from "@/components/ui/query-error"
import { createClient } from "@/lib/supabase/client"
import { useIsDemo } from "@/lib/use-is-demo"
import { CategoryIconChip } from "@/lib/categories"
import { useCategories } from "@/lib/hooks/use-categories"
import { useCategoryLearning } from "@/lib/hooks/use-category-learning"
import { LEARNING_KEY } from "@/lib/category-learning"

/**
 * LearnedCategories — panel "Lo que Mangui aprendió" en /reglas.
 * Expone (y permite borrar) los mapeos comercio → categoría que el motor de
 * aprendizaje implícito (category-learning.ts) fue acumulando al categorizar
 * movimientos. Nunca oculta este comportamiento automático: el usuario puede
 * ver y desarmar cada asociación.
 */
export function LearnedCategories() {
  const queryClient = useQueryClient()
  const isDemo = useIsDemo()
  const { data: learnings = [], isLoading, isError, refetch } = useCategoryLearning()
  const { data: categories = [] } = useCategories()

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("category_learning").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEARNING_KEY })
      toast.success("Aprendizaje olvidado")
    },
    onError: () => toast.error("No se pudo eliminar"),
  })

  const sorted = [...learnings].sort((a, b) => b.hit_count - a.hit_count)

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Lo que Mangui aprendió
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Comercios que categorizaste varias veces de la misma forma — mangui te los sugiere solo.
        </p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <QueryError onRetry={() => refetch()} />
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-2">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Brain className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-semibold text-sm">Todavía no aprendió nada</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              A medida que categorices movimientos, mangui va a empezar a sugerir la categoría sola.
            </p>
          </div>
        ) : (
          sorted.map((l) => {
            const cat = categories.find((c) => c.id === l.category_id)
            return (
              <div
                key={l.id}
                className="flex items-center gap-3 p-3 border-b border-border/60 last:border-b-0"
              >
                <CategoryIconChip icon={cat?.icon} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate capitalize">{l.merchant_key}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {cat?.name ?? "Categoría eliminada"} · {l.hit_count}{" "}
                    {l.hit_count === 1 ? "vez" : "veces"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(l.id)}
                  disabled={isDemo || deleteMutation.isPending}
                  title={isDemo ? "No disponible en el modo demo" : undefined}
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground disabled:hover:bg-transparent"
                  aria-label="Olvidar esta categorización"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
