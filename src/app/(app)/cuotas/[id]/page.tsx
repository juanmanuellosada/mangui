import type { Metadata } from "next"
import { InstallmentDetail } from "@/components/installments/installment-detail"

export const metadata: Metadata = {
  title: "Detalle de cuotas",
}

export default async function InstallmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <InstallmentDetail purchaseId={id} />
}
