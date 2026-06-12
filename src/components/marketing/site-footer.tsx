import Link from "next/link"
import { BrandLockup } from "@/components/brand-lockup"
import { COMPARISONS } from "@/lib/marketing/comparisons"
import { AUDIENCES } from "@/lib/marketing/audiences"

const CALCULADORAS = [
  { href: "/calculadoras/cuotas-vs-contado", label: "Cuotas vs contado" },
  { href: "/calculadoras/sueldo-inflacion", label: "Sueldo ajustado por inflación" },
  { href: "/calculadoras/conversor-dolar", label: "Conversor Blue / MEP / CCL" },
  { href: "/calculadoras/regla-50-30-20", label: "Regla 50/30/20" },
]

const LINK_CLASS =
  "text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"

function FooterColumn({
  heading,
  links,
}: {
  heading: string
  links: { href: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-foreground">{heading}</p>
      <ul className="space-y-2">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className={LINK_CLASS}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SiteFooter() {
  const calculadorasLinks = [
    { href: "/calculadoras", label: "Ver todas" },
    ...CALCULADORAS,
  ]

  const comparativasLinks = [
    { href: "/comparar", label: "Ver todas" },
    ...COMPARISONS.map((c) => ({
      href: `/comparar/${c.slug}`,
      label: `Mangui vs ${c.rival}`,
    })),
  ]

  const audienciasLinks = [
    { href: "/para", label: "Ver todas" },
    ...AUDIENCES.map((a) => ({
      href: `/para/${a.slug}`,
      label: `Para ${a.name.toLowerCase()}`,
    })),
  ]

  const productoLinks = [
    { href: "/#funciones", label: "Funciones" },
    { href: "/#precios", label: "Precios" },
    { href: "/register", label: "Crear cuenta" },
    { href: "/login", label: "Ingresar" },
  ]

  const legalLinks = [
    { href: "/privacidad", label: "Privacidad" },
    { href: "/terminos", label: "Términos" },
  ]

  return (
    <footer className="border-t border-white/10 bg-black/40 backdrop-blur-[2px] py-12">
      <div className="container mx-auto px-5 max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr_1fr_0.9fr] gap-8">
          {/* Column 1 — Brand */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <Link
              href="/"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded w-fit"
            >
              <BrandLockup size={26} />
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[24ch]">
              Finanzas personales para la realidad argentina.
            </p>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} mangui
            </p>
          </div>

          {/* Column 2 — Calculadoras */}
          <FooterColumn heading="Calculadoras" links={calculadorasLinks} />

          {/* Column 3 — Comparativas */}
          <FooterColumn heading="Comparativas" links={comparativasLinks} />

          {/* Column 4 — Mangui para vos */}
          <FooterColumn heading="Mangui para vos" links={audienciasLinks} />

          {/* Column 5 — Producto + Legal stacked */}
          <div className="flex flex-col gap-6">
            <FooterColumn heading="Producto" links={productoLinks} />
            <FooterColumn heading="Legal" links={legalLinks} />
          </div>
        </div>
      </div>
    </footer>
  )
}
