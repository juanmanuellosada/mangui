import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mangui.com.ar"
  const paths = ["", "/calculadoras", "/calculadoras/cuotas-vs-contado", "/calculadoras/sueldo-inflacion", "/calculadoras/conversor-dolar", "/calculadoras/regla-50-30-20", "/privacidad", "/terminos"]
  const compararPaths = ["/comparar", "/comparar/mangui-vs-gasti", "/comparar/mangui-vs-splitwise", "/comparar/mangui-vs-excel"]
  const paraPaths = ["/para", "/para/freelancers", "/para/monotributistas"]
  return [
    ...paths.map((p) => ({
      url: `${base}${p}`,
      changeFrequency: "monthly" as const,
      priority: p === "" ? 1 : 0.7,
    })),
    ...compararPaths.map((p) => ({
      url: `${base}${p}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...paraPaths.map((p) => ({
      url: `${base}${p}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ]
}
