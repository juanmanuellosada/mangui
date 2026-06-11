export type Cell = { ok: "yes" | "partial" | "no"; note?: string }
export interface CompRow { feature: string; mangui: Cell; rival: Cell }
export interface Comparison {
  slug: string
  rival: string
  title: string        // metadata title
  description: string   // metadata description
  intro: string
  rows: CompRow[]
  cuandoMangui: string
  cuandoRival: string
  faq: { q: string; a: string }[]
}

const y = (note?: string): Cell => ({ ok: "yes", note })
const p = (note?: string): Cell => ({ ok: "partial", note })
const n = (note?: string): Cell => ({ ok: "no", note })

export const COMPARISONS: Comparison[] = [
  {
    slug: "mangui-vs-gasti",
    rival: "Gasti",
    title: "Mangui vs Gasti: ¿cuál te conviene en Argentina?",
    description: "Comparativa honesta entre Mangui y Gasti: captura por voz y foto, los 3 dólares, cuotas y resúmenes de tarjeta, precio en pesos vs dólares, y más.",
    intro: "Gasti es una app de finanzas con bot de WhatsApp y Telegram (y también web) para registrar gastos. Mangui es una app de finanzas personales completa, pensada para la plata argentina. Te mostramos las diferencias sin vueltas.",
    rows: [
      { feature: "Captura por voz", mangui: y(), rival: y() },
      { feature: "Foto del ticket (OCR)", mangui: y(), rival: y("plan pago") },
      { feature: "Carga por chat con IA", mangui: y("Manguito"), rival: y() },
      { feature: "3 dólares nativos (blue, MEP, CCL)", mangui: y(), rival: n() },
      { feature: "Cuotas con ciclo de resumen (cierre, vencimiento, sellos)", mangui: y(), rival: n() },
      { feature: "Resumen de tarjeta bimonetario (ARS + USD)", mangui: y(), rival: n() },
      { feature: "Presupuestos, metas y recurrentes", mangui: y(), rival: y() },
      { feature: "Gastos compartidos / grupos", mangui: n("en el roadmap"), rival: y() },
      { feature: "App web / PWA completa", mangui: y(), rival: y() },
      { feature: "Precio", mangui: y("en pesos (MercadoPago)"), rival: p("en dólares") },
    ],
    cuandoMangui: "Si querés entender la plata argentina a fondo (3 dólares, cuotas y resúmenes de tarjeta, resumen bimonetario) y pagar en pesos.",
    cuandoRival: "Si te gusta cargar todo por chat (WhatsApp, Telegram o web) y dividís gastos en grupo con tus amigos.",
    faq: [
      { q: "¿Mangui o Gasti?", a: "Gasti es cómodo para registrar gastos por chat (WhatsApp, Telegram o web). Mangui va más a fondo con la realidad argentina (tres dólares, cuotas con resumen de tarjeta, resumen bimonetario) y cobra en pesos." },
      { q: "¿Mangui también carga por voz y foto?", a: "Sí. Le hablás a Manguito o le sacás una foto al ticket y la IA completa el movimiento, directo en la app." },
      { q: "¿Gasti tiene gastos compartidos y Mangui no?", a: "Gasti tiene grupos. En Mangui el modo compartido/pareja está en el roadmap; hoy es una app de finanzas personales completa." },
    ],
  },
  {
    slug: "mangui-vs-splitwise",
    rival: "Splitwise",
    title: "Mangui vs Splitwise: alternativa argentina para tus finanzas",
    description: "Splitwise divide gastos en grupo; Mangui gestiona todas tus finanzas personales en Argentina. Comparativa honesta, ahora que Splitwise se volvió pago.",
    intro: "Splitwise sirve para DIVIDIR gastos compartidos en grupo. Mangui es para gestionar TUS finanzas personales. No son lo mismo — pero si buscás una alternativa argentina ahora que Splitwise se volvió pago, esto te ayuda a decidir.",
    rows: [
      { feature: "Dividir gastos en grupo / settle-up", mangui: n("en el roadmap"), rival: y() },
      { feature: "Finanzas personales completas (ingresos, gastos, ahorro)", mangui: y(), rival: n() },
      { feature: "Multimoneda ARS/USD + 3 dólares", mangui: y(), rival: p("solo montos") },
      { feature: "Cuotas y resúmenes de tarjeta", mangui: y(), rival: n() },
      { feature: "Presupuestos y metas", mangui: y(), rival: n() },
      { feature: "IA sobre tus datos", mangui: y(), rival: n() },
      { feature: "Gratis para lo básico", mangui: y(), rival: p("pago desde 2026") },
      { feature: "Precio", mangui: y("en pesos"), rival: p("en dólares") },
    ],
    cuandoMangui: "Si querés controlar toda tu plata —no solo dividir gastos— en Argentina y en pesos. El modo compartido/pareja está en el roadmap.",
    cuandoRival: "Si SOLO querés dividir los gastos de un viaje o un departamento entre amigos.",
    faq: [
      { q: "¿Mangui reemplaza a Splitwise?", a: "No del todo: Splitwise está hecho para dividir gastos en grupo, algo que Mangui todavía no hace (está en el roadmap). Pero para controlar tus finanzas personales en Argentina, Mangui hace mucho más." },
      { q: "¿Por qué buscar una alternativa a Splitwise?", a: "Splitwise se volvió pago en 2026 y limitó la versión gratis. Si lo usabas para llevar tus cuentas, Mangui es una opción argentina y en pesos." },
    ],
  },
  {
    slug: "mangui-vs-excel",
    rival: "Excel",
    title: "Mangui vs Excel: ¿planilla o app para tus finanzas?",
    description: "Una planilla es gratis y flexible, pero en Argentina se vuelve un dolor: dólares a mano, cuotas, fórmulas que se rompen. Mangui automatiza lo argentino.",
    intro: "Una planilla de Excel o Google Sheets es gratis y flexible. Pero en Argentina se complica: armar todo a mano, mantener las cotizaciones, que no se rompan las fórmulas. Mangui automatiza la parte argentina.",
    rows: [
      { feature: "Gratis", mangui: p("plan free"), rival: y() },
      { feature: "Listo para usar (sin armar nada)", mangui: y(), rival: n() },
      { feature: "3 dólares actualizados solos", mangui: y(), rival: n("a mano") },
      { feature: "Cuotas con ciclo de resumen", mangui: y(), rival: n("fórmulas a mano") },
      { feature: "Conversión multimoneda automática", mangui: y(), rival: n() },
      { feature: "IA para preguntar sobre tus datos", mangui: y(), rival: n() },
      { feature: "En el celular, con notificaciones", mangui: y(), rival: p() },
      { feature: "Control total / personalización infinita", mangui: p(), rival: y() },
      { feature: "No se rompe al tocar una celda", mangui: y(), rival: n() },
    ],
    cuandoMangui: "Si querés que la parte argentina (dólares, cuotas, inflación) se actualice sola y tenerlo en el celular, sin mantener fórmulas.",
    cuandoRival: "Si te gusta el control total, ya tenés tu sistema armado y no te molesta mantenerlo a mano.",
    faq: [
      { q: "¿Conviene una app o una planilla para finanzas?", a: "Una planilla da control total pero hay que mantenerla a mano: cotizaciones, cuotas, fórmulas. Una app como Mangui automatiza lo argentino y lo tenés en el celular." },
      { q: "¿Puedo pasar mi Excel a Mangui?", a: "La importación de planillas está en el roadmap. Hoy podés empezar de cero rápido: Mangui ya trae categorías, dólares y cuotas listos." },
    ],
  },
]

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug)
}
