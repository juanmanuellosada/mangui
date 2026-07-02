"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { CATEGORIES_KEY } from "@/lib/movements"
import type { Tables } from "@/lib/database.types"

export type Category = Tables<"categories">

export type CategoriesOrderBy = "name" | "created_at" | "none"

async function fetchCategories(orderBy: CategoriesOrderBy): Promise<Category[]> {
  const supabase = createClient()
  let q = supabase.from("categories").select("*")
  if (orderBy !== "none") q = q.order(orderBy)
  const { data, error } = await q
  if (error) throw error
  return data
}

/**
 * useCategories — hook compartido para la query canónica de categorías.
 * `orderBy` preserva las variantes de orden que existían entre los distintos
 * call sites antes de la deduplicación (por defecto "name", el más usado).
 * "none" reproduce los call sites que no ordenaban explícitamente.
 */
export function useCategories(options?: { orderBy?: CategoriesOrderBy }) {
  const orderBy = options?.orderBy ?? "name"
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: () => fetchCategories(orderBy),
  })
}
