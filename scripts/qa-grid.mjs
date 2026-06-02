import { chromium } from "playwright";
const BASE="https://mangui-rho.vercel.app";
const b=await chromium.launch({headless:true});
const p=await (await b.newContext({viewport:{width:1600,height:1000}})).newPage();
await p.goto(`${BASE}/login`,{waitUntil:"networkidle"});
await p.fill('input[type="email"]',"qa@mangui.app"); await p.fill('input[type="password"]',"ManguiQA-2026!");
await p.locator('button[type="submit"]').first().click().catch(()=>p.keyboard.press("Enter"));
await p.waitForURL(/\/app\//,{timeout:30000}).catch(()=>{});
// create 3 accounts via UI
for (const [name,saldo] of [["Mercado Pago","48250"],["Brubank USD","1200"],["Efectivo","30000"]]) {
  await p.goto(`${BASE}/app/cuentas`,{waitUntil:"networkidle"}); await p.waitForTimeout(900);
  await p.getByRole("button",{name:/Nueva cuenta/i}).first().click().catch(()=>{});
  await p.waitForTimeout(700);
  await p.getByPlaceholder(/Cuenta Galicia/i).fill(name).catch(()=>{});
  await p.locator('input[type="number"]').first().fill(saldo).catch(()=>{});
  await p.getByRole("button",{name:/^Crear cuenta$/i}).first().click().catch(()=>{});
  await p.waitForTimeout(1800);
}
await p.goto(`${BASE}/app/cuentas`,{waitUntil:"networkidle"}); await p.waitForTimeout(1500);
await p.screenshot({path:"design-mockups/qa/15-accounts-grid.png",fullPage:true});
await p.goto(`${BASE}/app/inicio`,{waitUntil:"networkidle"}); await p.waitForTimeout(2000);
await p.screenshot({path:"design-mockups/qa/16-dashboard-wide.png",fullPage:true});
console.log("ok"); await b.close();
