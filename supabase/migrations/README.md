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
| `0011_recurring_scheduled.sql` | `recurring_transactions`, `recurring_occurrences`, `scheduled_transactions` |
| `0012_auto_rules.sql` | Enums `rule_match`, `rule_field`, `rule_operator`; tablas `auto_rules`, `auto_rule_conditions` |
| `0013_budgets_goals.sql` | Enums `budget_period`, `budget_status`, `goal_type`, `goal_status`; tablas `budgets`, `goals`, `goal_snapshots` |
| `0014_saved_views.sql` | Tabla `saved_views` (filtros serializados de analytics) |

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
- ~~**Vistas guardadas:** `saved_views` (user_id, filtros serializados).~~ ✓ Implementado en `0014_saved_views.sql`.
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

## Fase 4 — Reglas automáticas de auto-categorización (`0012_auto_rules.sql`)

### Nuevos enums

| Enum | Valores |
|---|---|
| `rule_match` | `all`, `any` |
| `rule_field` | `note`, `amount`, `account`, `type` |
| `rule_operator` | `contains`, `starts_with`, `ends_with`, `equals`, `gt`, `lt`, `between` |

Todos creados con `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` (idempotente).

### Nuevas tablas

#### `auto_rules`
Define una regla de auto-categorización / auto-asignación de cuenta. Una regla tiene un conjunto de condiciones, un modo de coincidencia (AND / OR), una o más acciones y una prioridad de aplicación.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `name` | text NOT NULL | Nombre legible de la regla (ej: "Netflix → Suscripciones") |
| `priority` | int NOT NULL | DEFAULT 0. Mayor número = mayor precedencia. |
| `match` | rule_match NOT NULL | DEFAULT `'all'`. `all` = AND entre condiciones; `any` = OR. |
| `action_category_id` | uuid NULL | FK → `categories` ON DELETE SET NULL |
| `action_account_id` | uuid NULL | FK → `accounts` ON DELETE SET NULL |
| `is_active` | boolean NOT NULL | DEFAULT true. Permite deshabilitar sin borrar. |
| `created_at` / `updated_at` | timestamptz | Trigger `set_updated_at()` |

**CHECK `chk_rule_has_action`:** `action_category_id IS NOT NULL OR action_account_id IS NOT NULL` — la regla debe tener al menos una acción.

**Índices:** `(user_id)` y `(user_id, is_active, priority DESC)` (clave para la consulta de aplicación de reglas).

#### `auto_rule_conditions`
Cada fila es una condición individual de una regla. La regla padre evalúa todas sus condiciones con el operador `all` (AND) / `any` (OR) configurado en `auto_rules.match`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE (necesario para RLS directa sin JOIN) |
| `rule_id` | uuid NOT NULL | FK → `auto_rules` ON DELETE CASCADE |
| `field` | rule_field NOT NULL | Campo del movimiento a evaluar |
| `operator` | rule_operator NOT NULL | Operador de comparación |
| `value_text` | text NULL | Para `field IN ('note', 'type', 'account')`: texto libre / `'income'\|'expense'` / uuid como texto |
| `value_num` | numeric(18,2) NULL | Para `field = 'amount'`: valor único (`gt`/`lt`/`equals`) o cota inferior (`between`) |
| `value_num2` | numeric(18,2) NULL | Solo para `operator = 'between'`: cota superior del rango de monto |
| `position` | int NOT NULL | DEFAULT 0. Orden de la condición en la lista de UI. |
| `created_at` / `updated_at` | timestamptz | Trigger `set_updated_at()` |

**Índices:** `(rule_id)` (consulta frecuente: condiciones de una regla) y `(user_id)`.

### Diagrama de relaciones (adición)

```
auto_rules (1:N)
    │
    └── auto_rule_conditions (N:1 → auto_rules)

auto_rules.action_category_id → categories (nullable, SET NULL al borrar)
auto_rules.action_account_id  → accounts   (nullable, SET NULL al borrar)
auto_rule_conditions.user_id  → auth.users (CASCADE, para RLS directa)
```

### RLS

Ambas tablas tienen RLS habilitado con las cuatro políticas estándar (`select`/`insert`/`update`/`delete` propias via `auth.uid() = user_id`), idéntico al patrón de `movements`, `transfers`, `recurring_transactions`, etc.

`auto_rule_conditions` incluye `user_id` propio (redundante con `auto_rules.user_id`) para permitir políticas RLS directas sin requerir un JOIN a `auto_rules`.

### Diagrama de entidades (actualización)

```
auth.users (Supabase Auth)
    │
    └── auto_rules (1:N)
            │
            ├── auto_rule_conditions (N:1 → auto_rules)
            │
            ├── action_category_id → categories (nullable)
            └── action_account_id  → accounts   (nullable)
```

### Semántica de campos de condición

| field | operator(es) válidos | value_text | value_num | value_num2 |
|---|---|---|---|---|
| `note` | `contains`, `starts_with`, `ends_with`, `equals` | texto libre | — | — |
| `type` | `equals` | `'income'` ó `'expense'` | — | — |
| `account` | `equals` | uuid de la cuenta (text) | — | — |
| `amount` | `gt`, `lt`, `equals` | — | monto comparación | — |
| `amount` | `between` | — | cota inferior | cota superior |

---

## Fase 5 — Presupuestos y Metas (`0013_budgets_goals.sql`)

### Nuevos enums

| Enum | Valores |
|---|---|
| `budget_period` | `weekly`, `biweekly`, `monthly`, `quarterly`, `annual` |
| `budget_status` | `active`, `paused` |
| `goal_type` | `saving`, `reduction` |
| `goal_status` | `active`, `completed` |

Todos creados con `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` (idempotente).

### Nuevas tablas

#### `budgets`
Define un límite de gasto sobre una ventana de tiempo (semanal, quincenal, mensual, trimestral o anual). El gasto acumulado **no se almacena** — se deriva en runtime desde `movements` cuyos `account_id` / `category_id` caen dentro del alcance configurado y dentro de la ventana activa.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `name` | text NOT NULL | Nombre descriptivo del presupuesto |
| `limit_amount` | numeric(18,2) NOT NULL | CHECK > 0 |
| `currency` | currency NOT NULL | Enum `ARS` / `USD` |
| `period` | budget_period NOT NULL | Duración de la ventana |
| `is_recurring` | boolean NOT NULL | DEFAULT `true`. `false` = presupuesto puntual (una sola ventana). |
| `status` | budget_status NOT NULL | DEFAULT `active` |
| `start_date` | date NOT NULL | DEFAULT `CURRENT_DATE`. Ancla del inicio de la primera ventana. |
| `category_ids` | uuid[] NOT NULL | DEFAULT `'{}'`. Vacío = todas las categorías. Sin FK de array (ver nota). |
| `account_ids` | uuid[] NOT NULL | DEFAULT `'{}'`. Vacío = todas las cuentas. Sin FK de array (ver nota). |
| `created_at` / `updated_at` | timestamptz | Trigger `set_updated_at()` |

**Nota de diseño — scope por arrays:** `category_ids` y `account_ids` son `uuid[]` sin FK declaradas (PostgreSQL no soporta FK sobre arrays). La aplicación valida que los uuid pertenezcan al usuario al crear/editar. Si una categoría o cuenta referenciada se borra, simplemente deja de coincidir con nuevos movimientos; los presupuestos históricos quedan intactos con el uuid huérfano en el array.

**Índice:** `(user_id, status)`.

#### `goals`
Meta financiera de tipo **Ahorro** (acumular un monto target) o **Reducción** (gastar menos en una categoría/cuenta respecto de un baseline).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `name` | text NOT NULL | Nombre de la meta |
| `type` | goal_type NOT NULL | `saving` o `reduction` |
| `target_amount` | numeric(18,2) NULL | CHECK > 0. Ahorro: monto a alcanzar (requerido). Reducción: monto máximo deseado (opcional). |
| `target_percent` | numeric(5,2) NULL | CHECK > 0 AND ≤ 100. Solo Reducción: % de reducción sobre baseline. |
| `baseline_amount` | numeric(18,2) NULL | CHECK ≥ 0. Solo Reducción: gasto histórico de referencia. NULL = la app lo calcula. |
| `currency` | currency NOT NULL | Enum `ARS` / `USD` |
| `category_id` | uuid NULL | FK → `categories(id)` ON DELETE SET NULL. NULL = sin filtro de categoría. |
| `account_id` | uuid NULL | FK → `accounts(id)` ON DELETE SET NULL. NULL = sin filtro de cuenta. |
| `deadline` | date NULL | Fecha límite opcional |
| `status` | goal_status NOT NULL | DEFAULT `active` |
| `created_at` / `updated_at` | timestamptz | Trigger `set_updated_at()` |

**CHECK `chk_goal_target`:** `(type='saving' AND target_amount IS NOT NULL) OR (type='reduction' AND (target_percent IS NOT NULL OR target_amount IS NOT NULL))` — garantiza que cada tipo tenga al menos una métrica objetivo.

**Índice:** `(user_id, status)`.

#### `goal_snapshots`
Captura mensual del progreso de una meta. Poblada opcionalmente por la app o por un cron job. Para metas de Ahorro: `amount` = monto acumulado ese mes. Para Reducción: `amount` = gasto medido ese mes.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `goal_id` | uuid NOT NULL | FK → `goals(id)` ON DELETE CASCADE |
| `month` | date NOT NULL | Primer día del mes (ej: `2025-05-01`). Enforced por convención de app. |
| `amount` | numeric(18,2) NOT NULL | DEFAULT 0. Valor acumulado/medido para ese mes. |
| `created_at` | timestamptz NOT NULL | DEFAULT `now()`. Sin `updated_at` — snapshots son inmutables; recálculo vía upsert on conflict. |

**UNIQUE:** `(goal_id, month)` — una sola snapshot por meta y mes.

**Índice:** `(user_id, goal_id)`.

### RLS

Las tres tablas tienen RLS habilitado con las cuatro políticas estándar (`select`/`insert`/`update`/`delete` propias via `auth.uid() = user_id`), idéntico al patrón de `movements`, `transfers`, `recurring_transactions`, etc.

### Diagrama de relaciones (adición)

```
auth.users
    │
    ├── budgets (1:N)
    │       scope: category_ids uuid[] → categories (sin FK; app valida ownership)
    │       scope: account_ids  uuid[] → accounts   (sin FK; app valida ownership)
    │
    └── goals (1:N)
            │
            ├── category_id → categories (nullable, SET NULL al borrar)
            ├── account_id  → accounts   (nullable, SET NULL al borrar)
            │
            └── goal_snapshots (1:N → goals)
```

### Diagrama de entidades (actualización)

```
auth.users (Supabase Auth)
    │
    ├── budgets (1:N)
    │
    └── goals (1:N)
            │
            └── goal_snapshots (N:1 → goals)
```

---

## Fase 6 — Estadísticas / Reportes: Vistas guardadas (`0014_saved_views.sql`)

### Contexto

La pantalla de Estadísticas deriva todos sus datos analíticos en runtime desde las tablas existentes (`movements`, `transfers`, `budgets`, `goals`, `recurring_transactions`). **No se necesita ninguna tabla nueva para los cálculos** (totales, gráficos, comparaciones de período). La única estructura nueva es `saved_views`, que persiste conjuntos de filtros configurados por el usuario para ser reutilizados en sucesivas sesiones.

### Nueva tabla

#### `saved_views`

Almacena un conjunto de parámetros de filtro de analytics bajo un nombre elegido por el usuario. No contiene resultados calculados — solo el "estado del filtro" que la app puede restaurar al entrar a la pantalla de Estadísticas.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `name` | text NOT NULL | Nombre libre (ej: "Mayo ARS gastos"). Sin unicidad forzada — el usuario puede clonar vistas. |
| `filters` | jsonb NOT NULL | DEFAULT `'{}'`. Objeto con: `dateFrom`, `dateTo` (ISO date), `categoryIds` uuid[], `accountIds` uuid[], `currency` (`"ARS"`\|`"USD"`\|null), `type` (`"income"`\|`"expense"`\|null). Todos los campos son opcionales. Objeto vacío = sin filtros (vista global). |
| `created_at` / `updated_at` | timestamptz | Trigger `set_updated_at()` |

**Nota de diseño — arrays sin FK:** igual que `budgets.category_ids` / `account_ids`, los campos `categoryIds` y `accountIds` dentro del jsonb son arrays de uuid sin FK declaradas (jsonb no admite FK). La app valida ownership al crear/editar. Un uuid huérfano (categoría o cuenta borrada) simplemente no produce resultados al filtrar — no corrompe la vista guardada.

**Índice:** `(user_id)` — cubre la consulta estándar de listar vistas del usuario.

### RLS

Mismas cuatro políticas estándar que el resto de tablas de usuario (`select`/`insert`/`update`/`delete` propias via `auth.uid() = user_id`). Bloques `DO $$ EXCEPTION WHEN duplicate_object THEN NULL END $$` para idempotencia.

### Diagrama de relaciones (adición)

```
auth.users
    │
    └── saved_views (1:N)
            filters jsonb → categoryIds[] → categories  (sin FK; app valida ownership)
            filters jsonb → accountIds[]  → accounts    (sin FK; app valida ownership)
```

### Datos analíticos derivados (sin tabla nueva)

| Métrica | Fuente |
|---|---|
| Gastos por categoría (donut) | `movements` filtrado por rango + categoría + cuenta + moneda + tipo |
| Evolución del balance / Ingresos vs Gastos | `movements` + `transfers` agrupados por período |
| Patrón por día de la semana | `movements` con `EXTRACT(DOW FROM date)` |
| Total ingresos / Total gastos / Balance neto | `movements` con SUM por tipo |
| Cumplimiento de presupuestos | `budgets` + `movements` dentro de la ventana activa |
| Comparación de períodos | mismas consultas parametrizadas con dos rangos de fecha |

---

## Fase 7 — PWA Offline + Web Push Notifications (`0015_push_notifications.sql`)

### Contexto

Esta fase agrega el soporte de infraestructura de base de datos para:
1. Registrar las suscripciones VAPID de cada browser/dispositivo del usuario.
2. Deduplicar eventos notificados para que un mismo evento no genere más de un push por usuario.
3. Almacenar las preferencias de notificación del usuario directamente en `user_preferences`.

### Nuevas tablas

#### `push_subscriptions`
Una fila por browser o dispositivo que el usuario autorizó para recibir Web Push Notifications. Las claves VAPID se almacenan aquí y las usa el backend (edge function o cron) al llamar a la Web Push API.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `endpoint` | text NOT NULL | URL del push endpoint (provista por el browser) |
| `p256dh` | text NOT NULL | Clave pública del cliente, Base64url, P-256 |
| `auth` | text NOT NULL | Clave de autenticación del cliente, Base64url |
| `user_agent` | text NULL | Opcional. Identifica el dispositivo en la UI. |
| `created_at` | timestamptz NOT NULL | DEFAULT now() |

**UNIQUE:** `(user_id, endpoint)` — evita duplicados si el service worker se re-registra con el mismo endpoint.

**Índice:** `(user_id)`.

#### `notification_log`
Registro de deduplicación. El cron/edge function consulta esta tabla antes de enviar un push: si ya existe un registro `(user_id, event_key)`, no envía de nuevo. La clave `event_key` sigue el formato `'<tipo>:<id>:<período>'`, por ejemplo `'card_due:<accountId>:2025-06'`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users` ON DELETE CASCADE |
| `event_key` | text NOT NULL | Identificador único del evento notificado |
| `channel` | text NOT NULL | DEFAULT `'push'`. Reservado para futuros canales. |
| `sent_at` | timestamptz NOT NULL | DEFAULT now() |

**UNIQUE:** `(user_id, event_key)` — una sola entrada por evento por usuario.

**Índice:** `(user_id)`.

### RLS

**`push_subscriptions`:** RLS habilitado con las cuatro políticas estándar (`select`/`insert`/`update`/`delete` propias via `auth.uid() = user_id`). El cliente inserta y revoca sus propias suscripciones; el backend usa `service_role` para leer todas al hacer el fanout (el `service_role` bypassa RLS).

**`notification_log`:** RLS habilitado con una sola política SELECT propia. Sin políticas `INSERT`/`UPDATE`/`DELETE` → solo el `service_role` puede escribir (patrón idéntico al de `exchange_rates`).

### Columnas agregadas a `user_preferences`

| Columna | Tipo | Default | Notas |
|---|---|---|---|
| `push_enabled` | boolean NOT NULL | `false` | El usuario activa explícitamente las notificaciones push. |
| `notify_hour` | int NOT NULL | `9` | Hora (0–23, hora AR) para los avisos programados. CHECK 0–23. |
| `card_reminder_enabled` | boolean NOT NULL | `true` | Recordatorio de fechas/vencimiento de tarjeta. |

Las tres columnas se agregan con `ADD COLUMN IF NOT EXISTS` (idempotente). Los usuarios existentes obtienen los valores por defecto sin intervención.

### Diagrama de relaciones (adición)

```
auth.users
    │
    ├── push_subscriptions (1:N)
    │       UNIQUE (user_id, endpoint)
    │
    └── notification_log (1:N)
            UNIQUE (user_id, event_key)
            escritura: service_role solo
            lectura:   usuario autenticado propio

user_preferences
    │
    ├── push_enabled          boolean DEFAULT false
    ├── notify_hour           int     DEFAULT 9 CHECK 0–23
    └── card_reminder_enabled boolean DEFAULT true
```

---

## Archivos de migración (tabla actualizada)

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
| `0011_recurring_scheduled.sql` | `recurring_transactions`, `recurring_occurrences`, `scheduled_transactions` |
| `0012_auto_rules.sql` | Enums `rule_match`, `rule_field`, `rule_operator`; tablas `auto_rules`, `auto_rule_conditions` |
| `0013_budgets_goals.sql` | Enums `budget_period`, `budget_status`, `goal_type`, `goal_status`; tablas `budgets`, `goals`, `goal_snapshots` |
| `0014_saved_views.sql` | Tabla `saved_views` (filtros serializados de analytics) |
| `0015_push_notifications.sql` | Tablas `push_subscriptions`, `notification_log`; columnas de notificaciones en `user_preferences` |

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
