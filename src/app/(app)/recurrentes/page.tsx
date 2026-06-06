import type { Metadata } from "next"
import { Suspense } from "react"
import { RecurringList } from "@/components/recurring/recurring-list"

export const metadata: Metadata = {
  title: "Recurrentes",
}

export default function RecurrentesPage() {
  return (
    <Suspense>
      <RecurringList />
    </Suspense>
  )
}
