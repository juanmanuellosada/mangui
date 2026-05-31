import type { Metadata } from "next"
import { Suspense } from "react"
import { StatsPageClient } from "@/components/stats/stats-page-client"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Estadísticas",
}

function StatsLoadingFallback() {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="flex gap-2 flex-wrap">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-52 rounded-2xl" />
      <Skeleton className="h-44 rounded-2xl" />
    </div>
  )
}

export default function StatsPage() {
  return (
    <Suspense fallback={<StatsLoadingFallback />}>
      <StatsPageClient />
    </Suspense>
  )
}
