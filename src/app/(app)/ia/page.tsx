import { getAiUsageToday } from "@/app/actions/ai-settings"
import { AiChat } from "@/components/ai/ai-chat"
import { FREE } from "@/lib/plans"

export default async function IAPage() {
  const usage = await getAiUsageToday()

  const used = usage.ok ? usage.used : 0
  const unlimited = usage.ok ? usage.unlimited : false
  const limit = usage.ok ? usage.limit : FREE.aiPerDay

  return (
    <AiChat initialUsed={used} initialUnlimited={unlimited} initialLimit={limit} />
  )
}
