import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const BASE = "https://mangui-rho.vercel.app";
mkdirSync("design-mockups/qa", { recursive: true });
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const login = async () => {
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', "qa@mangui.app");
  await p.fill('input[type="password"]', "ManguiQA-2026!");
  await p.locator(String.fromCharCode(39)+"button[type=submit]"+String.fromCharCode(39)).first().click().catch(()=>p.keyboard.press("Enter"));
  await p.waitForURL(/\/app\//, { timeout: 30000 }).catch(() => {});
};
const openModal = async () => {
  await p.goto(`${BASE}/app/accounts`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
  await p.getByRole("button", { name: /nueva cuenta|agregar cuenta|primera cuenta/i }).first().click().catch(()=>{});
  await p.waitForTimeout(1000);
};
try {
  await login();
  // 1) credit-card calendar
  await openModal();
  await p.getByText(/^Caja de ahorro$/i).first().click().catch(()=>{});
  await p.waitForTimeout(600);
  await p.getByText(/tarjeta de cr[eé]dito/i).first().click().catch(()=>{});
  await p.waitForTimeout(1200);
  await p.screenshot({ path: "design-mockups/qa/07-creditcard.png", fullPage: true });
  console.log("📸 07-creditcard.png");
  // 2) Cripto category
  await openModal();
  await p.mouse.click(720, 293); // icon chip
  await p.waitForTimeout(1200);
  await p.getByRole("button", { name: /^Cripto$/i }).first().click().catch(async ()=>{
    await p.getByText(/^Cripto$/i).first().click().catch(()=>{});
  });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "design-mockups/qa/08-cripto.png", fullPage: true });
  console.log("📸 08-cripto.png");
} catch (e) { console.error("ERR", e.message); }
await b.close();
