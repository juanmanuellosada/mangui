import { strict as assert } from "node:assert"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { chromium, expect, test, type Page } from "@playwright/test"
import { build } from "vite"
import { compile } from "@tailwindcss/node"
import { Scanner } from "@tailwindcss/oxide"
import type { SmartDashboardMovement } from "../src/lib/dashboard/smart-dashboard"

// Isolated fixture: real widget, signal builder and styles; no server, auth or network.
type QueryState = { data: SmartDashboardMovement[]; isLoading: boolean; isError: boolean }
declare global {
  interface Window {
    radarState: QueryState
    radarNextState: QueryState
    renderRadar: () => void
    retryCount: number
  }
}

const root = process.cwd()
let fixture: Promise<{ script: string; css: string }> | undefined
function buildFixture() {
  return fixture ??= (async () => {
    const mocks: Record<string, string> = {
      "next/link": 'import {createElement} from "react"; export default ({href,children,...props}) => createElement("a",{href,...props},children)',
      "@tanstack/react-query": 'import {useState} from "react"; export function useQuery(){const [state,setState]=useState(window.radarState);return {...state,refetch:()=>{window.retryCount++;setState(window.radarNextState)}}}',
      "@/lib/hooks/use-categories": 'export const useCategories=()=>({data:[{id:"food",name:"Comida y compras para toda la familia"}]})',
      "@/lib/movements": 'export const fetchAllMovements=()=>{throw new Error("Unexpected fixture fetch")}',
      "@/lib/date-utils": 'export const todayAR=()=>"2026-03-15"',
    }
    const result = await build({
      configFile: false, envFile: false, publicDir: false, logLevel: "error",
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      resolve: { alias: { "@": resolve(root, "src") } },
      plugins: [{
        name: "isolated-radar",
        enforce: "pre",
        resolveId(id) {
          const key = id.endsWith("/virtual:radar") ? "virtual:radar" : id.replace(`${root}/src/`, "@/")
          if (key === "virtual:radar" || key in mocks) return `\0${key}`
        },
        load(id) {
          if (id === "\0virtual:radar") return `
            import {createElement} from "react";
            import {createRoot} from "react-dom/client";
            import {SmartDashboardWidget} from ${JSON.stringify(resolve(root, "src/components/dashboard/smart-dashboard-widget.tsx"))};
            const root=createRoot(document.getElementById("root"));let version=0;
            window.renderRadar=()=>root.render(createElement(SmartDashboardWidget,{key:++version}));
          `
          return mocks[id.slice(1)]
        },
      }],
      build: { write: false, minify: false, lib: { entry: "virtual:radar", formats: ["iife"], name: "RadarFixture" } },
    })
    const bundle = Array.isArray(result) ? result[0] : result
    assert("output" in bundle)
    const chunk = bundle.output.find((output) => output.type === "chunk")
    assert(chunk?.type === "chunk")
    const css = await readFile(resolve(root, "src/app/globals.css"), "utf8")
    const compiler = await compile(css, { base: root, onDependency() {} })
    const scanner = new Scanner({})
    const candidates = scanner.scanFiles(await Promise.all([
      "src/components/dashboard/smart-dashboard-widget.tsx",
      "src/components/ui/skeleton.tsx", "src/components/ui/button.tsx",
    ].map(async (file) => ({ content: await readFile(resolve(root, file), "utf8"), extension: "tsx" }))))
    return { script: chunk.code, css: compiler.build(candidates) }
  })()
}

function movement(overrides: Partial<SmartDashboardMovement> = {}): SmartDashboardMovement {
  return {
    id: "expense", type: "expense", is_future: false, date: "2026-03-15",
    category_id: "food", amount: 10000, converted_amount: null,
    original_currency: "ARS", ...overrides,
  }
}

async function renderState(page: Page, state: Partial<QueryState> = {}) {
  await page.evaluate((state) => {
    window.radarState = { data: [], isLoading: false, isError: false, ...state }
    window.renderRadar()
  }, state)
}

async function checkRadar(page: Page, width: number, dark: boolean) {
  const { script, css } = await buildFixture()
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.route("**/*", (route) => route.abort())
  await page.setContent(`<html lang="es-AR" class="${dark ? "dark" : ""}"><head><style>${css}</style></head><body style="padding:16px"><main style="max-width:960px;margin:auto" id="root"></main></body></html>`)
  page.on("pageerror", (error) => { throw error })
  await page.addScriptTag({ content: script })
  await renderState(page, { data: [
    ...Array.from({ length: 5 }, (_, i) => movement({ id: `history-${i}`, date: `2026-02-0${i + 1}`, amount: 2000 })),
    movement(), movement({ id: "next", is_future: true, date: "2026-03-16", amount: 3000 }),
  ] })
  const radar = page.getByRole("region", { name: "Radar inteligente" })
  await expect(radar.getByRole("listitem")).toHaveCount(3)
  await expect(radar.getByRole("heading", { level: 4 })).toHaveText([
    "Gasto inusual", "Cierre de mes estimado", "1 movimiento previsto",
  ])
  const links = radar.getByRole("link")
  for (const [i, href] of ["/movimientos", "/estadisticas", "/movimientos"].entries()) {
    await expect(links.nth(i)).toHaveAttribute("href", href)
    const box = await links.nth(i).boundingBox()
    assert(box && box.height >= 44 && box.width >= 44, "44px touch target")
    assert(await links.nth(i).innerText(), "visible action label")
  }
  await page.keyboard.press("Tab")
  await expect(links.first()).toBeFocused()
  assert(await links.first().evaluate((link) => getComputedStyle(link).boxShadow !== "none"), "visible keyboard focus")
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow")
  const contrastFailures = await radar.locator("p, h3, h4, a").evaluateAll((elements) => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext("2d")!
    const luminance = (rgb: Uint8ClampedArray) => {
      const linear = Array.from(rgb).slice(0, 3).map((value) => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    }
    return elements.flatMap((element) => {
      const ancestors: Element[] = []
      for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current)
      ctx.fillStyle = "white"
      ctx.fillRect(0, 0, 1, 1)
      for (const ancestor of ancestors) {
        ctx.fillStyle = getComputedStyle(ancestor).backgroundColor
        ctx.fillRect(0, 0, 1, 1)
      }
      const background = luminance(ctx.getImageData(0, 0, 1, 1).data)
      ctx.fillStyle = getComputedStyle(element).color
      ctx.fillRect(0, 0, 1, 1)
      const foreground = luminance(ctx.getImageData(0, 0, 1, 1).data)
      const ratio = (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05)
      return ratio < 4.5 ? [`${element.textContent}: ${ratio.toFixed(2)}`] : []
    })
  })
  assert.deepEqual(contrastFailures, [], "WCAG AA text contrast")

  await renderState(page, { isLoading: true })
  await expect(radar.getByRole("status")).toHaveText("Cargando señales del Radar")
  await expect(links).toHaveCount(0)
  await renderState(page, { isError: true })
  await expect(radar.getByRole("alert")).toContainText("No pudimos cargar las señales del Radar")
  await page.evaluate(() => {
    window.retryCount = 0
    window.radarNextState = { data: [], isLoading: false, isError: false }
  })
  await radar.getByRole("button", { name: "Reintentar" }).click()
  await expect(radar.getByText("Registrá tus primeros movimientos")).toBeVisible()
  assert.equal(await page.evaluate(() => window.retryCount), 1)
  await expect(radar.getByRole("link", { name: "Ver movimientos" })).toHaveAttribute("href", "/movimientos")
  await renderState(page, { data: [movement({ type: "income" })] })
  await expect(radar.getByText("Sin señales para hoy")).toBeVisible()
  console.log(`Radar ${width}px ${dark ? "dark" : "light"}: signals, routes, 44px targets, keyboard, no overflow, AA text contrast, loading, retry and empty states passed`)
}

// Standalone mode keeps all generated assets in memory, without Playwright reports.
if (process.argv[1]?.endsWith("radar.spec.ts")) {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [360, 1280]) {
      for (const dark of [false, true]) {
        const page = await browser.newPage()
        try { await checkRadar(page, width, dark) } finally { await page.close() }
      }
    }
  } finally { await browser.close() }
} else {
  for (const width of [360, 1280]) {
    for (const dark of [false, true]) {
      test(`Radar isolated ${width}px ${dark ? "dark" : "light"}`, async ({ page }) => {
        await checkRadar(page, width, dark)
      })
    }
  }
}
