import { test, expect, type Page, type Locator } from "@playwright/test"

/**
 * Flujos de ESCRITURA. Requieren un usuario de test dedicado con permisos de
 * escritura (NO la cuenta demo, que es read-only por RLS). Ver e2e/README.md
 * para cómo provisionarlo.
 *
 * Gateados: se skipean enteros si no están seteadas E2E_EMAIL / E2E_PASSWORD.
 */

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

test.skip(!EMAIL || !PASSWORD, "requiere usuario de test con escritura (E2E_EMAIL / E2E_PASSWORD)")

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(EMAIL!)
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD!)
  await page.getByRole("button", { name: "Iniciar sesión" }).click()
  await page.waitForURL("**/inicio")
}

/**
 * Los selects de cuenta/categoría (MangoSelect) son un componente propio, no
 * un <select> nativo. Asumimos que exponen role="combobox" asociado a su
 * label y opciones con role="option" (patrón habitual sobre Radix Select).
 * Ajustar si el componente real difiere una vez haya entorno de test.
 */
async function selectMangoOption(scope: Page | Locator, label: string) {
  await scope.getByRole("combobox", { name: label }).click()
  await scope.getByRole("option").first().click()
}

test("login con usuario de test redirige a /inicio", async ({ page }) => {
  await login(page)
  await expect(page).toHaveURL(/\/inicio/)
  await expect(page.getByRole("heading", { name: "Actividad reciente" })).toBeVisible()
})

test("alta de movimiento: crear un gasto", async ({ page }) => {
  await login(page)
  await page.getByRole("button", { name: "Nuevo movimiento" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  await dialog.getByRole("button", { name: "Gasto" }).click()
  await dialog.getByLabel("Monto").fill("1500")
  await selectMangoOption(dialog, "Cuenta")
  await selectMangoOption(dialog, "Categoría")
  await dialog.getByLabel("Descripción (opcional)").fill("Test e2e - gasto")

  await dialog.getByRole("button", { name: "Crear movimiento" }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText("Test e2e - gasto")).toBeVisible()
})

test("transferencia entre cuentas", async ({ page }) => {
  await login(page)
  await page.getByRole("button", { name: "Nuevo movimiento" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  await dialog.getByRole("button", { name: "Transferencia" }).click()
  await selectMangoOption(dialog, "Cuenta origen")
  await selectMangoOption(dialog, "Cuenta destino")
  await dialog.getByLabel(/Monto en/).fill("2000")

  await dialog.getByRole("button", { name: "Crear transferencia" }).click()
  await expect(dialog).not.toBeVisible()
})

test("compra en cuotas con tarjeta de crédito", async ({ page }) => {
  await login(page)
  await page.getByRole("button", { name: "Nuevo movimiento" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  await dialog.getByRole("button", { name: "Gasto" }).click()
  // Requiere elegir una cuenta de tipo tarjeta de crédito para que aparezca
  // el selector de cuotas.
  await selectMangoOption(dialog, "Cuenta")
  await dialog.getByLabel("Monto total").fill("30000")
  await dialog.getByRole("button", { name: "3", exact: true }).click()
  await selectMangoOption(dialog, "Categoría")

  await dialog.getByRole("button", { name: "Crear movimiento" }).click()
  await expect(dialog).not.toBeVisible()
})

test("offline: crear movimiento sin conexión se encola para sincronizar", async ({
  page,
  context,
}) => {
  await login(page)
  await context.setOffline(true)

  await page.getByRole("button", { name: "Nuevo movimiento" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  await dialog.getByRole("button", { name: "Gasto" }).click()
  await dialog.getByLabel("Monto").fill("500")
  await selectMangoOption(dialog, "Cuenta")
  await selectMangoOption(dialog, "Categoría")

  await dialog.getByRole("button", { name: "Crear movimiento" }).click()
  await expect(page.getByText("Movimiento guardado sin conexión")).toBeVisible()

  await context.setOffline(false)
})
