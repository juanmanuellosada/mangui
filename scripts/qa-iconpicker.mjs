import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const BASE = "https://mangui-rho.vercel.app";
mkdirSync("design-mockups/qa", { recursive: true });
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "qa@mangui.app");
await p.fill('input[type="password"]', "ManguiQA-2026!");
await p.getByRole("button", { name: /ingresar|entrar|iniciar/i }).first().click();
await p.waitForURL(/\/app\//, { timeout: 30000 }).catch(() => {});
await p.goto(`${BASE}/app/accounts`, { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
// open new-account modal
await p.getByRole("button", { name: /nueva cuenta|agregar cuenta|primera cuenta/i }).first().click().catch(() => {});
await p.waitForTimeout(1200);
// open icon picker: click the round icon chip (centered near top of the modal)
const chip = p.locator('button:near(:text("Tocá para cambiar"))').first();
if (await chip.count()) { await chip.click({ force: true }).catch(() => {}); }
else { await p.mouse.click(720, 297); }
await p.waitForTimeout(1200);
await p.screenshot({ path: "design-mockups/qa/05-iconpicker-open.png", fullPage: true });
// click "Bancos AR" tab
await p.getByRole("button", { name: /bancos ar/i }).first().click().catch(async () => {
  await p.getByText(/bancos ar/i).first().click().catch(() => {});
});
await p.waitForTimeout(1200);
await p.screenshot({ path: "design-mockups/qa/06-iconpicker-bancos-ar.png", fullPage: true });
console.log("📸 05-iconpicker-open.png, 06-iconpicker-bancos-ar.png");
await b.close();
