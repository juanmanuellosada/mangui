"use client"

import type { ComponentProps } from "react"
import { Loader2, Share2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

type ShareWrappedReportProps = Omit<ComponentProps<typeof Button>, "children" | "disabled" | "onClick"> & {
  monthRef: string
  monthLabel: string
  label?: string
}

export function ShareWrappedReport({
  monthRef,
  monthLabel,
  label = "Compartir",
  ...buttonProps
}: ShareWrappedReportProps) {
  const [sharing, setSharing] = useState(false)

  async function handleShare() {
    setSharing(true)
    try {
      const res = await fetch(`/api/og/wrapped?month=${monthRef}`)
      if (!res.ok) throw new Error("No se pudo generar la imagen")
      const blob = await res.blob()
      const file = new File([blob], "mangui-wrapped.png", { type: "image/png" })
      const shareData = {
        files: [file],
        title: "Mi resumen de mangui",
        text: `Mi ${monthLabel} en mangui 🥭`,
      }
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "mangui-wrapped.png"
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast.success("Imagen descargada")
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return // el usuario canceló el share sheet
      toast.error("No pudimos generar tu resumen. Probá de nuevo.")
    } finally {
      setSharing(false)
    }
  }

  return (
    <Button {...buttonProps} onClick={handleShare} disabled={sharing}>
      {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      {sharing ? "Generando…" : label}
    </Button>
  )
}
