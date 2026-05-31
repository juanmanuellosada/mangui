import type { Metadata } from "next"
import { AccountsList } from "@/components/accounts/accounts-list"

export const metadata: Metadata = {
  title: "Cuentas",
}

export default function AccountsPage() {
  return <AccountsList />
}
