import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export function BackToCalculadoras() {
  return (
    <Link
      href="/calculadoras"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded w-fit"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Volver a calculadoras
    </Link>
  )
}
