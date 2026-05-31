import type { Metadata } from "next"
import { Suspense } from "react"
import { ScheduledList } from "@/components/recurring/scheduled-list"

export const metadata: Metadata = {
  title: "Programadas",
}

export default function ProgramadasPage() {
  return (
    <Suspense>
      <ScheduledList />
    </Suspense>
  )
}
