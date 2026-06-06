import type { Metadata } from "next"
import { Suspense } from "react"
import { RulesList } from "@/components/rules/rules-list"

export const metadata: Metadata = {
  title: "Reglas automáticas",
}

export default function ReglasPage() {
  return (
    <Suspense>
      <RulesList />
    </Suspense>
  )
}
