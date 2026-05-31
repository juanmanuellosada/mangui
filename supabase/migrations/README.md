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
| `0010_installments_cards.sql` | `installment_purchases`, FK `movements → installment_purchases`, `card_statements` |

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

    installment_purchases (1:N via movements.installment_purchase_id)
    card_statements (1:N por account_id + close_date UNIQUE)
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

## Fase 2 — Tarjetas y Cuotas (`0010_installments_cards.sql`)

### Nuevas tablas

#### `installment_purchases`
Agrupa el conjunto de N movimientos mensuales que conforman una compra financiada en cuotas.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `description` | text NOT NULL | Nombre del bien/servicio |
| `total_amount` | numeric(18,2) NOT NULL | CHECK > 0 |
| `installments_count` | int NOT NULL | CHECK >= 1 |
| `start_date` | date NOT NULL | Fecha de la primera cuota |
| `currency` | currency NOT NULL | Enum: `ARS` / `USD` |
| `account_id` | uuid NOT NULL | FK → `accounts` ON DELETE RESTRICT |
| `category_id` | uuid NULL | FK → `categories` ON DELETE SET NULL |
| `dollar_type` | text NULL | Soft CHECK: `oficial/blue/mep/ccl/tarjeta` |
| `note` | text | Opcional |
| `created_at` / `updated_at` | timestamptz | Trigger `set_updated_at()` |

Cada cuota individual vive en `movements` con `installment_purchase_id`, `installment_number` e `installment_total`. Si se borra un `installment_purchase`, sus cuota-movements se borran en cascada (ver FK abajo).

#### FK: `movements.installment_purchase_id → installment_purchases(id) ON DELETE CASCADE`
- Nombre: `movements_installment_purchase_id_fkey`.
- Agregada con un bloque DO idempotente (drop-if-exists + add).
- La columna ya existía nullable desde `0004`; esta migración formaliza la integridad referencial.

#### `card_statements`
Registra el estado de pago de un resumen de tarjeta de crédito por ciclo. Los ítems del resumen (movimientos) **no se almacenan aquí**: se derivan de los `movements` cuya `date` cae dentro del ciclo de la cuenta. Esta tabla guarda únicamente el estado de pago, el impuesto de sellado y las referencias al pago efectuado.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `account_id` | uuid NOT NULL | FK → `accounts` ON DELETE CASCADE |
| `close_date` | date NOT NULL | Fecha de cierre del ciclo |
| `due_date` | date NOT NULL | Fecha límite de pago |
| `total_amount` | numeric(18,2) NOT NULL | DEFAULT 0; calculado por la app |
| `stamp_tax` | numeric(18,2) NOT NULL | DEFAULT 0; impuesto de sellado (Argentina) |
| `status` | text NOT NULL | DEFAULT `'pendiente'`; CHECK IN (`pendiente`, `pagado`) |
| `paid_amount` | numeric(18,2) NULL | Monto efectivamente abonado |
| `paid_from_account_id` | uuid NULL | FK → `accounts` ON DELETE SET NULL |
| `paid_date` | date NULL | Fecha del pago |
| `transfer_id` | uuid NULL | FK → `transfers` ON DELETE SET NULL |
| `note` | text | Opcional |
| `created_at` / `updated_at` | timestamptz | Trigger `set_updated_at()` |

Restricción de unicidad: `UNIQUE (account_id, close_date)` — un solo resumen por tarjeta y fecha de cierre.

### RLS
Ambas tablas tienen RLS habilitado con las cuatro políticas estándar (`select/insert/update/delete` propias via `auth.uid() = user_id`), idéntico al patrón de `movements` y `transfers`.

### Índices
- `installment_purchases`: `(user_id)` y `(user_id, account_id)`.
- `card_statements`: `(user_id, account_id)`.

---

## Fase 3 — Recurrentes y Programadas (`0011_recurring_scheduled.sql`)

### Nuevos enums

| Enum | Valores |
|---|---|
| `txn_kind` | `income`, `expense`, `transfer` |
| `recurring_frequency` | `weekly`, `biweekly`, `monthly`, `bimonthly`, `annual` |
| `weekend_handling` | `as_is`, `skip`, `previous_business_day` |
| `recurring_status` | `active`, `paused`, `inactive` |
| `occurrence_status` | `pending`, `confirmed`, `skipped` |
| `scheduled_status` | `pending`, `executed`, `rejected` |

Todos creados con `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` (idempotente).

### Nuevas tablas

#### `recurring_transactions`
Template que define la regla de recurrencia. La app/cron la lee para proyectar `recurring_occurrences`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `kind` | txn_kind NOT NULL | `income` / `expense` / `transfer` |
| `amount` | numeric(18,2) NOT NULL | CHECK > 0. Para transferencias: monto origen. |
| `currency` | currency NOT NULL | Enum `ARS` / `USD` |
| `account_id` | uuid NULL | FK → `accounts` ON DELETE CASCADE. Cuenta afectada (origen para transfers). |
| `to_account_id` | uuid NULL | FK → `accounts` ON DELETE CASCADE. Solo `kind='transfer'`. |
| `to_amount` | numeric(18,2) NULL | CHECK > 0. Monto destino para transfers multimoneda. |
| `category_id` | uuid NULL | FK → `categories` ON DELETE SET NULL |
| `note` | text | Descripción libre |
| `frequency` | recurring_frequency NOT NULL | Frecuencia de repetición |
| `day_of_week` | int NULL | CHECK 0–6. Solo `weekly`/`biweekly` (0=domingo). |
| `day_of_month` | int NULL | CHECK 1–31. Solo `monthly`/`bimonthly`/`annual`. |
| `month_of_year` | int NULL | CHECK 1–12. Solo `annual`. |
| `weekend_handling` | weekend_handling NOT NULL | DEFAULT `as_is` |
| `start_date` | date NOT NULL | Inicio de vigencia |
| `end_date` | date NULL | Fin de vigencia. NULL = sin fecha de fin. |
| `next_run` | date NULL | Calculado por app/cron. No es fuente de verdad de la regla. |
| `status` | recurring_status NOT NULL | DEFAULT `active` |
| `is_card_recurring` | boolean NOT NULL | DEFAULT `false`. True → agrupa ocurrencias en resúmenes de tarjeta. |
| `created_at` / `updated_at` | timestamptz | Trigger `set_updated_at()` |

**CHECK de integridad:** `chk_recurring_transfer_fields` — cuando `kind='transfer'`, `to_account_id` debe ser NOT NULL y distinto de `account_id`; cuando `kind` es `income`/`expense`, `to_account_id` y `to_amount` deben ser NULL.

**Índices:** `(user_id)` y `(user_id, status, next_run)`.

#### `recurring_occurrences`
Instancias generadas a partir de un template. Una por fecha-ciclo. El usuario confirma, edita o saltea desde la bandeja "Por confirmar".

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `recurring_id` | uuid NOT NULL | FK → `recurring_transactions` ON DELETE CASCADE |
| `scheduled_date` | date NOT NULL | Fecha proyectada de la ocurrencia |
| `status` | occurrence_status NOT NULL | DEFAULT `pending` |
| `amount_override` | numeric(18,2) NULL | CHECK > 0. NULL = heredar monto del template. |
| `movement_id` | uuid NULL | FK → `movements` ON DELETE SET NULL. Creado al confirmar. |
| `transfer_id` | uuid NULL | FK → `transfers` ON DELETE SET NULL. Creado al confirmar (transfers). |
| `created_at` / `updated_at` | timestamptz | Trigger `set_updated_at()` |

**UNIQUE:** `(recurring_id, scheduled_date)` — una sola ocurrencia por template y fecha.

**Índices:** `(user_id, status)` y `(recurring_id)`.

#### `scheduled_transactions`
Transacciones programadas puntuales (one-shot). Al llegar la fecha, la app crea el `movement`/`transfer` correspondiente y marca `status = 'executed'`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `kind` | txn_kind NOT NULL | `income` / `expense` / `transfer` |
| `amount` | numeric(18,2) NOT NULL | CHECK > 0 |
| `currency` | currency NOT NULL | Enum `ARS` / `USD` |
| `account_id` | uuid NULL | FK → `accounts` ON DELETE CASCADE |
| `to_account_id` | uuid NULL | FK → `accounts` ON DELETE CASCADE. Solo `kind='transfer'`. |
| `to_amount` | numeric(18,2) NULL | CHECK > 0. Monto destino multimoneda. |
| `category_id` | uuid NULL | FK → `categories` ON DELETE SET NULL |
| `note` | text | Descripción libre |
| `date` | date NOT NULL | Fecha objetivo de ejecución |
| `status` | scheduled_status NOT NULL | DEFAULT `pending` |
| `movement_id` | uuid NULL | FK → `movements` ON DELETE SET NULL |
| `transfer_id` | uuid NULL | FK → `transfers` ON DELETE SET NULL |
| `created_at` / `updated_at` | timestamptz | Trigger `set_updated_at()` |

**CHECK de integridad:** `chk_scheduled_transfer_fields` — mismo patrón que `recurring_transactions`.

**Índice:** `(user_id, status, date)`.

### RLS

Las tres tablas tienen RLS habilitado con las cuatro políticas estándar (`select`/`insert`/`update`/`delete` propias via `auth.uid() = user_id`), idéntico al patrón de `movements` y `transfers`. Las políticas usan `DO $$ EXCEPTION WHEN duplicate_object THEN NULL END $$` para idempotencia.

### FK forward-compat formalizadas

Las columnas `recurring_id` en `movements` y `transfers` ya existían nullable desde `0004`. Esta migración formaliza la integridad referencial:

- `movements.recurring_id → recurring_transactions(id) ON DELETE SET NULL`
- `transfers.recurring_id → recurring_transactions(id) ON DELETE SET NULL`

Borrar un template **no borra** los movimientos históricos ya generados; solo desvincula la referencia (`SET NULL`).

### Diagrama de relaciones (adición)

```
recurring_transactions (1:N)
    │
    └── recurring_occurrences (N:1 → recurring_transactions)
            ├── movement_id  → movements  (opcional, al confirmar)
            └── transfer_id  → transfers  (opcional, al confirmar)

scheduled_transactions
    ├── movement_id  → movements  (opcional, al ejecutar)
    └── transfer_id  → transfers  (opcional, al ejecutar)

movements.recurring_id  → recurring_transactions (nullable)
transfers.recurring_id  → recurring_transactions (nullable)
```

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
