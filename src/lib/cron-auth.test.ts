import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { assertCronAuth } from "./cron-auth"

const URL = "https://mangui.com.ar/api/cron/refresh-rates"

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest(URL, { headers })
}

describe("assertCronAuth", () => {
  const originalSecret = process.env.CRON_SECRET

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = originalSecret
    }
  })

  it("fails closed with 500 when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET

    const res = assertCronAuth(makeRequest({ authorization: "Bearer anything" }))

    expect(res).not.toBeNull()
    expect(res!.status).toBe(500)
    const body = await res!.json()
    expect(body).toEqual({ error: "Cron not configured" })
  })

  describe("when CRON_SECRET is set", () => {
    beforeEach(() => {
      process.env.CRON_SECRET = "super-secret-value"
    })

    it("rejects with 401 when there is no authorization header", async () => {
      const res = assertCronAuth(makeRequest())

      expect(res).not.toBeNull()
      expect(res!.status).toBe(401)
      const body = await res!.json()
      expect(body).toEqual({ error: "Unauthorized" })
    })

    it("rejects with 401 when the bearer token does not match", async () => {
      const res = assertCronAuth(makeRequest({ authorization: "Bearer wrong-value" }))

      expect(res).not.toBeNull()
      expect(res!.status).toBe(401)
    })

    // .replace("Bearer ", "") is a no-op when the header doesn't contain that
    // substring, so a bare secret (without the "Bearer " prefix) still matches.
    it("treats a bare secret value (no 'Bearer ' prefix) as authorized", () => {
      const res = assertCronAuth(makeRequest({ authorization: "super-secret-value" }))

      expect(res).toBeNull()
    })

    it("allows the request through (returns null) with a correct Bearer token", () => {
      const res = assertCronAuth(makeRequest({ authorization: "Bearer super-secret-value" }))

      expect(res).toBeNull()
    })
  })
})
