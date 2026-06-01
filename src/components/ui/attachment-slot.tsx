"use client"

/**
 * AttachmentSlot — upload / preview / delete a single file attachment.
 *
 * Two modes:
 *  - Empty: shows an upload button. On file pick, validates and calls onSelect.
 *  - Filled (existingAttachment OR pendingFile): shows a preview (image) or
 *    file chip (PDF), plus a delete button.
 *
 * This component is display-only for pending files — the actual upload to
 * Supabase Storage happens in the mutation (movementMutation), not here.
 * For existing attachments (edit mode), onDelete triggers the DB + storage removal.
 */

import * as React from "react"
import { Paperclip, X, FileText, Loader2 } from "lucide-react"
import { validateAttachmentFile, getAttachmentUrl, deleteAttachment } from "@/lib/attachments"
import type { MovementAttachment } from "@/lib/attachments"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export interface AttachmentSlotProps {
  /** Displayed label, e.g. "Factura o ticket" */
  label: string
  /** An already-persisted attachment row (edit mode). Mutually exclusive with pendingFile. */
  existingAttachment?: MovementAttachment | null
  /** A local File chosen by the user (create mode, not yet uploaded). */
  pendingFile?: File | null
  /** Called when the user selects a valid local file. */
  onSelect: (file: File) => void
  /** Called when the user removes the pending local file. */
  onClearPending?: () => void
  /**
   * Called when the user deletes an existing (persisted) attachment.
   * The slot handles the Supabase call internally and calls this on success.
   */
  onDeleted?: () => void
  disabled?: boolean
}

export function AttachmentSlot({
  label,
  existingAttachment,
  pendingFile,
  onSelect,
  onClearPending,
  onDeleted,
  disabled,
}: AttachmentSlotProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  // Tracks the resolved signed URL keyed by the attachment id so we can
  // clear it when the attachment changes without calling setState in an effect.
  const [signedUrlMap, setSignedUrlMap] = React.useState<Record<string, string | null>>({})
  const [loadingId, setLoadingId] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  // Resolve signed URL for existing image attachments.
  // The map is keyed by attachment id — no synchronous setState needed on cleanup.
  React.useEffect(() => {
    if (!existingAttachment?.mime_type?.startsWith("image/")) return
    const id = existingAttachment.id
    if (signedUrlMap[id] !== undefined) return // already fetched
    let cancelled = false
    setLoadingId(id)
    getAttachmentUrl(existingAttachment.file_url).then((url) => {
      if (cancelled) return
      setSignedUrlMap((prev) => ({ ...prev, [id]: url }))
      setLoadingId((prev) => (prev === id ? null : prev))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingAttachment])

  const previewUrl = existingAttachment ? (signedUrlMap[existingAttachment.id] ?? null) : null
  const loadingSignedUrl = loadingId === existingAttachment?.id

  // Local object URL for pending image
  const pendingObjectUrl = React.useMemo(() => {
    if (!pendingFile) return null
    if (pendingFile.type.startsWith("image/")) {
      return URL.createObjectURL(pendingFile)
    }
    return null
  }, [pendingFile])

  React.useEffect(() => {
    return () => {
      if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl)
    }
  }, [pendingObjectUrl])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const err = validateAttachmentFile(file)
    if (err) {
      toast.error(err)
      // Reset the input so the same file can be re-selected after fixing
      e.target.value = ""
      return
    }
    onSelect(file)
    e.target.value = ""
  }

  async function handleDeleteExisting() {
    if (!existingAttachment) return
    setDeleting(true)
    const { error } = await deleteAttachment(existingAttachment.id, existingAttachment.file_url)
    setDeleting(false)
    if (error) {
      toast.error(error)
      return
    }
    onDeleted?.()
  }

  const hasPending = !!pendingFile
  const hasExisting = !!existingAttachment
  const isFilled = hasPending || hasExisting

  // --- Filled state ---
  if (isFilled) {
    const isPdf = hasPending
      ? pendingFile!.type === "application/pdf"
      : existingAttachment!.mime_type === "application/pdf"
    const fileName = hasPending ? pendingFile!.name : existingAttachment!.file_name
    const displayImage = hasPending ? pendingObjectUrl : previewUrl

    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <div className={cn(
          "relative flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5",
          "overflow-hidden"
        )}>
          {isPdf ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-destructive" />
              </div>
              <span className="text-xs font-medium truncate flex-1">{fileName}</span>
            </div>
          ) : loadingSignedUrl ? (
            <div className="flex items-center gap-2 flex-1">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cargando…</span>
            </div>
          ) : displayImage ? (
            <a
              href={displayImage}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden flex-shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayImage}
                alt={fileName ?? "Adjunto"}
                className="h-14 w-14 object-cover rounded-lg"
              />
            </a>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium truncate">{fileName}</span>
            </div>
          )}
          {/* Remove button */}
          <button
            type="button"
            disabled={disabled || deleting}
            onClick={hasPending ? onClearPending : handleDeleteExisting}
            className={cn(
              "ml-auto h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
              "bg-background border border-border/60 text-muted-foreground",
              "hover:text-destructive hover:border-destructive/50 transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:opacity-50 cursor-pointer"
            )}
            aria-label={`Quitar ${label}`}
          >
            {deleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
    )
  }

  // --- Empty state ---
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border border-dashed border-border/60",
          "bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground",
          "hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
          "transition-colors duration-150 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Adjuntar archivo</span>
        <span className="ml-auto text-[10px] text-muted-foreground/60">JPG, PNG, PDF · 5 MB</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  )
}
