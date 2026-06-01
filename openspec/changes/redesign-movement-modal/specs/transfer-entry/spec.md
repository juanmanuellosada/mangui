## ADDED Requirements

### Requirement: Transferencia como tercer modo del modal

El modal de movimientos SHALL ofrecer un toggle de tipo con tres opciones — Gasto, Ingreso y Transferencia — y al elegir Transferencia SHALL mostrar los campos de transferencia reutilizando la lógica de inserción de transferencias existente.

#### Scenario: Cambiar a modo transferencia
- **WHEN** el usuario selecciona "Transferencia" en el toggle de tipo
- **THEN** el modal muestra los campos de transferencia (cuenta origen, cuenta destino, monto, fecha, nota) en lugar de los campos de movimiento

#### Scenario: Crear una transferencia
- **WHEN** el usuario completa cuenta origen, cuenta destino y monto y confirma
- **THEN** se crea una transferencia entre ambas cuentas

#### Scenario: Origen y destino no pueden ser la misma cuenta
- **WHEN** el usuario elige la misma cuenta como origen y destino
- **THEN** el sistema impide crear la transferencia y lo indica

### Requirement: Consistencia de UX en modo transferencia

El modo transferencia SHALL aplicar las mismas mejoras de UX que el modo movimiento: selectores de cuenta con ícono y buscador, fecha como primer campo con `MangoDatePicker`, derivación automática de `is_future` desde la fecha, y campos en filas separadas.

#### Scenario: Selectores de cuenta con ícono y buscador
- **WHEN** el usuario abre los selectores de cuenta origen o destino en modo transferencia
- **THEN** cada cuenta muestra su ícono y el selector ofrece un buscador interno

#### Scenario: Fecha primero y is_future derivado en transferencia
- **WHEN** el usuario carga una transferencia con fecha posterior a hoy usando el date picker al inicio del formulario
- **THEN** la transferencia se persiste con `is_future = true` sin control manual de futuro

#### Scenario: Transferencia cross-currency
- **WHEN** la cuenta origen y la destino tienen monedas distintas
- **THEN** el formulario permite indicar montos de origen y destino por separado (comportamiento existente preservado)
