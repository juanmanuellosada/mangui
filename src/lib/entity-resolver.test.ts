import { describe, it, expect } from "vitest"
import { resolveEntity, normalizeText, tokenize, MIN_SCORE, MIN_MARGIN } from "./entity-resolver"

interface Account {
  id: string
  name: string
  is_hidden: boolean
}

function acc(id: string, name: string, is_hidden = false): Account {
  return { id, name, is_hidden }
}

describe("normalizeText", () => {
  it("lowercases, strips accents and non-alphanumerics, collapses spaces", () => {
    expect(normalizeText("Santander Río - Visa Signature")).toBe("santander rio visa signature")
  })
})

describe("tokenize", () => {
  it("discards tokens shorter than 2 characters", () => {
    expect(tokenize("Caja de ahorro")).toEqual(["caja", "de", "ahorro"])
    expect(tokenize("a b cd")).toEqual(["cd"])
  })
})

describe("resolveEntity", () => {
  it("resuelve un parcial no contiguo: 'Santander Visa' -> Santander Río - Visa Signature", () => {
    const candidates = [
      acc("visa", "Santander Río - Visa Signature"),
      acc("caja", "Santander Río - Caja de ahorro"),
    ]
    const result = resolveEntity("Santander Visa", candidates)
    expect(result).toEqual({ resolved: true, id: "visa", score: expect.closeTo(0.85, 5) })
  })

  it("elige la cuenta larga y no la corta contenida en ella, en los dos órdenes del array", () => {
    const hint = "Visa Santander Platinum"
    const short = acc("short", "Visa")
    const long = acc("long", "Visa Santander Platinum")

    const orderA = resolveEntity(hint, [short, long])
    expect(orderA).toEqual({ resolved: true, id: "long", score: expect.closeTo(1, 5) })

    const orderB = resolveEntity(hint, [long, short])
    expect(orderB).toEqual({ resolved: true, id: "long", score: expect.closeTo(1, 5) })
  })

  it("no resuelve cuando la ambigüedad entre candidatos está por debajo del margen mínimo", () => {
    const candidates = [acc("a", "Banco Uno"), acc("b", "Banco Dos")]
    const result = resolveEntity("Banco", candidates)
    expect(result).toEqual({ resolved: false })
  })

  it("no resuelve un hint por debajo del umbral mínimo", () => {
    const candidates = [acc("visa", "Santander Río - Visa Signature")]
    const result = resolveEntity("Efectivo", candidates)
    expect(result).toEqual({ resolved: false })
  })

  it("excluye una cuenta oculta aunque sería la mejor candidata", () => {
    const candidates = [
      acc("hidden", "Santander Río - Visa Signature", true),
      acc("other", "Banco Ciudad - Caja de ahorro"),
    ]
    const result = resolveEntity("Santander Visa", candidates, { isHidden: (c) => c.is_hidden })
    expect(result).toEqual({ resolved: false })
  })

  it("es insensible a mayúsculas y acentos: 'santander rio' -> Santander Río - Visa Signature", () => {
    const candidates = [acc("visa", "Santander Río - Visa Signature"), acc("balanz", "Balanz - Comitente USD")]
    const result = resolveEntity("santander rio", candidates)
    expect(result.resolved).toBe(true)
    if (result.resolved) expect(result.id).toBe("visa")
  })

  it("devuelve no resuelto sin candidatos o sin hint", () => {
    expect(resolveEntity("algo", [])).toEqual({ resolved: false })
    expect(resolveEntity(null, [acc("a", "Banco")])).toEqual({ resolved: false })
    expect(resolveEntity("", [acc("a", "Banco")])).toEqual({ resolved: false })
  })

  it("expone los umbrales como constantes", () => {
    expect(MIN_SCORE).toBe(0.45)
    expect(MIN_MARGIN).toBe(0.15)
  })
})
