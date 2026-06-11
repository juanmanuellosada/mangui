"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useIsDemo } from "@/lib/use-is-demo"
import { audioBufferToWav } from "@/lib/audio/encode-wav"

type RecState = "idle" | "recording" | "processing"

export function VoiceInputButton({
  onTranscript,
  disabled,
  className,
}: {
  onTranscript: (text: string) => void
  disabled?: boolean
  className?: string
}) {
  const isDemo = useIsDemo()
  const [mounted, setMounted] = useState(false)
  const [state, setState] = useState<RecState>("idle")
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => { setMounted(true) }, [])

  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"

  if (!mounted || isDemo || !supported) return null

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      recorderRef.current = rec
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => { void process() }
      rec.start()
      setState("recording")
    } catch {
      cleanupStream()
      setState("idle")
      toast.error("No pude acceder al micrófono. Revisá los permisos.")
    }
  }

  function stop() {
    const rec = recorderRef.current
    if (rec && rec.state !== "inactive") {
      setState("processing")
      rec.stop()
    }
  }

  async function process() {
    cleanupStream()
    try {
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" })
      if (blob.size === 0) { setState("idle"); return }
      const arrayBuf = await blob.arrayBuffer()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AC()
      const audioBuf = await ctx.decodeAudioData(arrayBuf)
      void ctx.close()
      const wav = audioBufferToWav(audioBuf, 16000)
      const form = new FormData()
      form.append("audio", wav, "audio.wav")
      const res = await fetch("/api/ai/transcribe", { method: "POST", body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.message || data?.error || "No pude transcribir el audio.")
        setState("idle")
        return
      }
      const data = await res.json()
      const text = (data?.text ?? "").trim()
      if (text) onTranscript(text)
      else toast.error("No se entendió el audio. Probá de nuevo.")
    } catch {
      toast.error("Error procesando el audio.")
    } finally {
      setState("idle")
    }
  }

  const onClick = () => {
    if (disabled) return
    if (state === "idle") void start()
    else if (state === "recording") stop()
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "processing"}
      aria-label={state === "recording" ? "Detener grabación" : "Hablar"}
      title={state === "recording" ? "Detener" : "Hablar"}
      className={cn(
        "inline-flex items-center justify-center shrink-0 rounded-xl transition-colors duration-150 press-effect cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed",
        state === "recording" ? "bg-destructive text-white animate-pulse" : "bg-muted text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {state === "processing" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === "recording" ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  )
}
