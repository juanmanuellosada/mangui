import { strict as assert } from "node:assert"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { chromium, expect, test, type Page } from "@playwright/test"
import { build } from "vite"
import { compile } from "@tailwindcss/node"
import { Scanner } from "@tailwindcss/oxide"
import type { BudgetFormValues } from "../src/components/budgets/budget-form"
import type { BudgetProgress } from "../src/lib/budgets"

// Real form, validation, calculation, summary and styles. Confirmation stays in memory.
type Scenario = { incomeA: number; incomeB: number; defaults?: Partial<BudgetFormValues> }
declare global {
  interface Window {
    renderBudgetFixture: (scenario: Scenario) => void
    budgetConfirmations: { values: BudgetFormValues; progress: BudgetProgress }[]
  }
}

const root = process.cwd()
async function buildFixture() {
  const mocks: Record<string, string> = {
    "@/lib/use-is-demo": "export const useIsDemo=()=>false",
    "@/lib/supabase/client": 'export const createClient=()=>{throw new Error("Unexpected auth/storage access in isolated budget fixture")}',
  }
  const result = await build({
    configFile: false, envFile: false, publicDir: false, logLevel: "error",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: { alias: { "@": resolve(root, "src") } },
    plugins: [{
      name: "isolated-percentage-budgets",
      enforce: "pre",
      resolveId(id) {
        const key = id.endsWith("/virtual:budgets") ? "virtual:budgets" : id.replace(`${root}/src/`, "@/")
        if (key === "virtual:budgets" || key in mocks) return `\0${key}`
      },
      load(id) {
        if (id === "\0virtual:budgets") return `
          import {createElement,useState} from "react";
          import {createRoot} from "react-dom/client";
          import {BudgetForm} from ${JSON.stringify(resolve(root, "src/components/budgets/budget-form.tsx"))};
          import {BudgetComplianceStrip} from ${JSON.stringify(resolve(root, "src/components/stats/budget-compliance-strip.tsx"))};
          import {computeBudgetProgress} from ${JSON.stringify(resolve(root, "src/lib/budgets.ts"))};
          const accounts=[
            {id:"acc-a",name:"Cuenta principal",type:"banco",currency:"ARS",icon:null},
            {id:"acc-b",name:"Cuenta secundaria",type:"banco",currency:"ARS",icon:null}
          ];
          const categories=[{id:"food",name:"Comida",type:"expense",icon:null}];
          const budget={id:"budget",user_id:"fixture",name:"Comida",icon:null,
            limit_amount:1,currency:"ARS",period:"monthly",start_date:"2026-06-01",end_date:"2026-06-30",
            is_recurring:true,status:"active",category_ids:["food"],account_ids:[],rollover_enabled:false,
            alert_threshold:80,created_at:"",updated_at:""};
          function Fixture({incomeA,incomeB,defaults}){
            const [confirmed,setConfirmed]=useState(null);
            const movement={is_future:false,date:"2026-06-15",category_id:"salary",converted_amount:null,original_currency:"ARS"};
            const movements=[
              {...movement,id:"income-a",type:"income",account_id:"acc-a",amount:incomeA},
              {...movement,id:"income-b",type:"income",account_id:"acc-b",amount:incomeB},
              {...movement,id:"future",type:"income",account_id:"acc-a",amount:900000,is_future:true},
              {...movement,id:"transfer",type:"transfer",account_id:"acc-a",amount:900000},
              {...movement,id:"expense",type:"expense",account_id:"acc-a",amount:10000,category_id:"food"}
            ];
            return createElement("div",{className:"space-y-5"},
              createElement(BudgetForm,{accounts,categories,movements,
                defaultValues:{name:"Comida",category_ids:["food"],...defaults},
                onSubmit:async(values)=>{
                  const saved={...budget,...values};
                  window.budgetConfirmations.push({values,progress:computeBudgetProgress(saved,movements)});
                  setConfirmed(saved);
                }}),
              confirmed&&createElement("section",{"data-testid":"confirmed-summary"},
                createElement(BudgetComplianceStrip,{budgets:[confirmed],movements}))
            );
          }
          const root=createRoot(document.getElementById("root"));let version=0;
          window.renderBudgetFixture=(scenario)=>{
            window.budgetConfirmations=[];
            root.render(createElement(Fixture,{key:++version,...scenario}));
          };
        `
        return mocks[id.slice(1)]
      },
    }],
    build: { write: false, minify: false, lib: { entry: "virtual:budgets", formats: ["iife"], name: "BudgetFixture" } },
  })
  const bundle = Array.isArray(result) ? result[0] : result
  assert("output" in bundle)
  const chunk = bundle.output.find((output) => output.type === "chunk")
  assert(chunk?.type === "chunk")
  const compiler = await compile(await readFile(resolve(root, "src/app/globals.css"), "utf8"), { base: root, onDependency() {} })
  const scanner = new Scanner({})
  const candidates = scanner.scanFiles(await Promise.all([
    "src/components/budgets/budget-form.tsx", "src/components/budgets/budget-income-pending.tsx",
    "src/components/stats/budget-compliance-strip.tsx", "src/components/ui/button.tsx",
    "src/components/ui/input.tsx", "src/components/ui/label.tsx", "src/components/ui/money-input.tsx",
    "src/components/ui/switch.tsx", "src/components/ui/currency-toggle.tsx",
    "src/components/ui/mango-date-picker.tsx", "src/components/ui/mango-multi-select.tsx",
  ].map(async (file) => ({ content: await readFile(resolve(root, file), "utf8"), extension: "tsx" }))))
  return { script: chunk.code, css: compiler.build(candidates) }
}

async function noOverflow(page: Page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow")
  for (const control of await page.locator("form input:visible, form select:visible, form button:visible").all()) {
    const box = await control.boundingBox()
    assert(box && box.width > 0 && box.x >= 0 && box.x + box.width <= page.viewportSize()!.width, "control fits viewport")
  }
}

async function checkBudgets(page: Page, width: number, fixture: { script: string; css: string }) {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.clock.setFixedTime(new Date("2026-06-15T15:00:00Z"))
  await page.route("**/*", (route) => route.abort())
  await page.setContent(`<html lang="es-AR"><head><style>${fixture.css}</style></head><body style="padding:16px"><main style="max-width:448px;margin:auto" id="root"></main></body></html>`)
  await page.addScriptTag({ content: fixture.script })
  await page.evaluate(() => window.renderBudgetFixture({ incomeA: 600000, incomeB: 400000 }))

  const form = page.locator("form")
  const mode = form.getByLabel("Tipo de límite", { exact: true })
  const submit = form.getByRole("button", { name: "Guardar presupuesto", exact: true })
  await expect(mode).toHaveValue("fixed")
  await expect(form.getByLabel("Límite", { exact: true })).toBeVisible()
  await submit.click()
  await expect(form.getByText("El límite debe ser mayor a 0", { exact: true })).toBeVisible()
  assert.equal(await page.evaluate(() => window.budgetConfirmations.length), 0)
  await form.getByLabel("Límite", { exact: true }).fill("300000")
  await submit.click()
  await expect(page.getByTestId("confirmed-summary")).toContainText("300.000,00")
  assert.equal(await page.evaluate(() => window.budgetConfirmations[0].progress.limit), 300000)
  await noOverflow(page)

  await mode.selectOption("percentage")
  const percentage = form.getByLabel("Porcentaje de ingresos", { exact: true })
  await expect(form.getByLabel("Límite", { exact: true })).toHaveCount(0)
  await expect(percentage).toHaveValue("20")
  await expect(form.getByText(/de.*200\.000,00.*límite/)).toBeVisible()
  await percentage.fill("0")
  await submit.click()
  assert.equal(await percentage.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow), true)
  assert.equal(await page.evaluate(() => window.budgetConfirmations.length), 1)
  await percentage.fill("20")
  await form.getByLabel("Nombre", { exact: true }).fill("")
  await submit.click()
  await expect(form.getByText("El nombre es obligatorio", { exact: true })).toBeVisible()
  assert.equal(await page.evaluate(() => window.budgetConfirmations.length), 1)
  await form.getByLabel("Nombre", { exact: true }).fill("Comida")
  await submit.click()
  await expect(page.getByTestId("confirmed-summary")).toContainText("200.000,00")
  const confirmed = await page.evaluate(() => window.budgetConfirmations[1])
  assert.equal(confirmed.values.limit_mode, "percentage")
  assert.equal(confirmed.values.income_percentage, 20)
  assert.equal(confirmed.progress.limit, 200000)
  assert.deepEqual(confirmed.values.account_ids, [])

  await form.getByRole("combobox", { name: "Cuentas del presupuesto", exact: true }).click()
  await noOverflow(page)
  await page.getByRole("option", { name: "Cuenta principal", exact: true }).click()
  await form.getByLabel("Nombre", { exact: true }).click()
  await expect(form.getByText(/de.*120\.000,00.*límite/)).toBeVisible()
  await submit.click()
  await expect(page.getByTestId("confirmed-summary")).toContainText("120.000,00")
  const scoped = await page.evaluate(() => window.budgetConfirmations[2])
  assert.deepEqual(scoped.values.account_ids, ["acc-a"])
  assert.deepEqual(scoped.values.category_ids, ["food"])
  assert.equal(scoped.progress.limit, 120000, "income ignores expense category and excludes other accounts/future/transfer")
  await noOverflow(page)

  await page.evaluate(() => window.renderBudgetFixture({
    incomeA: 0, incomeB: 0,
    defaults: { limit_mode: "percentage", income_percentage: 20, limit_amount: 1, account_ids: ["acc-a"] },
  }))
  await expect(form.getByText(/Sin ingresos registrados\./)).toBeVisible()
  await submit.click()
  const summary = page.getByTestId("confirmed-summary")
  await expect(summary.getByText("Sin ingresos registrados", { exact: true })).toBeVisible()
  await expect(summary.getByRole("progressbar")).toHaveCount(0)
  assert.equal(await page.evaluate(() => window.budgetConfirmations[0].progress.limit), null)
  await mode.selectOption("fixed")
  await form.getByLabel("Límite", { exact: true }).fill("250000")
  await submit.click()
  await expect(summary).toContainText("250.000,00")
  await expect(summary.getByText("Sin ingresos registrados", { exact: true })).toHaveCount(0)
  assert.equal(await page.evaluate(() => window.budgetConfirmations[1].progress.limit), 250000)
  await noOverflow(page)
  assert.deepEqual(errors, [], "no browser runtime errors")
  console.log(`Budgets ${width}px: real fixed/percentage controls, validation, in-memory confirmation, 20% of 1000000 = 200000, account scope = 120000, no-income state, fixed without income and no horizontal overflow passed`)
}

// Standalone mode creates no build assets, Playwright reports, app server or storage writes.
if (process.argv[1]?.endsWith("percentage-budgets.spec.ts")) {
  const fixture = await buildFixture()
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [360, 1280]) {
      const page = await browser.newPage()
      try { await checkBudgets(page, width, fixture) } finally { await page.close() }
    }
  } finally { await browser.close() }
} else {
  for (const width of [360, 1280]) {
    test(`Percentage budgets isolated ${width}px`, async ({ page }) => {
      await checkBudgets(page, width, await buildFixture())
    })
  }
}
