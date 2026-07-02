import { test, expect } from "@playwright/test"

/**
 * Smokes de LECTURA: no crean, editan ni borran datos. Corren contra prod por
 * default (ver playwright.config.ts) usando la cuenta demo, que es read-only
 * por RLS.
 */

test("landing carga y muestra contenido clave", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("bajo control")
  await expect(page.getByRole("link", { name: "Ver demo" }).first()).toBeVisible()
})

test("página de login renderiza", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Bienvenido de vuelta" })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible()
})

test("calculadora pública de cuotas vs contado funciona", async ({ page }) => {
  await page.goto("/calculadoras/cuotas-vs-contado")
  await page.getByLabel("Precio al contado").fill("100000")
  await page.getByLabel("Cantidad de cuotas").fill("3")
  await page.getByLabel("Valor de cada cuota").fill("40000")
  await page.getByLabel("Inflación mensual esperada (%)").fill("5")
  await expect(page.getByText(/Conviene financiar|Conviene el contado/)).toBeVisible()
})

test("flujo demo carga y muestra datos sembrados en /inicio", async ({ page }) => {
  await page.goto("/demo")
  await page.waitForURL("**/inicio", { timeout: 15_000 })
  await expect(page.getByRole("heading", { name: "Actividad reciente" })).toBeVisible()
  await expect(page.getByText(/Sin actividad en los últimos/)).not.toBeVisible()
})
