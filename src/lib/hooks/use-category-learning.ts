"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { LEARNING_KEY, fetchCategoryLearning } from "@/lib/category-learning"

export function useCategoryLearning() {
  return useQuery({
    queryKey: LEARNING_KEY,
    queryFn: () => fetchCategoryLearning(createClient()),
  })
}
