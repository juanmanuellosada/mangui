# mangui — Migraciones SQL (MVP Core)

Documentación del esquema de base de datos, modelo de seguridad y decisiones de diseño.

---

## Archivos de migración

| Archivo | Contenido |
|---|---|
| `0001_init_extensions_and_enums.sql` | Extensiones (pgcrypto) y todos los tipos enum |
| `0002_profiles_preferences.sql` | `profiles`, `user_preferences`, trigger `updated_at`, función helper `set_updated_at()` |
| `0003_accounts_categories.sql` | `accounts`, `categories` |
| `0004_movements_transfers.sql` | `movements`, `transfers` |
| `0005_exchange_rates.sql` | `exchange_rates` (caché global de cotizaciones) |
| `0006_triggers_seed.sql` | Trigger de signup `on_auth_user_created`, función `handle_new_user()`, `seed_default_categories()` |
| `0007_views.sql` | Vista `account_balances` (saldo derivado), vista `account_balances_projected` |

---

## Entidades y relaciones

```
auth.users (Supabase Auth)
    │
    ├── profiles (1:1)
    ├── user_preferences (1:1)
    │
    ├── accounts (1:N)
    │       │
    │       ├── movements (N:1 → account)
    │       │       └── categories (N:1, nullable)
    │       │
    │       └── transfers (N:1 → from_account / to_account)
    │
    └── categories (1:N)

exchange_rates (global, sin user_id)
```

**Tipos enum definidos:**

| Enum | Valores |
|---|---|
| `currency` | `ARS`, `USD` |
| `rate_type` | `oficial`, `blue`, `mep`, `ccl`, `manual` |
| `account_type` | `caja_ahorro`, `cuenta_corriente`, `efectivo`, `inversion`, `tarjeta_credito`, `billetera_virtual`, `otro` |
| `movement_type` | `income`, `expense` |
| `category_type` | `income`, `expense` |
| `ui_theme` | `light`, `dark`, `system` |

---

## Modelo RLS (Row Level Security)

Cada tabla de usuario (`profiles`, `user_preferences`, `accounts`, `categories`, `movements`, `transfers`) tiene RLS habilitado con la política base:

```sql
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

Esto garantiza aislamiento total: un usuario autenticado solo puede ver, insertar, modificar o borrar sus propias filas. No hay acceso cruzado entre usuarios por ningún path SQL.

**Tabla especial: `exchange_rates`**
- RLS habilitado pero solo existe una política de SELECT para usuarios autenticados.
- No hay políticas de INSERT/UPDATE/DELETE → solo el `service_role` (que bypassa RLS) puede escribir cotizaciones desde el backend/cron.

**Trigger `handle_new_user`**
- Corre como `SECURITY DEFINER` con `search_path = public`.
- Necesario porque el trigger se ejecuta antes de que `auth.uid()` esté definido para el usuario nuevo, por lo que no puede pasar las políticas RLS normales.
- Las funciones `seed_default_categories` y `handle_new_user` también son `SECURITY DEFINER` por la misma razón.

**Vista `account_balances`**
- Declarada con `security_invoker = true` (default en Postgres moderno).
- Al ejecutarse con los permisos del usuario que consulta, la RLS de las tablas subyacentes filtra automáticamente solo las filas del usuario. No se requiere RLS adicional sobre la vista.

---

## Derivación del saldo de cuentas

El saldo de cada cuenta **no se almacena** en una columna — se calcula siempre desde los datos base. Esto evita inconsistencias ante ediciones históricas.

**Fórmula:**

```
saldo_actual = initial_balance
             + SUM(income en moneda de la cuenta)
             - SUM(expense en moneda de la cuenta)
             + SUM(transfers_in en moneda de la cuenta)
             - SUM(transfers_out en moneda de la cuenta)
```

**Manejo multimoneda:**
- Si `movements.original_currency == accounts.currency` → se usa `movements.amount`.
- Si difieren → se usa `movements.converted_amount` (que la app persiste en la moneda de la cuenta al insertar).
- Los movimientos con moneda diferente y `converted_amount = NULL` son datos inválidos; se excluyen (COALESCE a 0) para no corromper el saldo.

**Movimientos futuros (`is_future = true`):**
- Excluidos de `account_balances` (saldo real).
- Incluidos en `account_balances_projected` (saldo esperado).

**Performance:**
- Índices en `movements(account_id, type)`, `movements(user_id, date)`, `transfers(from_account_id)`, `transfers(to_account_id)`.
- Las CTEs en la vista permiten al planner optimizar cada agregación por separado.
- Para usuarios con muchos movimientos, en fases futuras se puede materializar el saldo base con un trigger y mantener solo el delta.

---

## Categorías por defecto

Al registrarse un usuario, el trigger `on_auth_user_created` llama a `seed_default_categories()` que inserta:

**Ingresos:** Sueldo, Freelance, Inversiones, Otros ingresos

**Gastos:** Supermercado, Comida afuera, Transporte, Servicios, Alquiler, Salud, Entretenimiento, Ropa, Educación, Suscripciones, Impuestos, Otros gastos

Marcadas con `is_default = true`. El usuario puede editarlas y crear nuevas.

---

## Columnas forward-compat (ya en el schema, usadas en fases futuras)

| Columna | Tabla | Fase | Propósito |
|---|---|---|---|
| `installment_purchase_id` | `movements` | 2 — Cuotas | Agrupa las N cuotas de una compra en tarjeta |
| `installment_number` / `installment_total` | `movements` | 2 — Cuotas | Número y total de cuotas |
| `recurring_id` | `movements`, `transfers` | 3 — Recurrentes | FK a tabla `recurring_templates` (no creada aún) |
| `dollar_type` | `movements` | 1 (ya usable) | Qué cotización se usó: oficial/blue/mep/ccl/tarjeta |
| `is_future` | `movements`, `transfers` | 3 — Programados | Movimiento/transferencia aún no ejecutado |
| `color` | `accounts` | UI fase 2 | Color de identificación de la cuenta |

---

## Fases futuras (tablas NO creadas en MVP)

- **Cuotas/installments:** `installment_purchases` (grupo de cuotas), FK desde `movements`.
- **Recurrentes:** `recurring_templates` con regla de recurrencia (rrule o campos propios).
- **Presupuestos:** `budgets` (user_id, category_id, amount, period).
- **Metas de ahorro:** `goals` (user_id, name, target_amount, target_date).
- **Adjuntos:** `attachments` (Supabase Storage, referencia por movement_id).
- **Push notifications:** `push_subscriptions` (user_id, endpoint, keys VAPID).
- **Vistas guardadas:** `saved_views` (user_id, filtros serializados).
- **Reglas de auto-categorización:** `categorization_rules` (user_id, pattern, category_id).

---

## Cómo aplicar las migraciones

```bash
# Desarrollo local con Supabase CLI
supabase db reset           # aplica todas las migraciones desde cero
supabase migration new name # crea una nueva migración

# O aplicar una por una:
supabase db push
```

Para producción: usar `supabase db push` o el panel de Supabase > SQL Editor.
