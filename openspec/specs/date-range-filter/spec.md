# date-range-filter Specification

## Purpose
TBD - created by archiving change revamp-movements-filters. Update Purpose after archive.
## Requirements
### Requirement: Componente de filtro de fecha por rango reutilizable

El sistema SHALL proveer un componente de filtro de fecha reutilizable que permita elegir un operador, presets, una cantidad de "últimos N", o fechas en un calendario, y que produzca un rango normalizado `{from, to}` (cada extremo nullable) junto con una etiqueta legible del filtro elegido.

#### Scenario: Operadores disponibles
- **WHEN** el usuario abre el filtro de fecha
- **THEN** puede elegir el operador entre "es", "es antes de", "es después de" y "está entre"

#### Scenario: Operador "es"
- **WHEN** el usuario elige "es" y una fecha X
- **THEN** el filtro produce `{from: X, to: X}` y una etiqueta como "es X"

#### Scenario: Operador "es antes de"
- **WHEN** el usuario elige "es antes de" y una fecha X
- **THEN** el filtro produce `{from: null, to: X}` (fechas hasta X inclusive)

#### Scenario: Operador "es después de"
- **WHEN** el usuario elige "es después de" y una fecha X
- **THEN** el filtro produce `{from: X, to: null}` (fechas desde X inclusive)

#### Scenario: Operador "está entre"
- **WHEN** el usuario elige "está entre" y un rango X..Y en el calendario
- **THEN** el filtro produce `{from: X, to: Y}`

### Requirement: Presets de rango

El componente SHALL ofrecer presets que computan el rango automáticamente: Este mes, El mes pasado, Este trimestre, El trimestre pasado, Lo que va del año, El año pasado, y Todo el historial.

#### Scenario: Elegir un preset
- **WHEN** el usuario elige el preset "El mes pasado"
- **THEN** el rango se setea al primer y último día del mes anterior y la etiqueta refleja "El mes pasado"

#### Scenario: Todo el historial
- **WHEN** el usuario elige "Todo el historial"
- **THEN** el filtro produce `{from: null, to: null}` (sin acotar fechas)

### Requirement: Últimos N

El componente SHALL permitir ingresar una cantidad N y una unidad (días/semanas/meses) y aplicar un rango desde (hoy − N) hasta hoy.

#### Scenario: Últimos N días
- **WHEN** el usuario ingresa N = 30 con unidad "días" y aplica
- **THEN** el filtro produce un rango desde hace 30 días hasta hoy

### Requirement: Aplicar y cancelar

El componente SHALL confirmar la selección solo al Aplicar y descartarla al Cancelar, sin mutar el filtro externo hasta confirmar.

#### Scenario: Cancelar descarta cambios
- **WHEN** el usuario cambia operador/fechas y presiona Cancelar
- **THEN** el filtro externo queda como estaba antes de abrir

#### Scenario: Aplicar confirma
- **WHEN** el usuario presiona Aplicar
- **THEN** el filtro externo recibe el nuevo rango y la etiqueta, y el popover se cierra

### Requirement: Reutilizable fuera de Movimientos

El componente SHALL ser independiente de la sección de Movimientos y exponer una API genérica (valor + onChange) que permita usarlo en otras secciones.

#### Scenario: Uso genérico
- **WHEN** otra sección monta el componente con su propio estado de rango
- **THEN** funciona igual sin depender de lógica específica de Movimientos

