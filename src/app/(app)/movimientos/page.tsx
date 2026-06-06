import type { Metadata } from "next"
import { Suspense } from "react"
import { MovementsList } from "@/components/movements/movements-list"

export const metadata: Metadata = {
  title: "Movimientos",
}

/**
 * Movements page.
 * The list itself is a client component with TanStack Query,
 * wrapped in Suspense because it reads useSearchParams.
 */
export default function MovementsPage() {
  return (
    <Suspense>
      <MovementsList />
    </Suspense>
  )
}
