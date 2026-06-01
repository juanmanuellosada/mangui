import * as React from "react"
import { Tag } from "lucide-react"
import { LUCIDE_ICON_REGISTRY } from "@/lib/lucide-registry"

/**
 * renderCategoryIcon — resolves a category icon value to a React element.
 *   - URL (starts with "http" or "/"): renders a rounded <img>
 *   - "lucide:<name>": renders a Lucide icon via dynamic lookup
 *   - otherwise: renders the emoji/text in a <span>
 *
 * Mirrors renderAccountIcon from accounts.ts.
 * Categories today only store emoji/text in `icon`, but this helper
 * is tolerant of URL and lucide: prefixes for future compatibility.
 *
 * Pass `size` to control dimensions (default "h-5 w-5").
 */
export function renderCategoryIcon(
  icon: string | null | undefined,
  opts: { size?: string; className?: string; logoFill?: boolean } = {}
): React.ReactElement {
  const { size = "h-5 w-5", className = "", logoFill = false } = opts
  if (!icon) {
    return React.createElement(Tag, { className: `${size} ${className}` })
  }
  if (icon.startsWith("http") || icon.startsWith("/")) {
    const imgClass = logoFill
      ? `w-full h-full object-cover ${className}`
      : `${size} rounded-xl object-cover ${className}`
    return React.createElement("img", {
      src: icon,
      alt: "Ícono",
      className: imgClass,
    })
  }
  if (icon.startsWith("lucide:")) {
    const name = icon.slice(7)
    const Comp = (LUCIDE_ICON_REGISTRY[name] as React.ElementType) ?? Tag
    return React.createElement(Comp, { className: `${size} ${className}` })
  }
  // Emoji or plain text
  return React.createElement(
    "span",
    { className: `text-xl leading-none select-none ${className}`, "aria-hidden": true },
    icon
  )
}

/**
 * CategoryIconChip — a fixed-size square chip (~24px) that wraps any category icon
 * so emojis, uploaded images, lucide icons all render at the same visual size in selectors.
 *
 * Matches AccountIconChip treatment: rounded-md, subtle bg + border, overflow-hidden
 * so images clip cleanly. Account and category chips look consistent side by side.
 */
export function CategoryIconChip({
  icon,
}: {
  icon: string | null | undefined
}): React.ReactElement {
  const isImage = !!icon && (icon.startsWith("http") || icon.startsWith("/"))
  const isEmoji = !!icon && !icon.startsWith("lucide:") && !isImage

  return React.createElement(
    "span",
    {
      className:
        "inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted/60 overflow-hidden",
      "aria-hidden": true,
    },
    isImage
      ? React.createElement("img", {
          src: icon!,
          alt: "",
          className: "w-full h-full object-cover",
        })
      : isEmoji
      ? React.createElement(
          "span",
          { className: "text-[13px] leading-none select-none" },
          icon
        )
      : renderCategoryIcon(icon, { size: "h-3.5 w-3.5", className: "text-muted-foreground" })
  )
}
