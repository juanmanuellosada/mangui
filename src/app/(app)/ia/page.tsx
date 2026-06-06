import { getAiUsageToday } from "@/app/actions/ai-settings"
import { AiChat } from "@/components/ai/ai-chat"

export default async function IAPage() {
  const usage = await getAiUsageToday()

  const used = usage.ok ? usage.used : 0
  const unlimited = usage.ok ? usage.unlimited : false

  return (
    <AiChat initialUsed={used} initialUnlimited={unlimited} />
  )
}
