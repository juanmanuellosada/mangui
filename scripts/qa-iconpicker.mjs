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
await p.mouse.click(720, 293);
await p.waitForTimeout(1300);
await p.screenshot({ path: "design-mockups/qa/05-iconpicker-open.png", fullPage: true });
// click "logos" tab
await p.getByRole("button", { name: /logos/i }).first().click().catch(async () => {
  await p.getByText(/logos/i).first().click().catch(() => {});
});
await p.waitForTimeout(1200);
await p.screenshot({ path: "design-mockups/qa/06-iconpicker-bancos-ar.png", fullPage: true });
console.log("📸 05-iconpicker-open.png, 06-iconpicker-bancos-ar.png");
await b.close();
