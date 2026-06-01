import type { Metadata } from "next"
import { Suspense } from "react"
import { CategoriesList } from "@/components/categories/categories-list"

export const metadata: Metadata = {
  title: "Categorías",
}

export default function CategoriasPage() {
  return (
    <Suspense>
      <CategoriesList />
    </Suspense>
  )
}
