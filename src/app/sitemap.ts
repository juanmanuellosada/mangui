import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mangui.com.ar"
  const paths = ["", "/calculadoras", "/calculadoras/cuotas-vs-contado", "/calculadoras/sueldo-inflacion", "/calculadoras/conversor-dolar", "/privacidad", "/terminos"]
  return paths.map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.7,
  }))
}
