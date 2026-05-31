import type { Metadata } from "next"
import { CardsList } from "@/components/cards/cards-list"

export const metadata: Metadata = {
  title: "Tarjetas",
}

export default function CardsPage() {
  return <CardsList />
}
