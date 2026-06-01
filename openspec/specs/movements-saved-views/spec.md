# movements-saved-views Specification

## Purpose
TBD - created by archiving change revamp-movements-filters. Update Purpose after archive.
## Requirements
### Requirement: Guardar vista con nombre

El usuario SHALL poder guardar el conjunto actual de filtros de Movimientos como una vista con nombre, persistida con `scope = 'movements'`.

#### Scenario: Guardar la vista actual
- **WHEN** el usuario tiene filtros aplicados y elige guardar la vista con un nombre
- **THEN** se crea una vista que almacena esos filtros y aparece en la lista de vistas de Movimientos

### Requirement: Cargar una vista

Al seleccionar una vista guardada, el sistema SHALL aplicar sus filtros y mostrar los movimientos ya filtrados.

#### Scenario: Entrar a una vista
- **WHEN** el usuario selecciona una vista guardada
- **THEN** la barra de filtros toma los valores de la vista y la lista muestra los movimientos filtrados según esa vista

### Requirement: Borrar una vista

El usuario SHALL poder borrar una vista guardada de Movimientos.

#### Scenario: Borrar vista
- **WHEN** el usuario borra una vista
- **THEN** la vista deja de aparecer en la lista

### Requirement: Separación por scope

Las vistas de Movimientos SHALL listarse separadas de las de Analytics: cada sección solo muestra y opera sobre las vistas de su propio `scope`.

#### Scenario: No se mezclan con Analytics
- **WHEN** el usuario abre las vistas guardadas en Movimientos
- **THEN** ve únicamente las vistas con `scope = 'movements'`, no las de Analytics

#### Scenario: Vistas existentes preservadas
- **WHEN** se aplica la migración de `scope`
- **THEN** las vistas creadas antes quedan marcadas como `scope = 'stats'` y siguen apareciendo en Analytics

