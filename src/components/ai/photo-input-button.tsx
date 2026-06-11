"use client"

import { useRef } from "react"
import { Camera } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useIsDemo } from "@/lib/use-is-demo"

export function PhotoInputButton({
  onPhoto,
  disabled,
  className,
}: {
  onPhoto: (file: File) => void
  disabled?: boolean
  className?: string
}) {
  const isDemo = useIsDemo()
  const inputRef = useRef<HTMLInputElement>(null)

  if (isDemo) return null

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // reset so the same file can be re-picked
    if (!file) return
    if (!file.type.startsWith("image/")) { toast.error("Elegí una imagen."); return }
    if (file.size > 10 * 1024 * 1024) { toast.error("La imagen es muy grande (máx 10 MB)."); return }
    onPhoto(file)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={() => { if (!disabled) inputRef.current?.click() }}
        disabled={disabled}
        aria-label="Sacar o elegir una foto"
        title="Foto (ticket)"
        className={cn(
          "inline-flex items-center justify-center shrink-0 rounded-xl transition-colors duration-150 press-effect cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed",
          "bg-muted text-muted-foreground hover:text-foreground",
          className
        )}
      >
        <Camera className="h-4 w-4" />
      </button>
    </>
  )
}
