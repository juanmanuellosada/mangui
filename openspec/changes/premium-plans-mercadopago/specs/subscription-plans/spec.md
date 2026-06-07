## ADDED Requirements

### Requirement: Planes free y premium con entitlement

El sistema SHALL distinguir usuarios `free` y `premium`. Un usuario es premium si `payment_exempt = true` o su suscripción de Mercado Pago está `authorized`. El plan free es permanente (sin expiración) con límites; el premium desbloquea todo.

#### Scenario: Usuario free por defecto

- **WHEN** un usuario se registra
- **THEN** su `plan` es `free` y aplican los límites del plan free

#### Scenario: Exención manual

- **WHEN** un administrador marca `payment_exempt = true` en `profiles` (vía DB/service role)
- **THEN** el usuario tiene acceso premium sin pagar

#### Scenario: Protección de campos de billing

- **WHEN** un usuario (rol authenticated) intenta modificar sus campos de plan/billing
- **THEN** la operación es rechazada (solo el service role puede escribirlos)

### Requirement: Límites del plan free

El plan free SHALL limitar: 1 cuenta, 1 presupuesto, 1 meta, 3 recurrentes, 0 reglas automáticas, sin adjuntos, sin export CSV, IA Manguito 10/día. Movimientos, cuotas, transferencias, multidólar y estadísticas SHALL ser ilimitados en free. El premium SHALL ser ilimitado en todo.

#### Scenario: Límite de cuentas alcanzado en free

- **WHEN** un usuario free con 1 cuenta intenta crear otra
- **THEN** la creación se bloquea (servidor) y la UI muestra un CTA para mejorar a Premium

#### Scenario: Feature premium en free

- **WHEN** un usuario free intenta crear una regla automática, subir un adjunto o exportar CSV
- **THEN** la acción no está disponible y se invita a Premium

#### Scenario: Límite de IA por plan

- **WHEN** un usuario free supera 10 interpretaciones de IA en el día
- **THEN** el endpoint responde con límite alcanzado; un usuario premium no tiene ese tope

### Requirement: Suscripción premium vía Mercado Pago

El sistema SHALL permitir suscribirse a Premium mediante una preapproval mensual de Mercado Pago en ARS, redirigiendo al checkout de MP. Un webhook firmado SHALL actualizar el plan del usuario según el estado real de la suscripción (re-consultado a MP).

#### Scenario: Iniciar suscripción

- **WHEN** un usuario toca "Suscribirme a Premium"
- **THEN** se crea una preapproval y se lo redirige al checkout de Mercado Pago

#### Scenario: Activación por webhook

- **WHEN** Mercado Pago notifica que la preapproval quedó `authorized`
- **THEN** el webhook (verificada la firma y re-consultado MP) marca al usuario como premium

#### Scenario: Cancelación

- **WHEN** la suscripción se cancela (por el usuario o MP)
- **THEN** el usuario vuelve a free y se re-aplican los límites

### Requirement: Compra desde landing y dentro de la app

El usuario SHALL poder iniciar la compra del Premium tanto desde la landing (sección de precios) como dentro de la app (CTA en la sidebar y sección Plan en Ajustes con estado y gestión de la suscripción).

#### Scenario: Upgrade desde la sidebar

- **WHEN** un usuario free está en la app
- **THEN** ve un CTA "Mejorá a Premium" que lleva al checkout/gestión del plan

#### Scenario: Precios en la landing

- **WHEN** un visitante mira la landing
- **THEN** ve los planes Free y Premium ($9.999/mes) con sus diferencias
