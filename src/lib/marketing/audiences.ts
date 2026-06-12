export interface AudienceReto { titulo: string; texto: string }
export interface AudienceFeature { emoji: string; titulo: string; texto: string }
export interface Audience {
  slug: string
  name: string
  title: string        // metadata title
  description: string   // metadata description
  headline: string
  subhead: string
  nota?: string         // aviso honesto (ej. feature en roadmap)
  retos: AudienceReto[]
  features: AudienceFeature[]
  faq: { q: string; a: string }[]
}

export const AUDIENCES: Audience[] = [
  {
    slug: "freelancers",
    name: "Freelancers",
    title: "Mangui para freelancers: ordená tu plata en dólares y pesos",
    description: "¿Cobrás en dólares o cripto, de varios clientes y nunca igual? Mangui ordena esa plata irregular y multimoneda, con los 3 dólares y ahorro en USD.",
    headline: "Mangui para freelancers",
    subhead: "Cobrás en dólares (o cripto), en pesos, de varios clientes y nunca el mismo monto. Mangui ordena esa plata irregular y multimoneda.",
    retos: [
      { titulo: "Cobrás en dólares pero gastás en pesos", texto: "Registrás el ingreso en USD y lo convertís al dólar que usás (MEP, CCL o blue). Mangui guarda con qué dólar lo pasaste, así el número es real." },
      { titulo: "Ingresos que cambian todos los meses", texto: "Seguís mes a mes cuánto entró de verdad y comparás períodos en términos reales (ajustado por inflación), no solo el número nominal." },
      { titulo: "Mezclás la plata del laburo con la personal", texto: "Separás por cuentas y categorías, y mirás tu patrimonio consolidado en ARS + USD de un vistazo." },
    ],
    features: [
      { emoji: "💵", titulo: "3 dólares nativos", texto: "Blue, MEP y CCL. Convertí cada cobro al tipo que corresponde." },
      { emoji: "🎯", titulo: "Metas en dólares", texto: "Apartá un porcentaje de cada cobro para ahorrar en USD." },
      { emoji: "📊", titulo: "Patrimonio consolidado", texto: "Pesos y dólares sumados con el dólar que elijas." },
      { emoji: "🤖", titulo: "Manguito (IA)", texto: "Cargá un cobro hablándole o con una foto del comprobante." },
    ],
    faq: [
      { q: "¿Sirve si cobro del exterior en dólares?", a: "Sí. Registrás el ingreso en USD y Mangui lo convierte al dólar que uses (MEP, CCL o blue), guardando la cotización del día." },
      { q: "¿Puedo ahorrar en dólares lo que me sobra?", a: "Sí, con metas de ahorro en USD y cuentas en dólares para separar tu ahorro." },
    ],
  },
  {
    slug: "monotributistas",
    name: "Monotributistas",
    title: "Mangui para monotributistas: ingresos variables y el monotributo, ordenados",
    description: "Ingresos que suben y bajan, el monotributo todos los meses y la plata del laburo mezclada con la tuya. Mangui te ordena con recurrentes, metas y multimoneda.",
    headline: "Mangui para monotributistas",
    subhead: "Ingresos que suben y bajan, el monotributo todos los meses, y la plata del laburo mezclada con la tuya. Mangui te ordena.",
    retos: [
      { titulo: "Guardar para el monotributo y los impuestos", texto: "Armás una meta o un presupuesto y apartás todos los meses lo del monotributo y lo que venga de Ganancias." },
      { titulo: "Ingresos irregulares", texto: "Seguís cuánto facturaste y cuánto gastaste por mes, y comparás períodos en términos reales." },
      { titulo: "El monotributo es fijo y mensual", texto: "Lo cargás como recurrente y Mangui te lo recuerda antes de que venza." },
    ],
    features: [
      { emoji: "🔁", titulo: "Recurrentes", texto: "El monotributo, el alquiler, los servicios — cargados una vez y listos, con recordatorio." },
      { emoji: "🎯", titulo: "Metas", texto: "Apartá para impuestos o para el aguinaldo que no tenés." },
      { emoji: "💵", titulo: "Multimoneda", texto: "Si un cliente te paga en dólares, lo registrás y convertís." },
      { emoji: "📈", titulo: "Estadísticas reales", texto: "Compará meses ajustando por inflación, no solo el nominal." },
    ],
    faq: [
      { q: "¿Me ayuda a separar la plata del laburo de la personal?", a: "Sí, con cuentas y categorías separadas podés ver cada cosa por su lado." },
      { q: "¿Me avisa del vencimiento del monotributo?", a: "Sí: lo cargás como movimiento recurrente y te llega el recordatorio antes del vencimiento." },
    ],
  },
]

export function getAudience(slug: string): Audience | undefined {
  return AUDIENCES.find((a) => a.slug === slug)
}
