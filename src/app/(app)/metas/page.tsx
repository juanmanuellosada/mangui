import type { Metadata } from "next"
import { GoalsList } from "@/components/goals/goals-list"

export const metadata: Metadata = {
  title: "Metas",
}

export default function MetasPage() {
  return <GoalsList />
}
