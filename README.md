# mangui

mangui es una app de finanzas personales diseñada para Argentina: multimoneda ARS y USD, seguimiento de gastos en cuotas, recurrentes automáticos, presupuestos por categoría, metas de ahorro, y quick-add con IA. Es una PWA instalable en el celular, con soporte offline de lectura y sincronización automática.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Auth & DB | Supabase (Postgres + Row Level Security) |
| Data fetching | TanStack Query v5 |
| Forms | react-hook-form + zod |
| Email | Resend |
| Notificaciones push | web-push (VAPID) |
| IA | Vercel AI SDK |
| Gráficos | Recharts |
| Fechas | date-fns |

---

## Cómo correr el proyecto

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env.local
# Completar los valores en .env.local
```

Variables necesarias para el desarrollo básico:
- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` — desde tu proyecto de Supabase en Settings > API.

El resto de las variables (Resend, VAPID, AI Gateway) son opcionales hasta que implementes esas features.

### 3. Correr en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### 4. Build de producción

```bash
npm run build
npm start
```

---

## Estructura del proyecto

```
src/
  app/
    (marketing)/      → Landing page pública (/)
    (auth)/           → Login, registro, recuperar contraseña
    (app)/            → App protegida (/app/*)
  components/
    ui/               → Componentes shadcn/ui
    providers.tsx     → TanStack Query + Toaster
    app-sidebar.tsx   → Sidebar desktop
    app-bottom-nav.tsx→ Nav mobile
  lib/
    supabase/
      client.ts       → Cliente browser
      server.ts       → Cliente servidor
      middleware.ts   → Refresh de sesión + protección de rutas
    utils.ts          → cn() helper
  middleware.ts       → Next.js middleware (auth guard)
supabase/
  migrations/         → Migraciones SQL (44 aplicadas)
```

---

## Estado del proyecto

**En producción** en [www.mangui.com.ar](https://www.mangui.com.ar), con app en Google Play vía TWA. Funcionalidad implementada:

- Auth completo (Supabase Auth, login/registro/recuperación).
- Movimientos, cuentas, tarjetas con cuotas, transferencias.
- Recurrentes automáticos y reglas de categorización.
- Presupuestos por categoría y metas de ahorro.
- Estadísticas y dashboard con datos reales.
- IA (Manguito, sobre Gemini) para quick-add y chat.
- PWA instalable con soporte offline y notificaciones push.
- Multimoneda ARS/USD, inflación INDEC, sección "dónde rendir" y cobros con MercadoPago.

---

## Zona horaria

La app asume `America/Argentina/Buenos_Aires`. Configurar `TZ=America/Argentina/Buenos_Aires` en el entorno de producción/staging.
