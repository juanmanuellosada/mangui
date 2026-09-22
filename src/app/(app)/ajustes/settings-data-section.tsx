"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Download, Info, TriangleAlert } from "lucide-react"
import { deleteAccount } from "@/app/actions/account"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { useIsDemo } from "@/lib/use-is-demo"
import { usePlan } from "@/lib/use-plan"
import { cn } from "@/lib/utils"

function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

async function exportMovementsCSV() {
  const supabase = createClient()

  // Fetch movements, categories, accounts in parallel
  const [movRes, catRes, accRes] = await Promise.all([
    supabase.from("movements").select("*").order("date", { ascending: false }).limit(5000),
    supabase.from("categories").select("id, name"),
    supabase.from("accounts").select("id, name"),
  ])

  if (movRes.error) throw movRes.error
  if (catRes.error) throw catRes.error
  if (accRes.error) throw accRes.error

  const catMap: Record<string, string> = {}
  for (const c of catRes.data ?? []) catMap[c.id] = c.name

  const accMap: Record<string, string> = {}
  for (const a of accRes.data ?? []) accMap[a.id] = a.name

  const header = ["fecha", "tipo", "monto", "moneda", "monto_convertido", "categoria", "cuenta", "nota"]
  const rows = (movRes.data ?? []).map((m) => [
    escapeCSVField(m.date),
    escapeCSVField(m.type),
    escapeCSVField(m.amount),
    escapeCSVField(m.original_currency),
    escapeCSVField(m.converted_amount),
    escapeCSVField(catMap[m.category_id ?? ""] ?? ""),
    escapeCSVField(accMap[m.account_id] ?? ""),
    escapeCSVField(m.note),
  ])

  const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n")
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const today = new Date().toISOString().slice(0, 10)
  const link = document.createElement("a")
  link.href = url
  link.download = `mangui-movimientos-${today}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function DataSection() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"
  const [exporting, setExporting] = useState(false)
  const { isPremium: userIsPremium } = usePlan()
  const isDemo = useIsDemo()

  // Delete account dialog state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deleting, setDeleting] = useState(false)

  const handleExport = async () => {
    if (!userIsPremium) return
    setExporting(true)
    try {
      await exportMovementsCSV()
      toast.success("CSV descargado correctamente")
    } catch (err) {
      toast.error("Error al exportar", { description: err instanceof Error ? err.message : "Error desconocido" })
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const result = await deleteAccount(deleteConfirmation)
      if (!result.ok) {
        toast.error("No se pudo eliminar la cuenta", { description: result.error })
        setDeleting(false)
        return
      }
      // Force a full navigation to clear all in-memory state
      window.location.href = "/login"
    } catch {
      toast.error("Error inesperado al eliminar la cuenta")
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* App version */}
      <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Versión</span>
        </div>
        <span className="text-sm font-semibold tabular-nums">{version}</span>
      </div>

      {/* Export */}
      <div className="rounded-xl border border-border/60 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Exportar mis datos</p>
          <p className="text-xs text-muted-foreground">
            {userIsPremium ? "Descargá tu historial de movimientos en CSV" : "Disponible en el plan Premium"}
          </p>
        </div>
        {userIsPremium ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="gap-1.5 cursor-pointer press-effect flex-shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Exportando…" : "Exportar CSV"}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="gap-1.5 flex-shrink-0 opacity-50 cursor-not-allowed"
            title="Función Premium"
          >
            <Download className="h-3.5 w-3.5" />
            Premium
          </Button>
        )}
      </div>

      {/* Delete account */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-destructive">Eliminar cuenta</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Eliminá permanentemente tu cuenta y todos tus datos.
              Esta acción no se puede deshacer.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            disabled={isDemo}
            title={isDemo ? "No disponible en el modo demo" : undefined}
            className={cn("flex-shrink-0 mt-0.5", isDemo ? "cursor-not-allowed opacity-50" : "cursor-pointer press-effect")}
            onClick={() => {
              setDeleteConfirmation("")
              setDeleteOpen(true)
            }}
          >
            Eliminar
          </Button>
        </div>
      </div>

      {/* Delete account confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent compact>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-destructive flex-shrink-0" />
              <DialogTitle className="text-destructive">Eliminar cuenta</DialogTitle>
            </div>
            <DialogDescription>
              Esta acción es <strong>permanente e irreversible</strong>. Se eliminarán tu perfil, cuentas, movimientos, tarjetas, cuotas, transferencias, presupuestos, metas, reglas, archivos adjuntos y tu suscripción Premium si tenés una.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              Para confirmar, escribí <strong>ELIMINAR</strong> en el campo de abajo:
            </p>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="ELIMINAR"
              disabled={deleting}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteConfirmation !== "ELIMINAR" || deleting}
              onClick={handleDeleteAccount}
              className="press-effect"
            >
              {deleting ? "Eliminando…" : "Eliminar definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
