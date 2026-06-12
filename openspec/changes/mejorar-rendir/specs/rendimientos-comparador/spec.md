## ADDED Requirements

### Requirement: Comparación de cuentas remuneradas en USD
El sistema SHALL mostrar una sección de cuentas/billeteras remuneradas en dólares con su rendimiento, usando datos de ArgentinaDatos (`/v1/finanzas/cuentas-remuneradas-usd`).

#### Scenario: Hay cuentas remuneradas USD disponibles
- **WHEN** el usuario abre `/rendir` y ArgentinaDatos devuelve cuentas remuneradas en USD
- **THEN** el sistema muestra cada entidad con su nombre/marca, logo (si existe) y su tasa de rendimiento, ordenadas de mayor a menor

#### Scenario: La fuente no devuelve datos USD
- **WHEN** el endpoint de cuentas remuneradas USD falla o devuelve vacío
- **THEN** el sistema muestra un empty state ("Sin datos disponibles") sin romper el resto de la página

### Requirement: Comparación de LECAPs / Letras del Tesoro
El sistema SHALL mostrar una sección de letras capitalizables (LECAP/BONCAP) con su rendimiento y vencimiento, usando datos de ArgentinaDatos (`/v1/finanzas/letras`).

#### Scenario: Listado de letras vigentes
- **WHEN** el usuario abre `/rendir` y hay letras con datos
- **THEN** el sistema muestra cada letra con su símbolo, TNA y/o TEA, y su fecha de vencimiento, ordenadas por rendimiento descendente

#### Scenario: Letras vencidas excluidas
- **WHEN** una letra tiene fecha de vencimiento anterior a la fecha actual (TZ America/Argentina/Buenos_Aires)
- **THEN** el sistema no la incluye en el ranking

### Requirement: Comparación de cripto ampliada
El sistema SHALL mostrar rendimientos de cripto más allá de USDT, incluyendo otras stablecoins (USDC, DAI) y staking vía `/v1/finanzas/rendimientos`, y criptopesos vía `/v1/finanzas/criptopesos`.

#### Scenario: Rendimientos por moneda
- **WHEN** el usuario abre la sección de cripto
- **THEN** el sistema muestra los rendimientos agrupados o etiquetados por moneda (USDT, USDC, DAI, criptopesos), con la entidad/exchange y su APY

#### Scenario: Disclaimer de riesgo de custodia
- **WHEN** se renderiza cualquier instrumento de cripto
- **THEN** el sistema muestra un disclaimer indicando que los rendimientos no están garantizados y existe riesgo de custodia

### Requirement: Comparación de plazo fijo UVA
El sistema SHALL mostrar plazo fijo ajustado por inflación (UVA), tanto pago periódico como precancelable, usando ArgentinaDatos (`/v1/finanzas/tasas/plazo-fijo-uva-pago-periodico`, `/v1/finanzas/tasas/plazo-fijo-precancelable`).

#### Scenario: Listado de plazo fijo UVA
- **WHEN** el usuario abre `/rendir` y hay datos de plazo fijo UVA
- **THEN** el sistema muestra las entidades con su tasa, distinguiendo la modalidad (pago periódico / precancelable)

### Requirement: Curación por marca conocida
El sistema SHALL mapear cada fondo/entidad a su marca de consumo conocida (p. ej. Mercado Pago, Ualá, Personal Pay, Cocos, Naranja X, Prex, Lemon) con su logo, mostrando el nombre técnico del fondo como subtítulo/nota.

#### Scenario: Fondo con marca conocida
- **WHEN** un fondo del ranking corresponde a una marca de consumo conocida
- **THEN** el sistema muestra el nombre de la marca y su logo como elemento principal, y el nombre técnico del fondo como subtítulo

#### Scenario: Fondo sin marca conocida
- **WHEN** un fondo no tiene una marca de consumo mapeada
- **THEN** el sistema lo trata como "no conocido" y muestra el nombre técnico con un avatar/inicial de fallback

### Requirement: Toggle conocidas / todas
El sistema SHALL ofrecer, en las secciones con ranking por entidad (FCI ARS, FCI USD, y otras aplicables), un control para alternar entre mostrar solo entidades de marca conocida o todas.

#### Scenario: Estado por defecto
- **WHEN** el usuario abre una sección con ranking por entidad
- **THEN** el sistema muestra por defecto solo las entidades de marca conocida

#### Scenario: Ver todas
- **WHEN** el usuario activa el toggle "Todas"
- **THEN** el sistema muestra también las entidades sin marca conocida, sin recargar la página

### Requirement: Vista personalizada según plata disponible
El sistema SHALL mantener el hero personalizado que detecta la plata "idle" del usuario (saldos líquidos en ARS y USD desde la vista `account_balances`) y proyecta la ganancia mensual estimada por instrumento.

#### Scenario: Usuario con saldo líquido sobre el umbral
- **WHEN** el usuario tiene saldo líquido por encima del umbral configurado
- **THEN** el sistema muestra el hero con el monto disponible y la mejor opción por categoría con su proyección de ganancia mensual

#### Scenario: Usuario sin saldo relevante
- **WHEN** el usuario no tiene saldo líquido sobre el umbral
- **THEN** el sistema omite el hero personalizado y muestra los rankings comparativos igualmente

### Requirement: Disclaimer de tasas estimadas
El sistema SHALL indicar que las tasas provienen de ArgentinaDatos y son estimadas, no garantizadas.

#### Scenario: Pie de sección/página
- **WHEN** se renderiza la página `/rendir`
- **THEN** el sistema muestra la atribución a ArgentinaDatos y la nota de que las tasas son estimadas
