import type { Dispatch, SetStateAction } from "react"
import { AttachmentSlot } from "@/components/ui/attachment-slot"
import { UpgradeLink } from "@/components/ui/upgrade-link"
import type { MovementAttachment } from "@/lib/attachments"

interface MovementAttachmentFieldsProps {
  type: "income" | "expense"
  isPremium: boolean
  attachmentLimit: number
  monthlyAttachmentCount: number
  pendingFactura: File | null
  setPendingFactura: Dispatch<SetStateAction<File | null>>
  pendingRecibo: File | null
  setPendingRecibo: Dispatch<SetStateAction<File | null>>
  pendingComprobante: File | null
  setPendingComprobante: Dispatch<SetStateAction<File | null>>
  existingAttachments?: MovementAttachment[]
  onAttachmentDeleted?: () => void
  isLoading?: boolean
  isDemo: boolean
}

export function MovementAttachmentFields({
  type,
  isPremium,
  attachmentLimit,
  monthlyAttachmentCount,
  pendingFactura,
  setPendingFactura,
  pendingRecibo,
  setPendingRecibo,
  pendingComprobante,
  setPendingComprobante,
  existingAttachments,
  onAttachmentDeleted,
  isLoading,
  isDemo,
}: MovementAttachmentFieldsProps) {
  const existingFactura = existingAttachments?.find((attachment) => attachment.kind === "factura") ?? null
  const existingRecibo = existingAttachments?.find((attachment) => attachment.kind === "recibo") ?? null
  const existingComprobante = existingAttachments?.find((attachment) => attachment.kind === "comprobante") ?? null

  if (!isPremium) {
    const pendingCount = (pendingFactura ? 1 : 0) + (pendingRecibo ? 1 : 0) + (pendingComprobante ? 1 : 0)
    const totalUsed = monthlyAttachmentCount + pendingCount
    const atCap = totalUsed >= attachmentLimit

    if (type === "expense") {
      return (
        <div className="space-y-3">
          <AttachmentSlot
            label="Factura o ticket"
            pendingFile={pendingFactura}
            existingAttachment={existingFactura}
            onSelect={setPendingFactura}
            onClearPending={() => setPendingFactura(null)}
            onDeleted={onAttachmentDeleted}
            disabled={isLoading || isDemo || (!pendingFactura && atCap)}
          />
          <AttachmentSlot
            label="Recibo / comprobante de pago"
            pendingFile={pendingRecibo}
            existingAttachment={existingRecibo}
            onSelect={setPendingRecibo}
            onClearPending={() => setPendingRecibo(null)}
            onDeleted={onAttachmentDeleted}
            disabled={isLoading || isDemo || (!pendingRecibo && atCap)}
          />
          {atCap ? (
            <p className="text-xs text-muted-foreground px-0.5">
              Adjuntos: {Math.min(totalUsed, attachmentLimit)}/{attachmentLimit} este mes ·{" "}
              <UpgradeLink
                feature="attachments"
                placement="list_limit"
                className="text-primary font-semibold hover:underline"
              >
                pasá a Premium para ilimitados
              </UpgradeLink>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground px-0.5">
              {totalUsed}/{attachmentLimit} este mes
            </p>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <AttachmentSlot
          label="Comprobante"
          pendingFile={pendingComprobante}
          existingAttachment={existingComprobante}
          onSelect={setPendingComprobante}
          onClearPending={() => setPendingComprobante(null)}
          onDeleted={onAttachmentDeleted}
          disabled={isLoading || isDemo || (!pendingComprobante && atCap)}
        />
        {atCap ? (
          <p className="text-xs text-muted-foreground px-0.5">
            Adjuntos: {Math.min(totalUsed, attachmentLimit)}/{attachmentLimit} este mes ·{" "}
            <UpgradeLink
              feature="attachments"
              placement="list_limit"
              className="text-primary font-semibold hover:underline"
            >
              pasá a Premium para ilimitados
            </UpgradeLink>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground px-0.5">
            {totalUsed}/{attachmentLimit} este mes
          </p>
        )}
      </div>
    )
  }

  // Premium: unlimited, original behavior
  if (type === "expense") {
    return (
      <div className="space-y-3">
        <AttachmentSlot
          label="Factura o ticket"
          pendingFile={pendingFactura}
          existingAttachment={existingFactura}
          onSelect={setPendingFactura}
          onClearPending={() => setPendingFactura(null)}
          onDeleted={onAttachmentDeleted}
          disabled={isLoading || isDemo}
        />
        <AttachmentSlot
          label="Recibo / comprobante de pago"
          pendingFile={pendingRecibo}
          existingAttachment={existingRecibo}
          onSelect={setPendingRecibo}
          onClearPending={() => setPendingRecibo(null)}
          onDeleted={onAttachmentDeleted}
          disabled={isLoading || isDemo}
        />
      </div>
    )
  }

  return (
    <AttachmentSlot
      label="Comprobante"
      pendingFile={pendingComprobante}
      existingAttachment={existingComprobante}
      onSelect={setPendingComprobante}
      onClearPending={() => setPendingComprobante(null)}
      onDeleted={onAttachmentDeleted}
      disabled={isLoading || isDemo}
    />
  )
}
