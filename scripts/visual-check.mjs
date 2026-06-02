// Visual QA: log into prod and screenshot key screens. Run: node scripts/visual-check.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.QA_BASE || "https://mangui-rho.vercel.app";
const EMAIL = process.env.QA_EMAIL || "qa@mangui.app";
const PASS = process.env.QA_PASS || "ManguiQA-2026!";
const OUT = "design-mockups/qa";
mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`  📸 ${name}.png`);
};

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") console.log("  [console error]", m.text().slice(0, 160)); });

  console.log("→ login");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.getByRole("button", { name: /ingresar|iniciar|entrar/i }).first().click();
  await page.waitForURL(/\/app\//, { timeout: 30000 }).catch(() => console.log("  (no redirigió a /app — sigo igual)"));
  await page.waitForTimeout(2500);
  await shot(page, "01-dashboard-desktop");

  console.log("→ cuentas");
  await page.goto(`${BASE}/app/cuentas`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot(page, "02-accounts-desktop");

  console.log("→ abrir modal nueva cuenta");
  const triggers = [
    page.getByRole("button", { name: /nueva cuenta|agregar cuenta|crear.*cuenta|primera cuenta/i }),
    page.getByRole("link", { name: /agregar cuenta|nueva cuenta/i }),
  ];
  let opened = false;
  for (const t of triggers) {
    if (await t.first().count()) { await t.first().click().catch(() => {}); opened = true; break; }
  }
  if (!opened) {
    // fallback: any button containing "cuenta"
    await page.getByText(/cuenta/i).first().click().catch(() => {});
  }
  await page.waitForTimeout(1800);
  await shot(page, "03-account-modal-desktop");

  // mobile view of dashboard
  const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await mp.fill('input[type="email"]', EMAIL);
  await mp.fill('input[type="password"]', PASS);
  await mp.getByRole("button", { name: /ingresar|iniciar|entrar/i }).first().click();
  await mp.waitForURL(/\/app\//, { timeout: 30000 }).catch(() => {});
  await mp.waitForTimeout(2500);
  await shot(mp, "04-dashboard-mobile");

  await browser.close();
  console.log("listo →", OUT);
};

run().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
