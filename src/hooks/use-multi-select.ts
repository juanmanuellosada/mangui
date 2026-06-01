"use client"

import { useState, useCallback } from "react"

export interface UseMultiSelectReturn {
  selectionMode: boolean
  selectedIds: Set<string>
  count: number
  enter: () => void
  exit: () => void
  toggle: (id: string) => void
  toggleAll: (ids: string[]) => void
  clear: () => void
  isSelected: (id: string) => boolean
}

export function useMultiSelect(): UseMultiSelectReturn {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const enter = useCallback(() => {
    setSelectionMode(true)
    setSelectedIds(new Set())
  }, [])

  const exit = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      // If all are selected, deselect all; otherwise select all
      const allSelected = ids.every((id) => prev.has(id))
      if (allSelected) return new Set()
      return new Set(ids)
    })
  }, [])

  const clear = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  return {
    selectionMode,
    selectedIds,
    count: selectedIds.size,
    enter,
    exit,
    toggle,
    toggleAll,
    clear,
    isSelected,
  }
}
