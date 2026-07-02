"use client"

import { useEffect } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { track } from "@/lib/analytics"

const DEFAULT_CLASSNAME =
  "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors duration-150 press-effect"

interface UpgradeLinkProps {
  feature: string
  placement: string
  className?: string
  children?: ReactNode
}

/**
 * CTA compartido hacia /ajustes#plan para los paywalls free→premium.
 * Emite `paywall_shown` al montarse (se muestra) y `upgrade_click` al clickear,
 * para medir el embudo de conversión por feature/placement.
 */
export function UpgradeLink({ feature, placement, className, children }: UpgradeLinkProps) {
  useEffect(() => {
    track("paywall_shown", { feature, placement })
  }, [feature, placement])

  return (
    <Link
      href="/ajustes#plan"
      className={className ?? DEFAULT_CLASSNAME}
      onClick={() => track("upgrade_click", { feature, placement })}
    >
      {children ?? "Mejorá a Premium"}
    </Link>
  )
}
