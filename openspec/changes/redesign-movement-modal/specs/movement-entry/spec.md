## ADDED Requirements

### Requirement: Coherencia de moneda según la cuenta

El sistema SHALL forzar la moneda del movimiento a la moneda de la cuenta seleccionada cuando la cuenta no es una tarjeta de crédito (`type != 'tarjeta_credito'`), y SHALL ocultar el selector de moneda en ese caso. Únicamente cuando la cuenta es tarjeta de crédito el sistema SHALL mostrar el selector ARS/USD y permitir una moneda distinta a la de la cuenta.

#### Scenario: Cuenta en pesos que no es tarjeta
- **WHEN** el usuario selecciona una cuenta en ARS cuyo tipo no es tarjeta de crédito
- **THEN** el movimiento queda fijado en ARS y el selector de moneda no se muestra

#### Scenario: Cuenta en dólares que no es tarjeta
- **WHEN** el usuario selecciona una cuenta en USD cuyo tipo no es tarjeta de crédito
- **THEN** el movimiento queda fijado en USD y el selector de moneda no se muestra

#### Scenario: Tarjeta de crédito permite elegir moneda
- **WHEN** el usuario selecciona una cuenta de tipo tarjeta de crédito
- **THEN** el selector de moneda ARS/USD se muestra y el usuario puede elegir una moneda distinta a la de la tarjeta

#### Scenario: Consumo en USD sobre tarjeta en pesos
- **WHEN** la cuenta es una tarjeta de crédito en ARS y el usuario elige moneda USD
- **THEN** se muestra la sección cross-currency (tipo de dólar + monto convertido) y se persiste `dollar_type` y `converted_amount`

#### Scenario: Cambio de cuenta reajusta la moneda
- **WHEN** el usuario tenía una moneda elegida y cambia a una cuenta no-tarjeta de otra moneda
- **THEN** la moneda del movimiento se reajusta a la de la nueva cuenta

### Requirement: Fecha como primer campo con date picker personalizado

El formulario de movimiento SHALL presentar el selector de fecha como el primer campo del formulario y SHALL usar el componente `MangoDatePicker` en lugar del input de fecha nativo.

#### Scenario: Fecha al inicio
- **WHEN** el usuario abre el modal de nuevo movimiento
- **THEN** el primer campo visible es el selector de fecha con `MangoDatePicker`, con la fecha de hoy por defecto

#### Scenario: Selección de fecha
- **WHEN** el usuario abre el `MangoDatePicker` y elige una fecha
- **THEN** la fecha seleccionada queda registrada en el formulario

### Requirement: Derivación automática de is_future

El sistema SHALL derivar `is_future` automáticamente a partir de la fecha del movimiento (`is_future` verdadero cuando la fecha es estrictamente posterior a hoy) y SHALL eliminar el control manual de "Futuro".

#### Scenario: Fecha posterior a hoy
- **WHEN** el usuario carga un movimiento con fecha posterior a la de hoy
- **THEN** el movimiento se persiste con `is_future = true` sin que el usuario marque ningún control

#### Scenario: Fecha de hoy o anterior
- **WHEN** el usuario carga un movimiento con fecha igual o anterior a hoy
- **THEN** el movimiento se persiste con `is_future = false`

#### Scenario: Compatibilidad con consumidores existentes
- **WHEN** un movimiento derivado como futuro se muestra en listados o se evalúa en filtros de presupuesto
- **THEN** se comporta igual que antes (badge "Programado", exclusión de presupuesto) usando el valor de `is_future`

### Requirement: Selectores de cuenta y categoría con ícono, buscador y filas separadas

El selector de cuenta SHALL renderizar el ícono de la cuenta (emoji, logo de catálogo o imagen subida) usando la misma lógica que el selector de categoría. Ambos selectores SHALL ofrecer un buscador interno y SHALL ubicarse en filas separadas, no en un grid de dos columnas.

#### Scenario: Ícono de la cuenta en el selector
- **WHEN** una cuenta tiene un ícono configurado (emoji, logo o imagen subida)
- **THEN** el selector de cuenta muestra ese ícono junto al nombre, tanto en la opción como en el valor seleccionado

#### Scenario: Buscar dentro del selector
- **WHEN** el usuario abre un selector de cuenta o categoría y escribe texto en el buscador
- **THEN** la lista se filtra mostrando solo las opciones cuyo nombre coincide

#### Scenario: Filas separadas
- **WHEN** el usuario ve el formulario de movimiento
- **THEN** los selectores de cuenta y categoría aparecen en filas separadas, cada uno ocupando su propia fila
