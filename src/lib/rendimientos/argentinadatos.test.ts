import { afterEach, describe, expect, it, vi } from "vitest"
import { getRendimientos } from "./argentinadatos"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getRendimientos", () => {
  it("degrades a fulfilled non-array response to an empty section", async () => {
    const responses: unknown[] = [{ error: "temporary upstream response" }, [], [], [], [], [], [], [], []]
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => responses.shift(),
    }))
    vi.stubGlobal("fetch", fetchMock)

    const rendimientos = await getRendimientos()

    expect(fetchMock).toHaveBeenCalledTimes(9)
    expect(rendimientos.plazoFijo).toEqual([])
    expect(rendimientos.billeteras).toEqual([])
    expect(rendimientos.fci).toEqual([])
    expect(rendimientos.usdFci).toEqual([])
    expect(rendimientos.usdStablecoin).toEqual([])
    expect(rendimientos.cuentasRemuneradasUsd).toEqual([])
    expect(rendimientos.letras).toEqual([])
    expect(rendimientos.criptopesos).toEqual([])
    expect(rendimientos.pfUva).toEqual([])
  })
})
