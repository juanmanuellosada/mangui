"use client"

/**
 * MangoSheet — responsive modal primitive.
 *
 * Desktop (≥768px): centered dialog (scale-from-center, blur backdrop).
 * Mobile (<768px):  bottom sheet that slides up, with a drag handle at top.
 *
 * Drag-to-dismiss (mobile only):
 *   - Touch starts only on the drag handle or the sheet header.
 *   - Dragging down translates the panel; backdrop opacity follows.
 *   - Release: if distance > 100 px OR velocity > 0.5 px/ms → close.
 *     Otherwise spring back (transform → 0, 300 ms ease-out).
 *   - prefers-reduced-motion: motion suppressed; close threshold still works.
 *
 * Props:
 *   open            boolean
 *   onOpenChange    (open: boolean) => void
 *   title           string
 *   description?    string
 *   children        ReactNode
 *   footer?         ReactNode — sticky, rendered below content
 */

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Helpers ───────────────────────────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const handler = () => setReduced(mq.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return reduced
}

function useMobile(): boolean {
  const [mobile, setMobile] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    setMobile(mq.matches)
    const handler = () => setMobile(mq.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return mobile
}

// ── MangoSheet ────────────────────────────────────────────────────────────────

export interface MangoSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function MangoSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: MangoSheetProps) {
  const isMobile = useMobile()
  const reducedMotion = useReducedMotion()
  const panelRef = React.useRef<HTMLDivElement>(null)
  const previousFocusRef = React.useRef<Element | null>(null)
  const titleId = React.useId()
  const descId = React.useId()

  // Drag state
  const [dragY, setDragY] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const startY = React.useRef(0)
  const startTime = React.useRef(0)

  // Reset drag on open/close
  React.useEffect(() => {
    if (open) {
      setDragY(0)
      setIsDragging(false)
    }
  }, [open])

  // Scroll lock
  React.useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = original }
  }, [open])

  // Focus management
  React.useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement
    const panel = panelRef.current
    if (panel) {
      // Focus the panel itself; descendant elements get focused by the browser
      const focusable = panel.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      ;(focusable ?? panel).focus()
    }
    return () => {
      const prev = previousFocusRef.current
      if (prev && typeof (prev as HTMLElement).focus === "function") {
        ;(prev as HTMLElement).focus()
      }
    }
  }, [open])

  // Escape key
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onOpenChange])

  // Focus trap
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  // Touch handlers (mobile only)
  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile) return
      const target = e.target as Element
      if (target.closest("[data-drag-handle]")) {
        startY.current = e.touches[0].clientY
        startTime.current = Date.now()
        setIsDragging(true)
      }
    },
    [isMobile]
  )

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return
      const diff = e.touches[0].clientY - startY.current
      if (diff > 0) {
        if (!reducedMotion) setDragY(diff)
      }
    },
    [isDragging, reducedMotion]
  )

  const handleTouchEnd = React.useCallback(() => {
    if (!isDragging) return
    const elapsed = Date.now() - startTime.current
    const velocity = elapsed > 0 ? dragY / elapsed : 0
    if (dragY > 100 || velocity > 0.5) {
      onOpenChange(false)
    }
    setDragY(0)
    setIsDragging(false)
  }, [isDragging, dragY, onOpenChange])

  if (!open) return null

  // Backdrop: opacity tied to drag distance on mobile
  const backdropOpacity =
    isMobile && dragY > 0
      ? Math.max(0, 0.5 - dragY / 300)
      : 0.5

  const shouldClose = dragY > 100

  const content = (
    <div
      className="fixed inset-0 z-50 flex"
      // Desktop: centered; mobile: bottom-aligned
      style={{
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 backdrop-blur-sm",
          !isMobile && "data-open:animate-in data-open:fade-in-0"
        )}
        style={{ backgroundColor: `rgba(0,0,0,${backdropOpacity})`, transition: isDragging ? "none" : "background-color 0.2s ease-out" }}
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full flex flex-col bg-popover ring-1 ring-foreground/10 shadow-2xl focus:outline-none",
          // Mobile: bottom sheet, slides up from bottom
          isMobile
            ? "rounded-t-2xl max-h-[92dvh]"
            : // Desktop: centered dialog, max width, rounded all sides
              "rounded-xl max-w-[calc(100%-2rem)] sm:max-w-md mx-4",
          // Desktop enter animation
          !isMobile && !reducedMotion && "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        style={
          isMobile
            ? {
                transform: reducedMotion ? undefined : `translateY(${dragY}px)`,
                transition: isDragging || reducedMotion ? "none" : "transform 0.3s cubic-bezier(.32,.72,0,1)",
                opacity: shouldClose ? 0.6 : 1,
              }
            : undefined
        }
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — mobile only, acts as drag target */}
        {isMobile && (
          <div
            data-drag-handle
            className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing shrink-0"
            aria-hidden="true"
          >
            <div
              className={cn(
                "w-10 h-1 rounded-full transition-colors duration-150",
                shouldClose ? "bg-destructive/60" : "bg-muted-foreground/30"
              )}
            />
          </div>
        )}

        {/* Header */}
        <div
          data-drag-handle
          className={cn(
            "flex items-center justify-between px-4 py-3 shrink-0 border-b border-border/60",
            isMobile && "cursor-grab active:cursor-grabbing"
          )}
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2
              id={titleId}
              className="text-base font-semibold leading-tight truncate"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descId}
                className="text-xs text-muted-foreground leading-snug"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
            className={cn(
              "shrink-0 ml-3 h-7 w-7 rounded-lg flex items-center justify-center",
              "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          <div className="p-4">
            {children}
          </div>
        </div>

        {/* Optional sticky footer */}
        {footer && (
          <div className="shrink-0 border-t border-border/60 px-4 py-3 bg-muted/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  if (typeof document === "undefined") return null
  return createPortal(content, document.body)
}
