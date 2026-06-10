# PLAN ESTRATÉGICO — Mangui

> **Objetivo:** convertir a Mangui (mangui.com.ar) en la app de finanzas personales más completa de Argentina, y eventualmente del mundo.
> **Base:** análisis directo del código de este repositorio (junio 2026) + investigación competitiva con fuentes actuales.
> **Cómo leerlo:** las Fases 1–3 son diagnóstico (qué hay, contra quién jugamos, dónde estamos parados). La Fase 4 es el plan accionable.

---

## Índice

1. [Fase 1 — Inventario real del código](#fase-1--inventario-real-del-código)
   - [1.1 Stack y arquitectura](#11-stack-y-arquitectura)
   - [1.2 Modelo de datos](#12-modelo-de-datos)
   - [1.3 Funcionalidades implementadas](#13-funcionalidades-implementadas)
   - [1.4 IA — Manguito](#14-ia--manguito)
   - [1.5 Multimoneda y cotizaciones](#15-multimoneda-y-cotizaciones)
   - [1.6 Estado de calidad](#16-estado-de-calidad)
2. [Fase 2 — Análisis competitivo](#fase-2--análisis-competitivo)
3. [Fase 3 — Diagnóstico de Mangui](#fase-3--diagnóstico-de-mangui)
4. [Fase 4 — Plan para ser la más completa](#fase-4--plan-para-ser-la-más-completa)
   - [4.1 Funcionalidades nuevas por impacto](#41-funcionalidades-nuevas-ordenadas-por-impacto)
   - [4.2 Hoja de ruta por fases](#42-hoja-de-ruta-por-fases)
   - [4.3 Riesgos y mitigaciones](#43-riesgos-principales-y-mitigaciones)
   - [4.4 Métricas para saber si vamos ganando](#44-métricas--señales-de-que-vamos-ganando)

---

# FASE 1 — Inventario real del código

## 1.1 Stack y arquitectura

| Capa | Tecnología | Evidencia |
|---|---|---|
| Framework | Next.js 16.2.6 + React 19.2.4, App Router, TypeScript | `package.json` |
| UI | Tailwind 4, shadcn/ui (estilo base-nova), Radix, Motion, Recharts + evilcharts | `components.json`, `package.json` |
| Estado/datos | TanStack Query 5 con persistencia en localStorage (24 h, modo `offlineFirst`) | `src/components/providers.tsx:13-22` |
| Formularios | react-hook-form + Zod | `package.json` |
| Backend | Supabase (Postgres + Auth + Storage), sin servidor propio | `src/lib/supabase/*` |
| Auth | Supabase Auth con Google OAuth, sesión refrescada en proxy/middleware | `src/proxy.ts`, `src/lib/supabase/middleware.ts` |
| IA | Vercel AI SDK 6 + `gemini-2.5-flash` | `src/app/api/ai/chat/route.ts:25` |
| Pagos | MercadoPago (suscripción Premium, webhook firmado) | `src/app/api/webhooks/mercadopago/route.ts` |
| Email | Resend + React Email | `src/lib/email.ts`, `src/emails/` |
| Push | Web Push (VAPID) con service worker propio | `public/sw.js`, `src/lib/push.ts` |
| Hosting | Vercel, 4 cron jobs diarios (cotizaciones, recurrentes, futuros, notificaciones) | `vercel.json` |

**PWA / offline — la verdad técnica:** la app es instalable (`public/manifest.json`) y el service worker maneja push, pero **no cachea assets** (passthrough deliberado, `public/sw.js:79-84`). El "offline" real es la persistencia de React Query: podés **ver** datos de las últimas 24 h sin conexión, pero **no podés cargar nada offline** — no existe cola de sincronización de escrituras. La página `/offline` y el banner (`src/components/offline-banner.tsx`) comunican esto honestamente, pero el marketing dice "PWA instalable y offline" y la mitad de esa promesa (escritura) no existe.

## 1.2 Modelo de datos

23 tablas + 2 vistas en 35 migraciones (`supabase/migrations/`). Lo importante:

- **Dinero en `numeric(18,2)`** — sin floats en la base. ✓
- **`accounts`**: 7 tipos (caja de ahorro, cuenta corriente, efectivo, inversión, tarjeta de crédito, billetera virtual, otro), moneda ARS/USD, `closing_day`/`due_day` para tarjetas. El balance **no se almacena**: se deriva en las vistas `account_balances` y `account_balances_projected` (migración 0007).
- **`movements`**: tabla central. `original_currency` + `converted_amount` + `dollar_type` (oficial/blue/mep/ccl/tarjeta) — cada movimiento multimoneda registra con qué dólar se convirtió. `is_future` para movimientos programados.
- **Cuotas**: `installment_purchases` agrupa N movements con `installment_number/installment_total`. La última cuota absorbe el redondeo (`src/lib/installments.ts:16-23`).
- **Ciclo de resumen**: `card_statements` con `close_date`/`due_date`, **impuesto de sellos** (`stamp_tax`), estado pendiente/pagado, y desde la migración 0030 **resumen bimonetario** (totales y pagos ARS + USD con cuentas de origen separadas). Esto no lo tiene nadie en el mercado (ver Fase 2).
- **Recurrentes**: patrón template → occurrences → confirmación del usuario (`recurring_transactions` + `recurring_occurrences`), con manejo de fines de semana y frecuencia custom. Cron diario las materializa.
- **Reglas**: `auto_rules` + `auto_rule_conditions` con prioridades, AND/OR, operadores de texto y monto.
- **Presupuestos y metas**: `budgets` con scope por arrays de categorías/cuentas; `goals` v2 (migración 0027) con tipos saving/reduction/income, períodos, recurrencia y snapshots de progreso.
- **Adjuntos**: `movement_attachments` (factura/recibo/comprobante/resumen) en bucket privado con políticas por carpeta de usuario.
- **RLS completo en las 23 tablas** — sin huecos detectados. Demo account de solo lectura vía políticas RESTRICTIVE (0032). Campos de billing protegidos por trigger `SECURITY DEFINER` (0034). Es un esquema de seguridad de datos serio.

**Lo que NO existe en el esquema:** nada de multiusuario/compartir (sin tablas de colaboradores, grupos, permisos), sin histórico de inflación/IPC, sin tabla de insights de IA, sin audit trail de cambios.

## 1.3 Funcionalidades implementadas

**Completas (UI → server → DB verificado):** cuentas, movimientos (con búsqueda, filtros, agrupación, vistas guardadas, borrado masivo, adjuntos), transferencias multimoneda, tarjetas con cuotas y resúmenes pagables, presupuestos, metas con sugerencias heurísticas, recurrentes con inbox de confirmación, reglas de auto-categorización con sugerencias, categorías, dashboard (balances consolidados, Sankey, torta, barras), estadísticas (7 pestañas, comparación de períodos, patrones por día de semana), Manguito (chat con 8 tools), push notifications con recordatorios de tarjeta, export CSV (Premium), demo read-only, suscripción Premium vía MercadoPago, onboarding de categorías default.

**A medias:**
- Feriados argentinos en recurrentes: solo los de fecha fija; los móviles requieren mantenimiento manual anual (`src/lib/recurring.ts:27-47`).
- Free tier muy restrictivo: 1 cuenta, 1 presupuesto, 1 meta, 3 recurrentes, 0 reglas, 0 adjuntos, 10 mensajes IA/día (`src/lib/plans.ts`).

**Prometidas pero inexistentes (vaporware):**
- **Voz en Manguito** — el mockup de la landing lo muestra; el chat es solo texto (`src/components/ai/ai-chat.tsx`).
- **Parejas/compartido** — mencionado en marketing; cero soporte en esquema y código.
- **Subir avatar** — TODO en `src/app/(app)/ajustes/page.tsx:223`.
- **Eliminar cuenta** — botón deshabilitado "disponible próximamente" (`ajustes/page.tsx:583-605`). Esto es un riesgo legal (derecho de supresión, Ley 25.326).

## 1.4 IA — Manguito

- **Modelo:** `gemini-2.5-flash` hardcodeado, API key del servidor (`GOOGLE_GENERATIVE_AI_API_KEY`). Hay restos de la era BYOK (`user_ai_settings` con key cifrada AES-256-GCM, migración 0016) que ya no son el camino principal.
- **Tools (8):** 7 de lectura (`obtener_saldos`, `estadisticas_gastos`, `buscar_movimientos`, `pagos_futuros`, `resumenes_tarjeta`, `estado_presupuestos`, `estado_metas`) + `crear_movimiento` como tool de cliente: el modelo propone un borrador y **el usuario confirma en un form** — human-in-the-loop correcto (`src/app/api/ai/chat/route.ts:278-312`, `src/lib/ai/tools.ts`).
- **Límites:** 10 mensajes/día free, ilimitado Premium, registrado en `ai_usage` (chequeo con admin client, 429 al exceder).
- **Lo que NO puede hacer hoy:** visión/OCR (los adjuntos se guardan pero la IA no los lee), audio/voz, insights proactivos (ningún cron invoca IA), memoria entre sesiones, más de 6 tool calls por mensaje (`stepCountIs(6)`), fallback de modelo si Gemini cae.

**Dato clave para el plan:** `gemini-2.5-flash` ya es multimodal (imagen, audio, PDF). La infraestructura para OCR de tickets y entrada por voz **ya está pagada y conectada** — falta solo el cableado de UI y prompt.

## 1.5 Multimoneda y cotizaciones

- **Fuente:** dolarapi.com (oficial, blue, MEP, CCL) — `src/lib/rates/dolar.ts:34-57`.
- **Actualización:** cron diario a las 11 UTC (8 AM Argentina) que hace upsert en `exchange_rates` (`vercel.json`, `src/app/api/cron/refresh-rates/route.ts`). Una sola corrida al día para un dólar que se mueve intradía.
- **⚠️ El histórico se perdió:** la migración 0009 agregó `UNIQUE(rate_type)` y convirtió la tabla en **snapshot** — el upsert pisa la fila anterior. El comentario de la migración 0005 prometía histórico "para reportes de inflación (fase futura)"; hoy no se puede valuar un movimiento pasado al dólar de su fecha.
- **⚠️ Fallback silencioso a 1:1:** si no hay cotización, `convert()` usa tasa 1 (`src/lib/rates/dolar.ts:93-98`). Un fallo de DolarAPI haría que un balance USD se sume a la par del peso, sin error visible. En una app financiera esto es inaceptable.
- **Preferencia de usuario:** `user_preferences.rate_type` (default blue) + tasa manual opcional. Consolidación de patrimonio en `balance-cards.tsx` usando la tasa preferida; excluye tarjetas de crédito (pasivo). Correcto.
- **Inflación:** **cero implementación**. Sin IPC, sin UVA, sin ajustes reales. El único rastro es el comentario de la migración 0005.

## 1.6 Estado de calidad

| Área | Estado | Evidencia |
|---|---|---|
| **Tests** | **Cero.** Ni unit, ni e2e, ni runner configurado. La matemática de cuotas, conversiones y presupuestos no tiene una sola prueba. | `package.json:5-10` (solo dev/build/start/lint) |
| **Observabilidad** | Solo `console.error`. Sin Sentry ni equivalente. Si producción falla, no te enterás. | grep global |
| **Seguridad** | RLS sólido, webhook MP firmado, cron con secret. Pero: secret de cron aceptado **por query param** (`refresh-rates/route.ts:18-24`, puede filtrarse en logs), sin security headers (CSP, X-Frame-Options) en `next.config.ts`, sin rate limiting fuera de IA, validación de body mínima en `/api/ai/chat`. |
| **Fechas/TZ** | El servidor usa `America/Argentina/Buenos_Aires` correctamente; los forms del cliente usan `new Date().toISOString()` con hora del sistema del usuario (`movement-form.tsx`) — movimientos cargados entre 21:00 y 00:00 hora argentina pueden caer en el día equivocado. |
| **Performance** | `installment-detail.tsx` hace 8 `select("*")` sin paginación; `movements-list.tsx` (1.964 líneas) trae hasta 200 movimientos sin virtualización pese a tener `react-window` instalado; el cron de notificaciones hace loops por usuario (N+1). Funciona hoy, no escala a miles de usuarios activos. |
| **Deuda** | 5 componentes de más de 1.100 líneas (movements-list, goals-list, installment-detail, budgets-list, cards-list); `getTodayAR()` duplicada en 3 archivos; validación inconsistente (Zod en algunos forms, `isNaN` a mano en otros). |
| **a11y / i18n** | ~210 atributos ARIA en todo el código (escaso); español hardcodeado en todos lados, sin framework i18n — "del mundo" hoy requiere refactor completo de strings. |

**Veredicto honesto:** el dominio financiero está muy bien modelado — mejor que el de la mayoría de los competidores. Pero es un MVP sin red de seguridad: cero tests sobre matemática de plata, cero observabilidad, y un fallback de conversión que puede mostrar balances falsos en silencio. La fundación de producto es sólida; la fundación de ingeniería, no.

---

# FASE 2 — Análisis competitivo

## 2.1 gasti.pro — el competidor a vencer

**Propuesta de valor:** "tu sistema nervioso financiero en WhatsApp" — le escribís al bot como a un amigo y la IA registra todo.

**Funcionalidades clave:**
- Bot en **WhatsApp y Telegram**: texto, **audio (transcripción)** e **imágenes (OCR de tickets)**; Premium agrega **procesamiento de PDF** (resúmenes de tarjeta).
- Auto-categorización ("compré un café por 800" → categoría, moneda, fecha solos).
- Multimoneda genérica, presupuestos por categoría, recurrentes, reglas de automatización.
- **Gastos compartidos/grupales** con invitaciones y seguimiento de pagos.
- **Integración Wallbit** (banco US para freelancers argentinos): importación de extractos.
- Dashboard web secundario + roadmap público votado por usuarios.
- **Gasti Business** en waitlist (finanzas de equipos, reporting, integración contable).
- **Juego SEO agresivo:** 12+ calculadoras (50/30/20, presupuesto familiar, salida de deuda, ahorro vs inflación, 8 de metas de ahorro), serie "cuánto gasta un argentino en X", páginas "Gasti vs Fintonic/Mobills/Splitwise/MonAi/Mujer Financiera", páginas por audiencia (monotributistas, freelancers, parejas).

**Monetización:** Free (10 gastos por WhatsApp/mes, 1 cuenta, 1 presupuesto) / Pro **USD 6,99/mes** / Premium **USD 9,99/mes** / lifetime USD 250–350. Cobra por Stripe en dólares.

**Su ventaja sobre Mangui:** fricción de captura cercana a cero — WhatsApp ya está abierto en todos los teléfonos, y mandar un audio o una foto del ticket le gana a cualquier formulario web.

**Sus debilidades:** el gancho (WhatsApp) está casi todo paywalleado en free; precio dolarizado (≈ ARS 10.000–14.500/mes al blue) caro para Argentina; sin inteligencia de cuotas ni ciclo de resumen; y un **riesgo estructural enorme: Meta restringe los chatbots genéricos de IA en WhatsApp desde enero 2026** — toda su superficie de producto depende de la política de Meta.

## 2.2 Otros competidores relevantes

| Competidor | Propuesta de valor | Claves | Monetización | Ventaja sobre Mangui | Debilidad |
|---|---|---|---|---|---|
| **Mercado Pago (Tus gastos + Asistente Personal)** | la billetera que ya usás te categoriza y responde con IA, gratis | categorización automática de todo lo pagado por MP; asistente IA por voz/texto (ene-2026, 100+ funciones: "¿cuánto gasté en delivery?", pagar facturas desde una foto) | gratis (monetiza pagos/crédito) | cero carga manual + distribución masiva | solo ve el ecosistema MP: ni efectivo, ni otras tarjetas, ni 3 dólares, ni cuotas cross-banco, ni metas |
| **Mujer Financiera** | comunidad + educación financiera para mujeres (300k+ usuarias) | tracker manual, presupuestos, reportes, cursos | Premium **ARS 17.999/mes** o 132.000/año | marca, comunidad y distribución local | cara para ser un tracker manual; sin IA, sin OCR, sin multimoneda argentina |
| **MonAi** | "registrá con la voz, la IA hace el resto" | entrada por voz con parsing IA, captura de Apple Pay, listas compartidas, sync iCloud | free 20 transacciones/mes; premium muy barato | pulido nativo + UX de voz + viralidad TikTok | iOS-first (Apple es minoría en AR), cero especificidad argentina (sin blue/MEP, sin cuotas) |
| **Splitwise** | el estándar para dividir gastos | grupos, balances, settle-up, multimoneda | **se volvió pago en 2026**: free limitado a ~3 gastos/día; Pro USD 4,99/mes | efecto red — sigue siendo "el nombre" para dividir | el paywall rompió el producto free → ola migratoria sin destino argentino; no es una app de presupuesto |
| **Monefy / Mobills / Toshl** (trackers legacy) | trackers manuales simples/completos | Monefy: simplicidad; Mobills: tarjetas + presupuestos; Toshl: mejor motor multimoneda | €2,99/mes; R$99,90/año; USD 4,99/mes | años de pulido móvil nativo | diseñadas para monedas estables: sin inflación, sin 3 dólares, sin cuotas, sin IA, bank sync inútil en AR |
| **Watchlist: Tecabot.ai, Chanchito** | clones de gasti (bot WhatsApp) | registro por chat con IA | s/d | mismas que gasti | mismas que gasti + menor tracción; Chanchito con señales de inestabilidad (503) |

*(Fintonic quedó descartado: su bank sync es solo de bancos españoles; no es un competidor real en Argentina.)*

## 2.3 Tabla comparativa de funcionalidades

✅ = lo tiene · 🟡 = parcial/limitado · ❌ = no lo tiene

| Funcionalidad | **Mangui** | gasti.pro | Mercado Pago | Mujer Financiera | MonAi | Splitwise | Monefy/Mobills/Toshl |
|---|---|---|---|---|---|---|---|
| Registro manual completo (ingresos/gastos/transferencias) | ✅ | ✅ | ❌ (solo MP) | ✅ | ✅ | ❌ | ✅ |
| Multimoneda ARS/USD | ✅ | ✅ genérica | ❌ | ❌ | ❌ | 🟡 montos | 🟡 premium |
| **3 dólares (blue/MEP/CCL) nativos** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cuotas con ciclo de resumen (cierre/vencimiento, sellos)** | ✅ | ❌ | 🟡 solo tarjeta MP | ❌ | ❌ | ❌ | 🟡 Mobills básico |
| Resumen de tarjeta bimonetario (ARS+USD) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Presupuestos | ✅ | ✅ | 🟡 | ✅ | ✅ | ❌ | ✅ |
| Metas | ✅ | 🟡 calculadoras | ❌ | 🟡 | ❌ | ❌ | 🟡 |
| Recurrentes con confirmación | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Reglas de auto-categorización | ✅ | ✅ | ✅ automática | ❌ | ✅ IA | ❌ | 🟡 |
| IA conversacional sobre TUS datos | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Carga por lenguaje natural | ✅ texto | ✅ | ✅ | ❌ | ✅ voz | ❌ | ❌ |
| **Entrada por voz** | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **OCR de tickets** | ❌ | ✅ (Pro) | 🟡 facturas | ❌ | ❌ | ❌ | 🟡 Toshl foto |
| **Importación de extractos/resúmenes** | ❌ | ✅ (PDF Premium, Wallbit) | n/a | ❌ | ❌ | ❌ | 🟡 CSV |
| **Gastos compartidos/grupos/pareja** | ❌ | ✅ | ❌ | ❌ | ✅ listas | ✅ | ❌ |
| Insights proactivos / alertas inteligentes | ❌ | 🟡 | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ajuste por inflación / IPC | ❌ | 🟡 calculadora estática | ❌ | ❌ | ❌ | ❌ | ❌ |
| Push notifications (vencimientos) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| PWA instalable / web completa | ✅ | 🟡 dashboard secundario | ❌ app | 🟡 | ❌ | ✅ | 🟡 |
| Export CSV | ✅ (Premium) | ✅ | ❌ | 🟡 reportes | ❌ | 🟡 Pro | ✅ |
| SEO: calculadoras y contenido | ❌ | ✅✅ | n/a | ✅ educación | ❌ | ❌ | ❌ |
| Precio en ARS (sin dolarizar) | ✅ (MercadoPago) | ❌ USD | gratis | ✅ | 🟡 | ❌ USD | ❌ |
| Inmune al riesgo de bots de Meta | ✅ | ❌❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Lectura de la tabla:** Mangui ya gana en *profundidad financiera argentina* (filas 3–5: nadie más las tiene) y pierde en *fricción de captura* (voz, OCR, import) y en *dimensión social* (compartidos). Esos dos ejes definen el plan.

---

# FASE 3 — Diagnóstico de Mangui

## 3.1 Fortalezas (con evidencia)

1. **El mejor modelo de datos financiero argentino del mercado.** `card_statements` con cierre/vencimiento/sellos/bimonetario + `installment_purchases` + `dollar_type` por movimiento (migraciones 0010, 0030, 0004) modelan la realidad de la plata argentina como ningún competidor. Esto es años-luz de "multi-currency genérico".
2. **Seguridad de datos seria.** RLS en las 23 tablas sin huecos, demo read-only por políticas RESTRICTIVE, billing protegido por trigger SECURITY DEFINER, storage con aislamiento por carpeta de usuario. Para una app financiera, es la base correcta.
3. **IA con human-in-the-loop bien diseñada.** `crear_movimiento` propone borrador y el usuario confirma — ni alucina escrituras ni guarda sin permiso (`route.ts:278-312`). Las 7 tools de lectura le dan contexto real. Mejor patrón que el de gasti (que escribe directo).
4. **Recurrentes con confirmación** (template → occurrence → confirmar/saltar): más control que la materialización automática de cualquier competidor.
5. **Monetización ya integrada y en pesos.** MercadoPago con webhook firmado e idempotente — cobrar en ARS es ventaja competitiva directa contra gasti/Splitwise/Toshl dolarizados.
6. **Demo account sembrada** — el "probá sin registrarte" es un activo de conversión que casi nadie tiene.
7. **Estadísticas profundas** (7 pestañas, comparación de períodos, Sankey, patrones por día) — por encima de la media de la categoría.

## 3.2 Debilidades (sin anestesia)

1. **La captura es el cuello de botella y es el corazón del producto.** Toda carga pasa por un form web o por chatear texto con Manguito. Sin voz, sin foto, sin import. Una app de finanzas vive o muere por la fricción de registrar — y acá gasti, MonAi y Mercado Pago te están matando. La voz además **está prometida en tu propia landing** y no existe.
2. **Cero tests sobre matemática de plata.** `installments.ts`, conversiones, presupuestos — nada probado (`package.json`). Cada feature nueva arriesga romper saldos en producción sin que te enteres (tampoco hay Sentry).
3. **Tiraste el histórico de cotizaciones** (migración 0009 → snapshot único por tipo). Sin histórico no hay valuación de movimientos pasados al dólar del día, ni gráficos de patrimonio en USD, ni base para inflación. Auto-sabotaje del diferenciador.
4. **Fallback de conversión 1:1 silencioso** (`dolar.ts:93-98`). Si DolarAPI falla, los balances mienten sin avisar. Bug de confianza, no de UX.
5. **Sin dimensión social.** Cero soporte de parejas/compartidos en esquema y código, mientras Splitwise se vuelve pago (ola migratoria) y gasti ya tiene grupos. El marketing de Mangui menciona parejas: promesa rota.
6. **Sin inflación** pese a ser EL problema financiero argentino y estar prometido desde la migración 0005. Gasti tiene al menos una calculadora; vos nada.
7. **Free tier asfixiante** (1 cuenta, 1 presupuesto, 1 meta, 0 reglas, 0 adjuntos — `src/lib/plans.ts`). Una sola cuenta hace imposible siquiera probar el diferenciador multimoneda (necesitás ≥2 cuentas para una transferencia ARS→USD). El free actual no deja experimentar el valor por el que pagarías.
8. **Cero SEO/contenido.** La landing es la única superficie pública. Gasti tiene 12+ calculadoras y páginas comparativas rankeando; cada búsqueda "app para controlar gastos argentina" que él gana es un usuario que no te conoce.
9. **Deuda de escala:** componentes de 1.300–1.900 líneas, `select("*")` sin paginación, N+1 en el cron de notificaciones, fechas del cliente sin TZ argentina. Nada de esto duele con 100 usuarios; todo duele con 10.000.
10. **Eliminar cuenta no funciona** (botón deshabilitado) — incumplimiento potencial de la Ley 25.326 de protección de datos personales.

## 3.3 Diferenciadores — qué tenés que otros no (defender y potenciar)

| Diferenciador | Estado | Qué hacer |
|---|---|---|
| **Cuotas + ciclo de resumen + sellos + bimonetario** | Único en el mercado (verificado vs 8 competidores) | Potenciar: convertirlo en el centro del marketing ("¿cuánto te viene el resumen?") y en feature IA ("pagos futuros" ya existe como tool) |
| **3 dólares nativos** (blue/MEP/CCL por movimiento, preferencia por usuario) | Único | Defender: restaurar histórico de cotizaciones para valuar el pasado; es la base de "patrimonio real" |
| **IA hosteada gratis con confirmación humana** | gasti la paywallea fuerte; MP no ve fuera de su ecosistema | Potenciar: hacerla multimodal (la infra Gemini ya lo permite) |
| **No-bots = inmune al riesgo Meta 2026** | Decisión ya tomada (no bots), hoy validada por la restricción de Meta a chatbots genéricos en WhatsApp | Comunicarla como fortaleza: "tus finanzas no dependen de la política de Meta" — pero exige igualar la captura dentro de la PWA |
| **Precio en pesos vía MercadoPago** | gasti/Splitwise/Toshl dolarizados | Mantener y comunicar en pricing comparativo |
| **Web/PWA completa multiplataforma** | MonAi es iOS-first, gasti es bot-first | Defender con PWA de verdad (offline write, share target) |

## 3.4 Qué podés hacer mejor (existe, pero un competidor lo hace mejor)

| Área | Quién lo hace mejor | Propuesta concreta |
|---|---|---|
| Carga por lenguaje natural | gasti (audio+foto), MonAi (voz) | Manguito multimodal: botón de micrófono (audio → Gemini) y cámara/adjunto (imagen → Gemini) en el chat y en el quick-add. Gemini 2.5 Flash ya acepta audio e imagen; es cableado, no investigación. |
| Insights | Mercado Pago (asistente proactivo) | Cron semanal que invoca las tools existentes (`estadisticas_gastos`, `estado_presupuestos`, `pagos_futuros`) y manda push/email con 2–3 insights. La infra de push y cron **ya existe** (`vercel.json`, `src/lib/push.ts`). |
| Free tier | gasti (app ilimitada free), MonAi | Liberar lo que crea hábito (cuentas 3+, movimientos ilimitados ya lo son) y cobrar lo que da poder (IA ilimitada, reglas, adjuntos, compartidos, export). Hoy el free no permite ni probar el multimoneda. |
| Recordatorios | apps nativas | Ya tenés push de vencimientos; agregar resumen semanal y alertas de presupuesto al 80 % (la data ya se calcula en `budgets.ts`). |
| Offline | apps nativas | Cola de escrituras offline (mutations en IndexedDB + replay al reconectar). React Query ya está en modo offlineFirst; falta la mitad de escritura. |

---

# FASE 4 — Plan para ser la más completa

## 4.1 Funcionalidades nuevas, ordenadas por impacto

> Criterio de orden: (1) qué reduce más la fricción de captura —el gap que define la categoría—, (2) qué apalanca lo que ya está construido, (3) qué defiende los diferenciadores.

### P1 — Captura multimodal en la PWA: voz + foto de ticket (OCR)
- **Qué resuelve:** la razón #1 por la que un argentino elige gasti o MonAi. Cargar un gasto debe tomar 5 segundos: apretar el micrófono y decir "2.500 en la panadería", o sacarle foto al ticket.
- **Por qué acerca a "la más completa":** elimina la única ventaja real de gasti sin asumir su riesgo Meta. Combina con el human-in-the-loop existente (la IA propone, el usuario confirma).
- **Base técnica:** **ya existe en un 70 %.** Gemini 2.5 Flash es multimodal; el AI SDK 6 soporta partes de imagen/audio; `crear_movimiento` ya está; `movement_attachments` ya guarda imágenes. Falta: UI de micrófono (MediaRecorder), input de imagen en el chat/quick-add, y extender el prompt/route para partes multimodales (`src/app/api/ai/chat/route.ts`).
- **Esfuerzo:** **Medio-bajo.** | **Prioridad: 1.**

### P2 — Fundaciones de confianza (tests de plata + observabilidad + fix de conversión)
- **Qué resuelve:** que el crecimiento no destruya la confianza. Incluye: (a) suite de tests sobre `installments.ts`, conversiones, ventanas de presupuesto y ciclo de resumen; (b) Sentry o similar; (c) **eliminar el fallback 1:1** — si no hay cotización, mostrar error explícito; (d) headers de seguridad y secret de cron solo por header; (e) fechas del cliente en TZ argentina.
- **Por qué:** "la más completa" que muestra saldos equivocados muere. Esto no suma features pero multiplica la velocidad segura de todo lo demás.
- **Base técnica:** todo es trabajo sobre código existente. **Esfuerzo: Medio.** | **Prioridad: 1 (en paralelo con P1).**

### P3 — Restaurar histórico de cotizaciones + inflación (IPC)
- **Qué resuelve:** "¿cuánto vale mi plata de verdad?" — la pregunta argentina. Histórico de dólar (revertir el snapshot de 0009 a append con fila por día) + tabla `inflation_index` con IPC de INDEC (API datos.gob.ar) + cron mensual.
- **Features que habilita:** comparaciones mes a mes en términos reales ("gastaste 5 % menos ajustado por inflación"), presupuestos auto-ajustables por IPC, evolución de patrimonio en USD blue histórico, "tu sueldo de enero vale X de hoy".
- **Por qué:** es el diferenciador que **nadie** tiene (verificado en Fase 2) y la migración 0005 ya lo anticipaba. Convierte a Mangui de tracker a "lente de realidad financiera argentina".
- **Base técnica:** cron y tabla de rates existen; las estadísticas ya comparan períodos (`src/components/stats/`). Trabajo nuevo: tabla IPC, lógica de ajuste, UI de toggle "nominal/real". **Esfuerzo: Medio.** | **Prioridad: 2.**

### P4 — Importación de extractos y resúmenes (CSV + PDF)
- **Qué resuelve:** el usuario que llega con historia (o que no quiere cargar a mano el mes pasado). Subís el CSV de Mercado Pago / el PDF del resumen de tarjeta, Gemini lo parsea, dedup + preview, confirmás e importás. Mapeo guardado por banco.
- **Por qué:** gasti lo cobra en Premium; en Argentina sin open banking, **el import ES el bank sync**. Además alimenta el diferenciador de tarjetas: importar el resumen y reconciliarlo contra `card_statements` es una jugada única.
- **Base técnica:** adjuntos y bucket listos (`attachments.ts`, kind `resumen` ya existe en el enum); Gemini parsea PDF nativamente; falta pipeline de preview/dedup/insert masivo. **Esfuerzo: Medio-alto.** | **Prioridad: 2.**

### P5 — Insights proactivos de Manguito (push + email semanal)
- **Qué resuelve:** retención. Hoy la IA es 100 % reactiva; el usuario tiene que acordarse de entrar. Un cron semanal que genere 2–3 insights reales ("tu resumen de Visa cierra el jueves y va $480.000, 30 % más que el anterior"; "Delivery ya consumió 85 % del presupuesto") y los empuje por push/email.
- **Por qué:** Mercado Pago ya educó al mercado en "la app te avisa"; es la feature que convierte un tracker en un asesor.
- **Base técnica:** **alta reutilización**: las 7 tools de lectura, web-push, Resend y el patrón de cron + `notification_log` (dedup) ya existen. Falta el cron orquestador y plantillas. **Esfuerzo: Medio-bajo.** | **Prioridad: 2.**

### P6 — Gastos compartidos / modo pareja
- **Qué resuelve:** las finanzas argentinas son de a dos (alquiler, supermercado, vacaciones). Splitwise se volvió pago en 2026 y dejó una ola migratoria sin destino local; gasti ya tiene grupos; tu landing menciona parejas sin que exista.
- **Alcance sugerido (v1):** espacios compartidos simples — invitar por link, gastos asignables a un espacio, balance "quién le debe a quién", settle-up que genera una transferencia. NO replicar toda la complejidad de Splitwise.
- **Base técnica:** **trabajo nuevo grande**: todo el modelo es single-user (RLS por `auth.uid()` en 23 tablas). Requiere tablas de espacios/miembros, políticas RLS por membresía y UI nueva. Es la inversión más cara del plan, y la de mayor potencial viral (cada pareja invita a otra persona).
- **Esfuerzo: Alto.** | **Prioridad: 3 (después de captura e inteligencia, antes que nada de "empresas").**

### P7 — SEO: calculadoras y contenido argentino
- **Qué resuelve:** adquisición gratuita y permanente. Gasti construyó un funnel entero con calculadoras; vos tenés cero superficie indexable más allá de la landing.
- **Jugadas concretas (en orden):** (1) **calculadora de cuotas vs contado con inflación** — única en el mercado y conecta directo con tu diferenciador; (2) calculadora "tu sueldo ajustado por inflación"; (3) conversor blue/MEP/CCL con histórico (reusa P3); (4) regla 50/30/20 argentinizada; (5) comparativas "Mangui vs gasti / vs Splitwise / vs Excel"; (6) páginas por audiencia (parejas, monotributistas, freelancers).
- **Base técnica:** el route group `(marketing)` ya existe; las calculadoras son páginas estáticas + un poco de cliente. **Esfuerzo: Bajo (por pieza), sostenido.** | **Prioridad: 2 (arrancar ya, es barato y compone con el tiempo).**

### P8 — PWA de verdad: cola de escritura offline + Web Share Target
- **Qué resuelve:** (a) cargar gastos sin señal (subte, interior) — hoy solo se puede leer; (b) **Share Target**: compartir desde cualquier app (captura del home banking, comprobante de MP) directo a Mangui → Gemini lo parsea → borrador listo. Es tu respuesta estructural a "lo mando por WhatsApp": el ticket entra por el share sheet del teléfono.
- **Base técnica:** manifest y SW existen (`public/sw.js`); falta cola de mutations (IndexedDB + replay) y `share_target` en el manifest + ruta receptora. Sinergia total con P1/P4. **Esfuerzo: Medio.** | **Prioridad: 3.**
- **Honestidad:** además cierra la brecha entre lo que la landing promete ("offline") y lo que el código hace.

### P9 — Rediseño del free tier
- **Qué resuelve:** activación. Propuesta: free = 3 cuentas, presupuestos/metas 2–3, reglas 2, 10 IA/día (mantener), adjuntos 5/mes; Premium = ilimitado + IA ilimitada + import + compartidos avanzados + export + insights diarios. La lógica: lo gratis crea el hábito y muestra el diferenciador (multimoneda exige ≥2 cuentas); lo pago escala el poder.
- **Base técnica:** trivial — constantes en `src/lib/plans.ts`. **Esfuerzo: Bajo.** | **Prioridad: 1 (es un cambio de números con impacto inmediato en conversión de demo→registro).**

### P10 — Conexiones de inversión (fase posterior)
- Sin open banking argentino, el "bank sync" real no existe. Lo alcanzable: cotizaciones de FCI/plazo fijo/cripto para cuentas tipo `inversion` (ya existe el tipo en el enum), integraciones de export con brokers (IOL, Wallbit-style) cuando haya API. **Esfuerzo: Alto, valor incierto hoy.** | **Prioridad: 4.**

### Explícitamente descartado: bots de WhatsApp/Telegram
Decisión de producto ya tomada (no bots), y la evidencia de 2026 la valida: Meta restringió los chatbots genéricos de IA en WhatsApp desde enero 2026, lo que amenaza la base misma de gasti/Tecabot/Chanchito. La estrategia de Mangui es igualar la captura sin intermediario: voz + cámara + share target dentro de la PWA (P1, P8). Si Meta algún día abre una categoría estable para este uso, se reevalúa — desde una posición donde la captura propia ya funciona.

## 4.2 Hoja de ruta por fases

### Fase A — Cimientos + primera sangre (corto plazo)
*Tema: que la captura deje de ser la debilidad y que el código aguante lo que viene.*
- [ ] P2: tests de matemática financiera (cuotas, conversiones, presupuestos, ciclo de resumen) + Sentry + eliminar fallback 1:1 + headers de seguridad + secret de cron solo header + TZ en cliente
- [ ] P1: voz en Manguito (audio → Gemini → borrador confirmable)
- [ ] P1: foto de ticket (imagen → Gemini → borrador confirmable)
- [ ] P9: nuevo free tier
- [ ] P3 (parte 1): volver `exchange_rates` a histórico (fila por día) — hacerlo YA porque cada día que pasa es data que se pierde
- [ ] Honestidad de marketing: o se implementa voz/parejas o se saca de la landing; habilitar eliminación de cuenta (riesgo legal)
- [ ] P7 (arranque): 2 calculadoras (cuotas vs contado con inflación; conversor 3 dólares)

### Fase B — Inteligencia argentina (mediano plazo)
*Tema: convertir el diferenciador de datos en features que nadie puede copiar rápido.*
- [ ] P3 (parte 2): tabla IPC + estadísticas en términos reales + presupuestos ajustables por inflación
- [ ] P5: insights proactivos semanales (push + email) con las tools existentes
- [ ] P4: importación CSV (Mercado Pago, bancos principales) → luego PDF de resúmenes con reconciliación contra `card_statements`
- [ ] P7 (continuo): calculadoras restantes + páginas comparativas + contenido
- [ ] Deuda dirigida: paginar/virtualizar movimientos, partir los 5 componentes gigantes que se toquen en el camino

### Fase C — Dimensión social + PWA total (mediano-largo plazo)
*Tema: crecer por red y cerrar la brecha con apps nativas.*
- [ ] P6: espacios compartidos / modo pareja (v1 simple: invitar, dividir, saldar)
- [ ] P8: Web Share Target + cola de escritura offline
- [ ] Campaña "veníte de Splitwise" (importador de grupos + página SEO comparativa)

### Fase D — Expansión (largo plazo)
- [ ] P10: inversiones/cotizaciones de activos
- [ ] i18n (es → es-MX/en) si se valida ir más allá de Argentina — recién acá tiene sentido pagar el refactor de strings
- [ ] Tier para equipos/familias extendidas (la respuesta a "Gasti Business", solo si los espacios compartidos demuestran tracción)

**Dependencias clave:** P3-parte-1 no tiene dependencias y pierde valor cada día que se demora → primero. P5 depende de que P2 dé confianza (un insight con números mal calculados es peor que ninguno). P6 conviene después de P1/P5 porque cada usuario invitado debe caer en un producto que ya enganche. P8-share-target apalanca el parser de P1/P4.

## 4.3 Riesgos principales y mitigaciones

| Riesgo | Probabilidad/Impacto | Mitigación |
|---|---|---|
| **Mercado Pago regala IA financiera a todo el país** (Asistente Personal, ene-2026) y normaliza "esto es gratis" | Alta / Alto | No competir en su cancha (ecosistema MP): Mangui es la vista *completa* — efectivo, todas las tarjetas, 3 dólares, cuotas cross-banco. El posicionamiento es "MP te muestra lo que pasó en MP; Mangui te muestra tu vida financiera entera". |
| **Costo de la IA hosteada** crece con usuarios free (10 msj/día × N usuarios, y multimodal sube tokens) | Media / Alto | Ya hay quota por usuario (`ai_usage`); agregar presupuesto mensual global con alarma, cachear respuestas de tools, considerar Gemini Flash-Lite para parsing simple. El modelo está hardcodeado en un solo archivo (`route.ts:25`) — abstraerlo permite arbitrar costo. |
| **Bugs de plata en producción** sin tests ni observabilidad destruyen confianza (lo único insustituible en fintech) | Alta hoy / Crítico | P2 primero. Regla: ninguna feature de captura masiva (P4, P1) se lanza sin tests del camino de escritura. |
| **gasti copia el ciclo de resumen** o levanta capital | Media / Medio | La ventaja es de profundidad de modelo (0010/0030 son meses de diseño) + velocidad: P3 (inflación) levanta otra pared mientras tanto. Y su dependencia de Meta es una fragilidad estructural que vos no tenés. |
| **Single dev / bus factor** — todo el conocimiento en una persona | Alta / Alto | Los tests de P2 son también documentación ejecutable; mantener migraciones y este plan como fuente de verdad; CI con build+test+lint obligatorio. |
| **DolarAPI / datos.gob.ar caen o cambian** | Media / Medio | Multi-proveedor (Bluelytics como fallback de DolarAPI), validación de respuestas, alerta si la cotización tiene >24 h, y **nunca** convertir a 1:1 en silencio (P2). |
| **Compartidos (P6) abre agujeros de seguridad** al pasar de RLS single-user a membresías | Media / Crítico | Diseñar las políticas RLS de espacios con revisión dedicada + tests de autorización antes de la UI; el patrón EXISTS ya usado en `goal_accounts` (0027) es la plantilla. |
| **Web Speech/MediaRecorder con UX dispar en iOS Safari** | Media / Medio | Grabar audio y mandarlo a Gemini (server-side) en vez de depender del speech-to-text del browser; probar en iOS desde el día 1. |

## 4.4 Métricas / señales de que vamos ganando

**Activación (la batalla de la captura):**
- Tiempo registro → primer movimiento (objetivo: < 5 min).
- % de registros que cargan ≥ 10 movimientos en la primera semana.
- **% de movimientos creados por voz/foto/import vs form manual** — la métrica que mide si P1/P4 funcionaron. Si en 3 meses la captura asistida no supera el 30 %, la apuesta multimodal necesita revisión.

**Retención (el verdadero juego de finanzas personales):**
- Retención semana 4 y mes 3 (un tracker que sobrevive el mes 3 sobrevive el año).
- Movimientos por usuario activo por semana (hábito).
- % de usuarios con ≥ 1 tarjeta con ciclo configurado y ≥ 2 monedas — adopción de los diferenciadores.
- CTR de los insights proactivos (P5): si no se abren, son spam.

**Monetización:**
- Conversión free → Premium (benchmark de la categoría: 2–5 %).
- MRR en ARS y churn mensual de suscripciones MP.
- Costo de IA por usuario activo vs ARPU (que el free no funda la caja).

**Adquisición:**
- Tráfico orgánico a calculadoras y conversión calculadora → registro (el funnel que gasti ya validó).
- % de registros por invitación a espacios compartidos (cuando exista P6) — la señal de crecimiento viral.

**Calidad (guardrails):**
- Cero discrepancias de saldo reportadas; error rate en Sentry; cobertura de tests del módulo de dinero (objetivo: 100 % de `installments`, `rates`, `budgets`).

---

## Cierre

Mangui no es "otro tracker": es la única app del mercado que modela la plata argentina de verdad — cuotas con cierre y vencimiento, sellos, tres dólares, resúmenes bimonetarios. Eso ya está construido y verificado en el código. Lo que falta no es profundidad sino **boca de entrada** (voz, foto, import, share) e **inteligencia visible** (inflación, insights proactivos), sobre una base de ingeniería que hoy no tiene red (tests, observabilidad, histórico de cotizaciones).

La secuencia es: **cimientos y captura → inteligencia argentina → dimensión social → expansión.** Si la Fase A se ejecuta completa, Mangui le saca a gasti su única ventaja sin heredar su riesgo Meta, y queda solo en la posición de "la app que entiende la plata argentina".
