"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

function AiChatSkeleton() {
  return (
    <div className="flex flex-col h-full" style={{ minHeight: "calc(100dvh - 8rem)" }}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Skeleton className="w-7 h-7 rounded-xl" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex-1 py-4 space-y-4">
        <Skeleton className="h-24 w-3/4 rounded-2xl" />
        <Skeleton className="h-16 w-2/3 rounded-2xl ml-auto" />
        <Skeleton className="h-20 w-3/4 rounded-2xl" />
      </div>
    </div>
  )
}

const AiChat = dynamic(
  () => import("@/components/ai/ai-chat").then((m) => m.AiChat),
  { ssr: false, loading: () => <AiChatSkeleton /> }
)

interface AiChatLoaderProps {
  initialUsed: number
  initialUnlimited: boolean
  initialLimit: number
}

export function AiChatLoader(props: AiChatLoaderProps) {
  return <AiChat {...props} />
}
