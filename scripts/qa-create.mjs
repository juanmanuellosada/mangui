import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const BASE = "https://mangui-rho.vercel.app";
mkdirSync("design-mockups/qa", { recursive: true });
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
try {
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', "qa@mangui.app");
  await p.fill('input[type="password"]', "ManguiQA-2026!");
  await p.locator('button[type="submit"]').first().click().catch(()=>p.keyboard.press("Enter"));
  await p.waitForURL(/\/app\//, { timeout: 30000 }).catch(()=>{});
  await p.goto(`${BASE}/app/cuentas`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.getByRole("button", { name: /nueva cuenta|agregar cuenta|primera cuenta/i }).first().click().catch(()=>{});
  await p.waitForTimeout(900);
  await p.getByPlaceholder(/Cuenta Galicia/i).fill("Caja Galicia").catch(()=>{});
  await p.locator('input[type="number"]').first().fill("150000").catch(()=>{});
  await p.getByRole("button", { name: /^Crear cuenta$/i }).first().click().catch(()=>{});
  await p.waitForTimeout(2500);
  await p.goto(`${BASE}/app/cuentas`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "design-mockups/qa/09-accounts-filterbar.png", fullPage: true });
  console.log("📸 09-accounts-filterbar.png");
} catch(e){ console.error("ERR", e.message); }
await b.close();
