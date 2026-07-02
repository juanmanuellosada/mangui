"use client"

import { useState, type KeyboardEvent } from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const MAX_TAGS = 10
const MAX_TAG_LENGTH = 30

interface TagsInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** Chips editables: Enter o coma agrega el tag escrito, click en la ✕ lo quita. */
export function TagsInput({ value, onChange, placeholder = "Agregar tag…", disabled, className }: TagsInputProps) {
  const [draft, setDraft] = useState("")

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag) return
    if (value.length >= MAX_TAGS) return
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return
    onChange([...value, tag.slice(0, MAX_TAG_LENGTH)])
    setDraft("")
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(draft)
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full p-0.5 hover:bg-foreground/10 transition-colors duration-150 cursor-pointer"
                  aria-label={`Quitar tag ${tag}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      {!disabled && value.length < MAX_TAGS && (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(draft)}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={MAX_TAG_LENGTH}
        />
      )}
    </div>
  )
}
