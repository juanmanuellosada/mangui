import { describe, it, expect } from "vitest"
import { resolveAiAccount } from "./movement-form"

interface Account {
  id: string
  name: string
  is_hidden: boolean
}

function acc(id: string, name: string, is_hidden = false): Account {
  return { id, name, is_hidden }
}

describe("resolveAiAccount", () => {
  const accounts = [
    acc("visa", "Santander Río - Visa Signature"),
    acc("caja", "Santander Río - Caja de ahorro"),
    acc("balanz", "Balanz - Comitente USD"),
  ]

  it("índice dentro de rango: usa la cuenta de ese índice, sin mirar el string", () => {
    const result = resolveAiAccount({ cuenta_idx: 1, cuenta: "cualquier cosa" }, accounts, accounts)
    expect(result).toEqual(accounts[1])
  })

  it("índice fuera de rango: cae al fallback por nombre", () => {
    const result = resolveAiAccount({ cuenta_idx: 5, cuenta: "Santander Visa" }, accounts, accounts)
    expect(result).toEqual(accounts[0])
  })

  it("índice ausente con string presente: resuelve por nombre", () => {
    const result = resolveAiAccount({ cuenta_idx: null, cuenta: "Santander Visa" }, accounts, accounts)
    expect(result).toEqual(accounts[0])
  })

  it("índice ausente sin string: no resuelve nada", () => {
    const result = resolveAiAccount({ cuenta_idx: null, cuenta: null }, accounts, accounts)
    expect(result).toBeNull()
  })

  it("el fallback por nombre excluye cuentas ocultas", () => {
    const withHidden = [acc("hidden", "Santander Río - Visa Signature", true), acc("other", "Banco Ciudad")]
    const result = resolveAiAccount({ cuenta_idx: null, cuenta: "Santander Visa" }, withHidden, withHidden)
    expect(result).toBeNull()
  })
})
