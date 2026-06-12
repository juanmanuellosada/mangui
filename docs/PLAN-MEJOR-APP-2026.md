# mangui — ¿La mejor app de finanzas personales del mercado?

**Análisis competitivo + plan de acción · Junio 2026**

> Basado en: escaneo completo del código del repo (rutas, libs de dominio, 28 tablas, crons, IA, PWA), investigación del mercado argentino 2025-2026 (apps nativas, bots de WhatsApp, billeteras, Open Finance BCRA) e investigación del estado del arte global (Monarch, Copilot, YNAB, Simplifi, apps AI-native 2026).

---

## 1. Veredicto ejecutivo

**¿Sos hoy la mejor app de finanzas personales de Argentina?** En modelado financiero argentino, **sí, sin competencia verificada**: nadie más modela ciclos de resumen de tarjeta cross-emisor, cuotas como objetos de primera clase, 4 tipos de dólar por movimiento y ajuste por inflación IPC en una sola app. **Pero todavía no sos la mejor app**, por tres razones:

1. **Arranque desde cero**: no hay import de CSV/OFX ni de resúmenes de tarjeta, así que un usuario nuevo empieza con la app vacía y migrar su historia cuesta caro. La captura diaria ya es excelente (texto + voz + foto con IA, verificado en código), pero el primer día sigue siendo cuesta arriba.
2. **Promesas de marketing que el producto no cumple**: `/para/parejas` vende finanzas compartidas que no existen en el código. Esto destruye confianza, que es el activo #1 de una app de finanzas.
3. **Cimientos con riesgo**: cero tests sobre la matemática financiera (cuotas, conversión, presupuestos), sin observabilidad (no hay Sentry), historial de tipo de cambio que se pisa (no podés revaluar un movimiento al dólar de su fecha), y el botón de eliminar cuenta dice "próximamente" (riesgo legal — Ley 25.326, derecho de supresión).

**¿Es alcanzable ser la mejor?** Sí, y la ventana está abierta: la camada de apps nativas locales (Ábaco, guita., MonAi) es joven y ninguna monetiza en serio; los bots de WhatsApp tienen free tiers mezquinos y cobran en USD; el Open Finance del BCRA recién estaría operativo en 2027. Tenés ~12-18 meses para consolidarte antes de que el bank sync normalice el mercado.

---

## 2. Mapa del mercado (mid-2026)

### Argentina — competencia directa

| Competidor | Qué es | Precio | Su fuerte | Su débil |
|---|---|---|---|---|
| **Gasti** (gasti.pro) | Bot WhatsApp/Telegram + web | USD 6,99-9,99/mes | Captura por texto/audio/foto, integración Wallbit, multiusuario | Cobra en USD (queja local), free tier mezquino (10 registros IA/mes), tus finanzas viven en WhatsApp |
| **Ábaco** (abaco.uno) | App nativa iOS/Android | Gratis (freemium anunciado) | **El más parecido a vos**: multimoneda real con TC histórico por movimiento, integración Mercado Pago para auto-carga | Sin resúmenes de tarjeta, sin recurrentes/reglas, sin IA, sin rendimientos, sin web |
| **QueWallet** | Bot WhatsApp | ARS 2.999/mes (Familiar 4.999) | Fricción cero, precio en ARS, plan familiar | Solo bot, sin app rica en datos |
| **MonAi** | App nativa iOS/Android | Freemium barato | Registro por voz con IA, diseño muy elogiado, privacidad | No es AR-específica: sin tipos de dólar, sin cuotas/resúmenes |
| **guita.** | HTML local, desktop | Pago único ARS 9.800 | Anti-suscripción, gamificación | Sin multimoneda, sin tarjetas, sin mobile |
| **CumbreBot, Orionfin, Botty, Tecabot** | Bots WhatsApp | ARS 4.990 / USD 10-20 | Cola larga de clones IA | Ninguno dominante |

### Amenazas adyacentes

- **Ualá / Brubank / Mercado Pago**: categorización automática de SUS propios movimientos. Ningún banco/billetera consolida multi-entidad ni trackea resúmenes de otras tarjetas — tu diferencial sigue intacto.
- **comparatasas.ar / tasas.ar / dolarito**: commoditizan "qué billetera paga más", pero **no personalizan según tus cuentas** — tu sección "rendir" sí.
- **Open Finance BCRA**: Decreto 353/2025, todavía en fase de diseño (grupos técnicos en 2026). Operativo estimado 2027. El bank sync NO es exigible hoy; planificá su adopción para cuando llegue.

### Global — el listón de "mejor app"

- **Monarch Money** (USD 99/año): el rey de parejas/hogar (Shared Views "yours/mine/ours"), net worth con tendencia, Sankey de cash flow, forecasting what-if, resumen semanal automático.
- **Copilot Money** (USD 95/año): mejor diseño del mercado, **categorización ML que aprende por usuario** (su feature más retenida), briefings diarios proactivos, MCP beta (mayo 2026).
- **YNAB** (USD 109/año): **75% retención a 12 meses** — la más alta — sin IA propia: la gana el ritual semanal + metodología. Expuso su API para agentes externos.
- **Simplifi**: proyección de saldo a 12 meses ("Projected Cash Flow") — el mejor safe-to-spend.
- **AI-native 2026** (Era, Cleo Autopilot, Finny, Origin): la frontera es IA proactiva y agéntica, no chat reactivo. El chatbot genérico está comprobado como gimmick si la base (categorización, captura) es mala.

---

## 3. Fortalezas — lo que tenés mejor que TODOS

1. **Ciclos de resumen de tarjeta cross-emisor** (cierre/vencimiento/sellado, bimonetario ARS+USD, pago desde múltiples cuentas). **Nadie más lo modela** — ni apps locales, ni globales, ni los propios bancos (solo ven su tarjeta).
2. **Cuotas como objeto de primera clase**: compra → N cuotas → resumen vinculado → detalle por cuota. La viralidad de Infleta y el "Plan Z" de Naranja X prueban que es EL dolor argentino; solo vos lo resolvés completo.
3. **4 tipos de dólar nativos** (oficial/blue/MEP/CCL/tarjeta) por movimiento, con conversión almacenada. Las apps globales genericizan a "USD"; Ábaco guarda TC histórico pero no distingue todos los tipos en todo el flujo.
4. **Ajuste por inflación IPC (INDEC)** con toggle Nominal vs Real en estadísticas. Solo vos + parcialmente Gasti.
5. **"¿Dónde rendir tu plata?" personalizado**: plazos fijos, billeteras, FCI ARS/USD, stablecoins — comparatasas.ar es la referencia pero es genérico; vos lo cruzás con las cuentas del usuario.
6. **IA hosteada gratis (Gemini) con captura multimodal completa**: texto, **voz** (MediaRecorder → transcripción Gemini) y **foto de ticket** (OCR) desde el formulario principal ("Rellenar con IA") y el chat — verificado en código, cadena completa. Manguito además tiene 8 tools de consulta + draft de movimientos, sin BYOK. Gasti cobra USD por esto.
7. **Precio en ARS vía Mercado Pago** (ARS 1.999/mes): el rango aceptado local es 3.000-5.000; estás barato y en la moneda correcta. Gasti/Orionfin cobran en USD y los usuarios se quejan.
8. **PWA completa**: web+mobile parity, offline con cola de escritura IndexedDB, push, Web Share Target (compartir imagen → OCR → draft). Ábaco no tiene web; guita. no tiene mobile.
9. **Cuenta demo sembrada** (~1 año de datos): el mejor activo de conversión; ningún competidor local lo tiene.
10. **Seguridad de datos**: RLS completo en 28 tablas, demo read-only por políticas de DB, llaves cifradas AES-256-GCM, webhooks verificados.
11. **Motor completo de PFM**: recurrentes con feriados argentinos, reglas automáticas con sugerencias heurísticas, presupuestos multi-período, metas de 3 tipos con snapshots, 7 tabs de estadísticas, insights semanales por email. Ninguna app local tiene este stack completo.
12. **SEO/contenido propio**: 4 calculadoras públicas, páginas comparativas (vs Gasti/Excel/Splitwise), páginas por audiencia — embudo orgánico que la competencia local no construyó.

---

## 4. Debilidades — lo que tenés peor

### Críticas (te pueden hundir)

| # | Debilidad | Evidencia | Quién te gana acá |
|---|---|---|---|
| 1 | **`/para/parejas` vende algo que no existe**: cero soporte de finanzas compartidas en schema o código | Marketing > producto | Monarch hizo de parejas su posicionamiento entero; Spendee, QueWallet Familiar |
| 2 | **Cero tests** sobre matemática financiera (cuotas con redondeo, conversión multi-moneda, ventanas de presupuesto, ciclos de resumen) | No hay vitest/jest en el repo | Riesgo silencioso: un error de cálculo en una app de finanzas es fatal para la confianza |
| 3 | **Historial de TC se pisa**: `exchange_rates` tiene UNIQUE(rate_type, rate_date) y el upsert sobreescribe; `exchange_rates_history` existe (mig 0036) pero no se usa para revaluar | No podés mostrar "tu patrimonio en dólares de aquel momento" | Ábaco guarda el TC del momento por movimiento |
| 4 | **Eliminar cuenta "próximamente"** | Botón deshabilitado en ajustes | Riesgo legal directo (Ley 25.326) + bloqueo para reviews de stores |
| 5 | **Conversión silenciosamente rota si DolarAPI falla**: `convertAmount()` devuelve null sin fallback | `rates/dolar.ts` | Saldos incorrectos sin aviso |

> Nota de verificación (2026-06-12): dos debilidades reportadas por el primer escaneo fueron **refutadas con evidencia de código** y eliminadas de esta tabla: (a) "voz vaporware" — falso: `voice-input-button.tsx` graba con MediaRecorder y está cableado en `ai-fill-bar.tsx:131` (form principal → `/api/ai/extract-movement`) y en `ai-chat.tsx:741` (→ `/api/ai/transcribe`); (b) "OCR solo vía /compartir" — falso: `photo-input-button` está en el mismo `ai-fill-bar` del formulario principal y autocompleta todos los campos.

### Importantes (te frenan el crecimiento)

6. **Sin import CSV/OFX ni de resúmenes PDF**: arrancar de cero a mano es el mayor motivo de abandono en onboarding; Actual Budget soporta QIF/OFX/CSV y es el estándar manual-first.
7. **Sin net worth consolidado con tendencia**: tenés los datos (cuentas, inversiones implícitas en "rendir") pero no la vista. Es table stake global 2026.
8. **Sin vista calendario financiero**: con cierres + vencimientos + cuotas + recurrentes ya cargados, no mostrar "qué pasa cada día y cuánta plata vas a tener" es dejar valor sobre la mesa.
9. **Sin observabilidad**: solo `console.error`; los bugs de producción son invisibles.
10. **Free tier con acantilado**: 1 cuenta / 1 presupuesto / 1 meta. Mejor que antes (P9 sumó 3 recurrentes), pero la activación sigue siendo abrupta; Ábaco es 100% gratis hoy.
11. **Deuda estructural**: componentes de +1.100 líneas (movements-list: 1.964, sin virtualización pese a tener react-window instalado), `getTodayAR()` duplicado en 3 archivos, bug de TZ en formularios (entradas de 21:00-00:00 AR pueden caer en fecha equivocada), sin CSP headers.
12. **Sin auto-captura estilo Ábaco/Organizze**: Ábaco se integra con Mercado Pago para auto-cargar; Organizze captura notificaciones bancarias. Vos sos 100% manual+IA.

---

## 5. Comparativa directa

| Capacidad | mangui | Gasti | Ábaco | MonAi | Monarch (listón global) |
|---|---|---|---|---|---|
| Resúmenes de tarjeta cross-emisor | ✅ único | ❌ | ❌ | ❌ | ❌ (concepto US) |
| Cuotas primera clase | ✅ único | ❌ | ❌ | ❌ | ❌ |
| Tipos de dólar (4) | ✅ | parcial | parcial | ❌ | ❌ |
| Inflación real/nominal | ✅ | parcial | ❌ | ❌ | ❌ |
| Rendimientos personalizados | ✅ único | ❌ | ❌ | ❌ | ❌ |
| Captura por voz | ✅ | ✅ | ❌ | ✅ | ❌ |
| OCR de tickets accesible | ✅ (form + share + chat) | ✅ | ❌ | ⚠️ | ✅ |
| Auto-captura (MP/notifs) | ❌ | ✅ (Wallbit) | ✅ (MP) | ⚠️ (Apple Pay) | ✅ (bank sync) |
| Import CSV/resumen | ❌ | ⚠️ | ❌ | ❌ | ✅ |
| Finanzas compartidas | ❌ (¡pero lo promociona!) | ✅ Premium | ❌ | ⚠️ listas | ✅ el mejor |
| Net worth con tendencia | ❌ | ❌ | ❌ | ❌ | ✅ |
| Calendario financiero | ❌ | ❌ | ❌ | ❌ | ✅ |
| Safe-to-spend héroe | ❌ | ❌ | ❌ | ❌ | ❌ (se lo critican) |
| Resumen semanal proactivo | ⚠️ email opt-in | ❌ | ❌ | ❌ | ✅ patrón #1 de retención |
| Web + mobile | ✅ PWA | ⚠️ | ❌ solo apps | ❌ solo apps | ✅ |
| Precio en ARS por MP | ✅ 1.999 | ❌ USD | gratis hoy | store | ❌ USD 99/año |
| Demo sin registro | ✅ único | ❌ | ❌ | ❌ | ❌ |

**Lectura**: tu columna ya es la más completa del mercado argentino, incluida la captura multimodal (texto/voz/foto). Las celdas rojas que importan son de **onboarding** (import, auto-captura) y **vistas de decisión** (net worth, calendario, safe-to-spend) — no de motor ni de captura diaria.

---

## 6. Funcionalidades nuevas que deberías tener (priorizadas)

### P1 — Onboarding sin fricción (el gap que te está costando usuarios)

> La captura diaria (texto/voz/foto con IA) ya está construida y verificada. El gap real es el **primer día**: migrar la historia previa del usuario.

1. **Import de CSV + resumen de tarjeta (PDF)**: parser asistido por Gemini para los formatos de los bancos grandes (Galicia, Santander, BBVA, Macro, Nación) y export de Mercado Pago. Resuelve el arranque-de-cero, el mayor motivo de abandono.
2. **Comunicar la captura multimodal**: la landing ya lo dice, pero el quick-add por voz/foto es tu respuesta directa a MonAi y a los bots — merece protagonismo en onboarding, demo y páginas comparativas ("lo mismo que un bot, sin regalarle tus finanzas a WhatsApp").
3. *(Explorar)* **Auto-captura vía share de notificaciones**: estilo Organizze; en PWA es limitado pero el share-sheet ya lo tenés montado.

### P2 — Vistas de decisión (de app de registro a app de decisión)

5. **Safe-to-spend argentino como número héroe del dashboard**: "te quedan $X seguros hasta el cierre del resumen" — la versión nativa que PocketGuard/Simplifi no pueden hacer. Tenés todos los insumos: saldos, presupuestos, recurrentes, cierres.
6. **Calendario financiero con saldo proyectado**: cada día del mes con cierres, vencimientos, cuotas, recurrentes, y el saldo que vas a tener. Simplifi lo hace a 12 meses; vos tenés mejores datos (cuotas conocidas a futuro).
7. **Net worth con tendencia en 3 monedas**: ARS nominal / ARS constantes (deflactado por IPC) / USD. Table stake global con un twist que ninguna app del mundo puede copiar. Requiere arreglar primero el historial de TC (debilidad #5).

### P3 — Retención (lo que hace que vuelvan)

8. **Resumen semanal proactivo por push** (no solo email opt-in): qué cambió, tendencia, inflación del mes, qué mirar. Es el patrón de retención #1 comprobado (Monarch) y ya tenés push + insights engine — es composición, no construcción.
9. **Cierre de mes tipo "wrapped"**: narrativa mensual compartible (con el Sankey que ya tenés en dashboard). Marketing orgánico puro.
10. **Categorización que aprende del usuario**: registrar las correcciones de categoría y usarlas para mejorar las sugerencias (estilo Copilot, la feature de IA con mejor retención comprobada). No hace falta ML pesado: heurística por comercio+monto+cuenta ya mueve la aguja.

### P4 — Expansión (lo que abre mercados)

11. **Finanzas compartidas / modo pareja**: o lo construís o despublicás `/para/parejas`. En Argentina (gastos compartidos en ARS+USD+cuotas) es doblemente relevante, y QueWallet ya cobra plan Familiar. Es la feature de posicionamiento que llevó a Monarch a la cima.
12. **Plan Familiar como tier de pricing** (ARS ~4.999/mes, benchmark QueWallet).
13. *(2027, vigilar)* **MCP server de mangui**: exponer tus datos al Claude/ChatGPT del usuario (Copilot y YNAB ya lo hicieron). Es una API, no UI — barato y diferenciador.
14. *(2027, vigilar)* **Bank sync cuando el BCRA publique la normativa** de Open Finance: tener el plan listo antes de que las billeteras grandes lo integren.

### Qué NO construir (validado por la investigación)

- ❌ **Bots de WhatsApp** (decisión ya tomada, y correcta: el mercado de bots es una cola larga de clones).
- ❌ **Streaks visibles**: ningún líder los usa en finanzas; generan culpa con la plata. Rituales > rachas.
- ❌ **Chatbot como feature central**: comprobado como gimmick si la captura/categorización de base es débil. Manguito está bien como está; invertí en captura, no en más chat.
- ❌ **Cancelación de suscripciones con concierge** (modelo Rocket Money): inviable e irrelevante localmente.
- ❌ **App nativa** por ahora: la PWA es ventaja de paridad web+mobile; reevaluar solo si las stores se vuelven canal de adquisición crítico.

---

## 7. Paso a paso para ser la mejor

### Fase 0 — Honestidad y cimientos (1-2 semanas) · *"Que nada de lo que decís sea mentira y nada de lo que calculás esté mal"*

- [ ] Despublicar o reescribir **`/para/parejas`** hasta que la feature exista.
- [ ] Implementar **eliminación de cuenta** (riesgo legal Ley 25.326).
- [ ] **Tests** (vitest) sobre la matemática core: `installments.ts`, `cards.ts` (ciclos), `budgets.ts` (ventanas), conversión multi-moneda, `adjust.ts` (IPC). Son funciones puras: testearlas es barato.
- [ ] **Fallback explícito** cuando DolarAPI falla (última cotización conocida + aviso, nunca null silencioso).
- [ ] Empezar a **consumir `exchange_rates_history`**: guardar el TC usado por movimiento ya lo hacés; dejar de pisar el histórico diario.
- [ ] **Sentry** (o similar) en producción.
- [ ] Fix del **bug de TZ** en formularios (fechas 21:00-00:00 AR).

**Criterio de éxito**: ningún claim de marketing sin respaldo en código; suite de tests verde sobre toda la matemática financiera; errores de prod visibles.

### Fase 1 — Ganar el onboarding (3-4 semanas) · *"Un usuario nuevo con datos útiles en menos de 5 minutos"*

- [ ] Pulir y medir el quick-add multimodal existente (texto+voz+foto): latencia, tasa de acierto del parser, descubribilidad desde el botón global "Nuevo".
- [ ] **Import CSV** genérico con mapeo asistido por IA.
- [ ] **Import de resumen de tarjeta PDF** (Gemini Vision): el momento mágico — subís tu resumen y mangui arma el statement con todas las cuotas detectadas.
- [ ] Onboarding rediseñado hacia el aha: "cargá 3 gastos con IA y mirá tu primer insight" o "importá tu resumen" en la primera sesión (regla de industria: 60-80% se pierde en la semana 1 sin aha moment).
- [ ] Medir: tiempo-hasta-primer-movimiento, movimientos por usuario en semana 1.

**Criterio de éxito**: cargar un gasto < 5 segundos; un usuario nuevo tiene datos útiles en < 5 minutos.

### Fase 2 — Vistas de decisión (4-6 semanas) · *"El número que nadie más puede calcular"*

- [ ] **Safe-to-spend héroe** en dashboard: disponible real hasta el cierre del resumen, descontando recurrentes y cuotas comprometidas.
- [ ] **Calendario financiero** con saldo proyectado día a día (cierres, vencimientos, cuotas, recurrentes).
- [ ] **Net worth con tendencia** ARS nominal / ARS constantes / USD (requiere el historial de TC de Fase 0).
- [ ] Alertas **predictivas** (estilo Pace): "a este ritmo te quedás sin presupuesto el 22", "el resumen que viene te va a dar ~$X".

**Criterio de éxito**: mangui responde "¿puedo gastar esto?" y "¿cómo voy a estar el 15?" — preguntas que ninguna app argentina responde.

### Fase 3 — Retención (3-4 semanas) · *"Que escriba mangui, no que el usuario pregunte"*

- [ ] **Resumen semanal push** automático (composición de insights engine + push existentes), con ángulo argentino: inflación del mes, movimiento del dólar, tu gasto real vs nominal.
- [ ] **Cierre de mes "wrapped"** compartible.
- [ ] **Categorización que aprende** de las correcciones del usuario.
- [ ] Notificaciones gatilladas por comportamiento (4x más reacción que las programadas): cargo inusual, presupuesto al 80%, cierre en 48hs.

**Criterio de éxito**: retención semana 4 > 40%; el resumen semanal con >50% de apertura.

### Fase 4 — Expansión (6-8 semanas) · *"El posicionamiento que falta"*

- [ ] **Finanzas compartidas / modo pareja** (la feature que Monarch usó para ganar; nadie la hace bien en Argentina): cuentas/categorías compartidas, vista "tuyo/mío/nuestro", invitación por link.
- [ ] **Tier Familiar** (~ARS 4.999/mes) — sin cobrar por asiento (anti-patrón conocido).
- [ ] Republicar `/para/parejas` — ahora con producto real detrás.
- [ ] Revisar free tier: subir de 1 a 2-3 cuentas (Ábaco gratis presiona; el acantilado actual frena la activación que después convierte).

**Criterio de éxito**: % de usuarios en modo compartido; conversión free→premium estable o mejor con el free tier más generoso.

### Fase 5 — Frontera 2027 (continuo) · *"Llegar antes"*

- [ ] **MCP server** de mangui (datos del usuario en su Claude/ChatGPT — Copilot y YNAB ya lo hicieron; sería el primero de LatAm).
- [ ] Plan de **bank sync** listo para el día que el BCRA publique la normativa de Open Finance (monitorear Comunicaciones "A"; operativo estimado 2027).
- [ ] Explorar auto-captura Mercado Pago (lo que hace Ábaco) si aparece una vía de API viable.
- [ ] Deuda técnica restante: virtualizar listas largas (react-window ya instalado), partir componentes >1.000 líneas, CSP headers, unificar `getTodayAR()`.

---

## 8. Posicionamiento sugerido

> **"La única app que entiende cómo se maneja la plata en Argentina."**
> Resúmenes y cuotas de verdad, todos los dólares, inflación real, y dónde hacer rendir lo que te queda — cargado en 5 segundos con IA, sin bots, sin regalar tus datos, en pesos por Mercado Pago.

Contra cada competidor:
- **vs bots (Gasti/QueWallet)**: "todo lo que hace el bot, sin meter tus finanzas en WhatsApp, con una app real atrás" + precio en ARS.
- **vs Ábaco**: motor completo (tarjetas, cuotas, recurrentes, reglas, presupuestos, metas, IA, rendir) vs un tracker multimoneda.
- **vs apps globales**: ellas asumen un país estable; vos modelás el país real.

---

## 9. Riesgos a monitorear

| Riesgo | Señal | Respuesta |
|---|---|---|
| Ábaco agrega tarjetas/cuotas + monetiza | Updates de abaco.uno | Acelerar Fase 1-2; tu ventaja es el motor completo |
| Mercado Pago mejora su PFM embebido | Releases de MP | El multi-entidad (efectivo+USD+otros bancos) sigue siendo tuyo |
| BCRA publica normativa Open Finance antes de lo esperado | Comunicaciones "A" del BCRA | Tener el plan de sync listo (Fase 5) |
| Un bot baja precio a ARS y mejora su app | Pricing de Gasti | Tu free tier + PWA + datos ricos son la defensa |

---

*Generado el 2026-06-12 a partir de: inventario de código del repo (branch main, commit eb93bed), investigación web del mercado argentino y global 2025-2026. Fuentes principales: gasti.pro, abaco.uno, quewallet.com, get-monai.app, guita.net.ar, comparatasas.ar, BCRA (Objetivos 2026, Decreto 353/2025), monarch.com, copilot.money, ynab.com, quicken.com/simplifi, actualbudget.org, era.app, meetcleo.com, getfinny.app, NerdWallet/Engadget 2026.*
