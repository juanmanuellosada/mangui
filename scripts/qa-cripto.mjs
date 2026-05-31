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
  await p.goto(`${BASE}/app/accounts`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.getByRole("button", { name: /nueva cuenta|agregar cuenta/i }).first().click().catch(()=>{});
  await p.waitForTimeout(900);
  // open icon picker — click the round icon chip (default modal, chip ~y=237)
  await p.mouse.click(720, 237);
  await p.waitForTimeout(1200);
  // click Cripto category chip
  await p.getByText(/^Cripto$/).first().click().catch(()=>{});
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "design-mockups/qa/08-cripto.png", fullPage: true });
  console.log("📸 08-cripto.png");
} catch(e){ console.error("ERR", e.message); }
await b.close();
